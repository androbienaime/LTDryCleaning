// utils/offlineStorage.ts
// Stockage hors ligne des produits (+ images) et des commandes, par compte.
// Dépend de : expo-file-system, @react-native-async-storage/async-storage
// Tous les types viennent de models.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type {
  OfflineProduct,
  OfflineOrder,
  OrderItem,
  SyncQueueItem,
} from '@/src/@types/models';

// Re-exporte les types pour les imports existants
export type { OfflineProduct, OfflineOrder, OrderItem as OfflineOrderItem, SyncQueueItem, };

// ─── Clés AsyncStorage ───────────────────────────────────────────────────────

const KEYS = {
  products:  (id: string) => `@offline:products:${id}`,
  orders:    (id: string) => `@offline:orders:${id}`,
  syncQueue: '@offline:sync_queue',
};

const IMAGES_DIR = `${FileSystem.documentDirectory}offline_images/`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureImagesDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

function safeFilename(url: string, accountId: string): string {
  const parts = url.split('/');
  const raw = parts[parts.length - 1].split('?')[0] || `img_${Date.now()}.jpg`;
  // Préfixer par accountId pour isoler les images par compte
  return `${accountId}_${raw}`;
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Produits ─────────────────────────────────────────────────────────────────

export const ProductOfflineStorage = {

  // Lire tous les produits cachés pour un compte
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
      return keys.some(key => key.startsWith('products_'));
    } catch {
      return false;
    }
  },

 async saveProducts(accountId: string, rawProducts: any[]): Promise<OfflineProduct[]> {
  await ensureImagesDir();

  const saved: OfflineProduct[] = await Promise.all(
    rawProducts.map(async (p) => {

      // ─────────────────────────────────────────────
      // 1. NORMALISER LES IMAGES
      // ─────────────────────────────────────────────
      const images: string[] = (Array.isArray(p.images) ? p.images : [])
        .map((img: any) => (typeof img === 'string' ? img : img?.url ?? ''))
        .filter(Boolean);

      // Inclure coverImage dans la liste si existe
      if (p.coverImage && !images.includes(p.coverImage)) {
        images.unshift(p.coverImage);
      }

      // ─────────────────────────────────────────────
      // 2. TELECHARGER TOUTES LES IMAGES
      // ─────────────────────────────────────────────
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
            localImagesMap[url] = url; // fallback remote
          }
        })
      );

      // ─────────────────────────────────────────────
      // 3. CONSTRUIRE LES TABLEAUX
      // ─────────────────────────────────────────────
      const localImages = images
        .map((url) => localImagesMap[url])
        .filter(Boolean);

      // coverImage LOCAL prioritaire
      const coverImageLocal = p.coverImage
        ? localImagesMap[p.coverImage] ?? p.coverImage
        : localImages[0];

      // ─────────────────────────────────────────────
      // 4. RETURN FINAL
      // ─────────────────────────────────────────────
      return {
        id: p.id,
        slug: p.slug ?? '',
        name: p.name ?? '',
        description: p.description ?? '',
        price: Number(p.price ?? 0),

        // 🔥 IMPORTANT
        images, // remote
        localImages, // local cache

        coverImage: p.coverImage ?? '',
        coverImageLocal, // ✅ NEW (clé critique)

        category_id: p.category_id,
        in_stock: p.in_stock,
        currency: p.currency,
        declination: p.declination ?? [],
        has_unlimited_stock: p.has_unlimited_stock ?? false,
        stock_quantity: p.stock_quantity ?? 0,
        category: p.category ?? [],

        created_at: p.created_at ?? null,
        updated_at: p.updated_at ?? null,

        cachedAt: Date.now(),
      } satisfies OfflineProduct;
    })
  );

  await AsyncStorage.setItem(KEYS.products(accountId), JSON.stringify(saved));

  console.log(`[OfflineStorage] ${saved.length} produits sauvegardés (compte: ${accountId})`);

  return saved;
},

  // Supprimer le cache produits + images locales d'un compte
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
    console.log(`[OfflineStorage] Cache produits supprimé (compte: ${accountId})`);
  },

  // Âge du cache en minutes, ou null si vide
  async getCacheAgeMinutes(accountId: string): Promise<number | null> {
    const products = await this.getProducts(accountId);
    if (!products.length) return null;
    const oldest = Math.min(...products.map((p) => p.cachedAt));
    return Math.floor((Date.now() - oldest) / 60_000);
  },
};

// ─── Commandes hors ligne ─────────────────────────────────────────────────────

export const OrderOfflineStorage = {

  async getOrders(accountId: string): Promise<OfflineOrder[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.orders(accountId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Créer une commande hors ligne → l'ajoute à la SyncQueue
  async createOrder(
    accountId: string,
    items: OrderItem[],
    options?: { address?: string; note?: string }
  ): Promise<OfflineOrder> {
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order: OfflineOrder = {
      localId:      generateLocalId(),
      accountId,
      items,
      total,
      address:      options?.address,
      note:         options?.note,
      status:       'pending_sync' as OfflineOrder['status'],
      createdAt:    Date.now(),
      syncAttempts: 0,
    };

    const orders = await this.getOrders(accountId);
    orders.push(order);
    await AsyncStorage.setItem(KEYS.orders(accountId), JSON.stringify(orders));
    await SyncQueue.add(order.localId, accountId);

    console.log(`[OfflineStorage] Commande ${order.localId} créée (hors ligne)`);
    return order;
  },

  // Mettre à jour le statut après tentative de sync (appelé par SyncService)
  async updateOrderStatus(
    accountId: string,
    localId: string,
    patch: Partial<Pick<OfflineOrder, 'status' | 'serverId' | 'syncError' | 'syncAttempts'>>
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
    const orderKeys = keys.filter((k) => k.startsWith('@offline:orders:'));
    const results = await AsyncStorage.multiGet(orderKeys);
    return results.flatMap(([, val]) => (val ? JSON.parse(val) : []));
  },
};

// ─── File de synchronisation globale ─────────────────────────────────────────

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
    // Éviter les doublons
    if (queue.some((i) => i.localId === localId)) return;
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