// utils/offlineStorage.ts
// Stockage hors ligne des produits (+ images) et des commandes, par compte.
// Dépend de : expo-file-system, @react-native-async-storage/async-storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { OfflineProduct, OfflineOrder, SyncQueueItem } from '@/src/@types/models';

export type { OfflineProduct, OfflineOrder, SyncQueueItem };

// ─── Clés AsyncStorage ────────────────────────────────────────────────────────

const KEYS = {
  products:  (accountId: string) => `@offline:products:${accountId}`,
  // Même clé que useCheckout — un seul store partagé
  orders:    (accountId: string) => `@offline_delivery_orders:${accountId}`,
  syncQueue: '@offline:sync_queue',
};

const IMAGES_DIR = `${FileSystem.documentDirectory}offline_images/`;

// ─── Helpers internes ─────────────────────────────────────────────────────────

async function ensureImagesDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

function safeFilename(url: string, accountId: string): string {
  const parts = url.split('/');
  const raw = parts[parts.length - 1].split('?')[0] || `img_${Date.now()}.jpg`;
  return `${accountId}_${raw}`;
}

// ═══════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════

export const ProductOfflineStorage = {

  async getProducts(accountId: string): Promise<OfflineProduct[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.products(accountId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async hasAnyProductFast(): Promise<boolean> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys.some((key) => key.startsWith('@offline:products:'));
    } catch {
      return false;
    }
  },

  async saveProducts(accountId: string, rawProducts: any[]): Promise<OfflineProduct[]> {
    await ensureImagesDir();

    const saved: OfflineProduct[] = await Promise.all(
      rawProducts.map(async (p) => {
        const images: string[] = (Array.isArray(p.images) ? p.images : [])
          .map((img: any) => (typeof img === 'string' ? img : img?.url ?? ''))
          .filter(Boolean);

        if (p.coverImage && !images.includes(p.coverImage)) {
          images.unshift(p.coverImage);
        }

        const localImagesMap: Record<string, string> = {};

        await Promise.all(
          images.map(async (url) => {
            try {
              const localPath = `${IMAGES_DIR}${safeFilename(url, accountId)}`;
              const info = await FileSystem.getInfoAsync(localPath);
              if (info.exists) {
                localImagesMap[url] = localPath;
                return;
              }
              const result = await FileSystem.downloadAsync(url, localPath);
              localImagesMap[url] = result.uri;
            } catch {
              localImagesMap[url] = url;
            }
          })
        );

        const localImages = images.map((url) => localImagesMap[url]).filter(Boolean);
        const coverImageLocal = p.coverImage
          ? localImagesMap[p.coverImage] ?? p.coverImage
          : localImages[0];

        return {
          id:                  p.id,
          slug:                p.slug ?? '',
          name:                p.name ?? '',
          description:         p.description ?? '',
          price:               Number(p.price ?? 0),
          images,
          localImages,
          coverImage:          p.coverImage ?? '',
          coverImageLocal,
          category_id:         p.category_id,
          in_stock:            p.in_stock,
          currency:            p.currency,
          declination:         p.declination ?? [],
          has_unlimited_stock: p.has_unlimited_stock ?? false,
          stock_quantity:      p.stock_quantity ?? 0,
          category:            p.category ?? [],
          created_at:          p.created_at ?? null,
          updated_at:          p.updated_at ?? null,
          cachedAt:            Date.now(),
        } satisfies OfflineProduct;
      })
    );

    await AsyncStorage.setItem(KEYS.products(accountId), JSON.stringify(saved));
    console.log(`[OfflineStorage] ${saved.length} produits sauvegardés (compte: ${accountId})`);
    return saved;
  },

  async clearProducts(accountId: string): Promise<void> {
    const products = await this.getProducts(accountId);
    await Promise.all(
      products.flatMap((p) =>
        p.localImages.map(async (path) => {
          try {
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists) await FileSystem.deleteAsync(path);
          } catch {}
        })
      )
    );
    await AsyncStorage.removeItem(KEYS.products(accountId));
  },

  async getCacheAgeMinutes(accountId: string): Promise<number | null> {
    const products = await this.getProducts(accountId);
    if (!products.length) return null;
    const oldest = Math.min(...products.map((p) => p.cachedAt));
    return Math.floor((Date.now() - oldest) / 60_000);
  },
};

// ═══════════════════════════════════════════════════════════
// COMMANDES HORS LIGNE
// ═══════════════════════════════════════════════════════════

export const OrderOfflineStorage = {

  async getOrders(accountId: string): Promise<OfflineOrder[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.orders(accountId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Persiste une OfflineOrder déjà construite par useCheckout
  async saveOrder(accountId: string, order: OfflineOrder): Promise<OfflineOrder> {
    const orders = await this.getOrders(accountId);
    orders.push(order);
    await AsyncStorage.setItem(KEYS.orders(accountId), JSON.stringify(orders));
    await SyncQueue.add((order as any).localId, accountId);
    console.log(`[OfflineStorage] Commande ${(order as any).localId} sauvegardée (hors ligne)`);
    return order;
  },

  // Mettre à jour le statut après tentative de sync
  async patchOrder(
    accountId: string,
    localId:   string,
    patch:     Partial<Pick<OfflineOrder, 'status' | 'serverId' | 'syncError' | 'syncAttempts'>>
  ): Promise<void> {
    const orders = await this.getOrders(accountId);
    const idx = orders.findIndex((o) => o.localId === localId);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...patch };
      await AsyncStorage.setItem(KEYS.orders(accountId), JSON.stringify(orders));
    }
  },

  async getPendingOrders(accountId: string): Promise<OfflineOrder[]> {
    const orders = await this.getOrders(accountId);
    return orders.filter((o) => o.status === 'pending_sync' || o.status === 'failed');
  },

  async getAllOrdersAllAccounts(): Promise<OfflineOrder[]> {
    const keys = await AsyncStorage.getAllKeys();
    const orderKeys = keys.filter((k) => k.startsWith('@offline_delivery_orders:'));
    const results = await AsyncStorage.multiGet(orderKeys);
    return results.flatMap(([, val]) => (val ? JSON.parse(val) : []));
  },
};

// ═══════════════════════════════════════════════════════════
// FILE DE SYNCHRONISATION
// ═══════════════════════════════════════════════════════════

export const SyncQueue = {

  async getAll(): Promise<SyncQueueItem[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.syncQueue);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async add(localId: string, accountId: string): Promise<void> {
    const queue = await this.getAll();
    if (queue.some((i) => i.localId === localId)) return; // évite les doublons
    queue.push({ localId, accountId, addedAt: Date.now() });
    await AsyncStorage.setItem(KEYS.syncQueue, JSON.stringify(queue));
  },

  async remove(localId: string): Promise<void> {
    const queue = (await this.getAll()).filter((i) => i.localId !== localId);
    await AsyncStorage.setItem(KEYS.syncQueue, JSON.stringify(queue));
  },

  async count(): Promise<number> {
    return (await this.getAll()).length;
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.syncQueue);
  },
};