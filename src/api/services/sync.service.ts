// src/api/services/sync.service.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customersService } from '@/src/api/services/customers.services';
import { ordersService, generateOrderReference, generateSecureKey } from '@/src/api/services/orders.services';
import type { OfflineOrder, Order, SyncResult } from '@/src/@types/models';
import { extractApiError } from '../client';
import { AppSetup } from '@/utils/appSetup';

const MAX_SYNC_ATTEMPTS  = 5;
export const OFFLINE_KEY_PREFIX = '@offline_delivery_orders:';

// ─── Helpers AsyncStorage directs ────────────────────────────────────────────
// On lit/écrit avec la MÊME clé que useCheckout pour éviter tout désalignement.

async function getAllOfflineAccountIds(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys
      .filter((k) => k.startsWith(OFFLINE_KEY_PREFIX))
      .map((k) => k.replace(OFFLINE_KEY_PREFIX, ''));
  } catch {
    return [];
  }
}

async function getOrders(accountId: string): Promise<OfflineOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(`${OFFLINE_KEY_PREFIX}${accountId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveOrders(accountId: string, orders: OfflineOrder[]): Promise<void> {
  await AsyncStorage.setItem(
    `${OFFLINE_KEY_PREFIX}${accountId}`,
    JSON.stringify(orders)
  );
}

async function patchOrder(
  accountId: string,
  localId: string,
  patch: Partial<OfflineOrder>
): Promise<void> {
  const orders  = await getOrders(accountId);
  const updated = orders.map((o) => o.localId === localId ? { ...o, ...patch } : o);
  await saveOrders(accountId, updated);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const SyncService = {
  _unsubscribe: null as (() => void) | null,
  _isSyncing:   false,

  startListening(onComplete?: (result: SyncResult) => void): void {
    if (this._unsubscribe) return;

    this._unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      if (!online) return;

      console.log('[SyncService] Réseau détecté → synchronisation');
      const result = await this.syncAll();
      if (result.synced > 0 || result.failed > 0) {
        onComplete?.(result);
      }
    });

    console.log('[SyncService] Écoute réseau démarrée');
  },

  stopListening(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
    console.log('[SyncService] Écoute réseau arrêtée');
  },

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable);
  },

  async syncAll(): Promise<SyncResult> {
    if (this._isSyncing) return { synced: 0, failed: 0, errors: [] };

    this._isSyncing = true;
    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    try {
      const setupConfig = await AppSetup.getConfig();
      const shopId      = setupConfig.shopId;
      const currencyId  = setupConfig.currency?.iso_code ?? 'HTG';

      if (!shopId) {
        console.warn('[SyncService] Aucun shopId configuré — sync impossible');
        return result;
      }

      // ── Tous les comptes ayant des commandes offline ─────────────────────
      const accountIds = await getAllOfflineAccountIds();
      if (!accountIds.length) {
        console.log('[SyncService] Aucune commande en attente');
        return result;
      }

      console.log(`[SyncService] ${accountIds.length} compte(s) trouvé(s)`);

      for (const accountId of accountIds) {

        // ── Lecture directe AsyncStorage (même clé que useCheckout) ────────
        const allOrders = await getOrders(accountId);
        // const pending   = allOrders.filter((o) => o.status === 'pending_sync');

        console.log(
          `[SyncService] Statuts compte "${accountId}" :`,
          allOrders.map((o) => `${o.localId.slice(-6)} → ${o.status}`)
        );
        const pending = allOrders.filter((o) =>
          o.status === 'pending_sync' || o.status === 'syncing'
        );


        if (!pending.length) {
          console.log(`[SyncService] Compte "${accountId}" — aucune commande pending`);
          continue;
        }

        console.log(`[SyncService] Compte "${accountId}" — ${pending.length} commande(s) à sync`);

        for (const order of pending) {

          // Marquer syncing
          await patchOrder(accountId, order.localId, { status: 'syncing' });

          try {
            const backendCustomer = await customersService.findOrCreate(
              shopId, order._customer
            );

            if (!backendCustomer?.id) {
              throw new Error('ID customer backend manquant après findOrCreate');
            }

            const orderPayload: Order = {
              customer           : Number(backendCustomer.id),
              currency           : currencyId,
              account            : order.account ?? null,
              order_amount       : order.order_amount,
              total_amount_order : order.total_amount_order,
              total_discount     : order.total_discount,
              balance            : order.balance,
              has_advance        : order.has_advance,
              payment_method     : order.payment_method,
              delivery           : order.delivery,
              reference_order    : generateOrderReference(),
              secure_key         : generateSecureKey(),
              has_delivery       : false,
              order_products     : order.order_products,
            };

            const created = await ordersService.createOrder(shopId, orderPayload);

            await patchOrder(accountId, order.localId, {
              status    : 'synced',
              serverId  : Number(created.id),
              syncError : undefined,
            });

            result.synced++;
            console.log(`[SyncService] ✅ ${order.localId} → serveur #${created.id}`);

          } catch (e: any) {
            const apiError = extractApiError(e);
            const msg      = apiError.message ?? 'Erreur inconnue';
            const attempts = (order.syncAttempts ?? 0) + 1;
            const giveUp   = attempts >= MAX_SYNC_ATTEMPTS;

            await patchOrder(accountId, order.localId, {
              status       : giveUp ? 'failed' : 'pending_sync',
              syncAttempts : attempts,
              syncError    : msg,
            });

            result.failed++;
            result.errors.push(`${order.localId}: ${msg}`);
            console.warn(
              `[SyncService] ❌ ${order.localId} — tentative ${attempts}/${MAX_SYNC_ATTEMPTS}: ${msg}`
            );
          }
        }
      }

    } finally {
      this._isSyncing = false;
    }

    console.log(`[SyncService] Terminé — ${result.synced} ok / ${result.failed} échec`);
    return result;
  },
};