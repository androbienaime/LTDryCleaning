// src/api/services/sync.service.ts
//
// Synchronise les commandes OfflineOrder avec le serveur dès que le réseau revient.
// Appeler SyncService.startListening() UNE SEULE FOIS dans App.tsx au montage.

import NetInfo from '@react-native-community/netinfo';
import { MultiAccountStorage } from '@/utils/multiAccountStorage';
import { OrderOfflineStorage, SyncQueue } from '@/utils/offlineStorage';
import { customersService } from '@/src/api/services/customers.services';
import { ordersService, generateOrderReference, generateSecureKey } from '@/src/api/services/orders.services';
import type { OfflineOrder, Order, SyncResult } from '@/src/@types/models';

const MAX_SYNC_ATTEMPTS = 5;

export const SyncService = {
  _unsubscribe: null as (() => void) | null,
  _isSyncing:   false,

  // ── Listener réseau ───────────────────────────────────────────────────────
  // À appeler UNE SEULE FOIS dans App.tsx au montage de l'app.

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

  // ── Synchronisation de toutes les commandes en attente ────────────────────
  // Parcourt tous les comptes enregistrés et synchronise leurs commandes offline.
  // Peut aussi être appelé manuellement depuis l'UI.

  async syncAll(): Promise<SyncResult> {
    if (this._isSyncing) return { synced: 0, failed: 0, errors: [] };

    this._isSyncing = true;
    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    try {
      const store = await MultiAccountStorage.getStore();
      if (!store?.accounts?.length) return result;

      for (const account of store.accounts) {
        const accountId  = account.id;
        const shopId     = account.user?.shop?.[0]?.id;
        const currencyId = 3; // account.user?.shop?.[0]?.currency?.id ?? 3

        if (!shopId) {
          console.warn(`[SyncService] Compte ${accountId} sans shopId — ignoré`);
          continue;
        }

        const pending = await OrderOfflineStorage.getPendingOrders(accountId);
        if (!pending.length) continue;

        console.log(`[SyncService] ${pending.length} commande(s) à sync — compte ${accountId}`);

        for (const order of pending) {
          // Marquer comme en cours
          await OrderOfflineStorage.patchOrder(accountId, order.localId, {
            status: 'syncing',
          });

          try {
            // 1. Résoudre le customer via findOrCreate
            const backendCustomer = await customersService.findOrCreate(
              shopId,
              order._customer
            );

            if (!backendCustomer?.id) {
              throw new Error('ID customer backend manquant après findOrCreate');
            }

            // 2. Créer la commande — l'order offline a déjà la shape Order,
            //    on remplace juste customer par l'ID backend résolu.
            const orderPayload: Order = {
              customer:           Number(backendCustomer.id),
              currency:           currencyId,
              account:            order.account,
              order_amount:       order.order_amount,
              total_amount_order: order.total_amount_order,
              reference_order:    generateOrderReference(),
              secure_key:         generateSecureKey(),
              has_delivery:       false,
              balance:            0,
              total_discount:     0,
              order_products:     order.order_products,
            };
            const created = await ordersService.createOrder(shopId, orderPayload);

            await OrderOfflineStorage.patchOrder(accountId, order.localId, {
              status:    'synced',
              serverId:  Number(created.id),
              syncError: undefined,
            });
            await SyncQueue.remove(order.localId);

            result.synced++;
            console.log(`[SyncService] ✅ ${order.localId} → serveur #${created.id}`);

          } catch (e: any) {
            const msg      = e?.message ?? 'Erreur inconnue';
            const attempts = (order.syncAttempts ?? 0) + 1;
            const giveUp   = attempts >= MAX_SYNC_ATTEMPTS;

            await OrderOfflineStorage.patchOrder(accountId, order.localId, {
              status:       giveUp ? 'failed' : 'pending_sync',
              syncAttempts: attempts,
              syncError:    msg,
            });

            if (giveUp) await SyncQueue.remove(order.localId);

            result.failed++;
            result.errors.push(`${order.localId}: ${msg}`);
            console.warn(`[SyncService] ❌ ${order.localId} — tentative ${attempts}/${MAX_SYNC_ATTEMPTS}: ${msg}`);
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