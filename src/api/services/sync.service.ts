// src/api/services/sync_service.ts
// Synchronise les commandes hors ligne avec le serveur dès que l'internet revient.
// Écoute NetInfo et traite la SyncQueue.
// Dépend de : @react-native-community/netinfo

import NetInfo from '@react-native-community/netinfo';
import apiClient from '@/src/api/client';
import { OrderOfflineStorage, SyncQueue } from '@/utils/offlineStorage';
import type { SyncResult } from '@/src/@types/models';

const MAX_SYNC_ATTEMPTS = 5;

export const SyncService = {
  _unsubscribe: null as (() => void) | null,
  _isSyncing: false,

  // Démarrer l'écoute réseau — appeler dans App.js au montage
  startListening(onComplete?: (result: SyncResult) => void): void {
    if (this._unsubscribe) return; // déjà actif

    this._unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      if (online) {
        console.log('[SyncService] Connexion détectée → synchronisation');
        const result = await this.syncAll();
        onComplete?.(result);
      }
    });

    console.log('[SyncService] Écoute réseau démarrée');
  },

  stopListening(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
  },

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable);
  },

  // Envoyer toutes les commandes en attente au serveur
  async syncAll(): Promise<SyncResult> {
    if (this._isSyncing) return { synced: 0, failed: 0, errors: [] };

    this._isSyncing = true;
    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    try {
      const queue = await SyncQueue.getAll();
      if (!queue.length) return result;

      console.log(`[SyncService] ${queue.length} commande(s) à synchroniser`);

      for (const { localId, accountId } of queue) {

        // Marquer comme "en cours de sync"
        await OrderOfflineStorage.updateOrderStatus(accountId, localId, {
          status: 'syncing',
        });

        try {
          const orders  = await OrderOfflineStorage.getOrders(accountId);
          const order   = orders.find((o) => o.localId === localId);
          if (!order) { await SyncQueue.remove(localId); continue; }

          // Envoyer la commande au backend
          const response = await apiClient.post<any>('/orders', {
            items:   order.items.map((i) => ({
              product_id:     i.product_id,
              quantity:       i.quantity,
              declination_id: i.declination_id,
            })),
            address: order.address,
            note:    order.note,
          });

          const serverId: number = response?.data?.id ?? response?.id;

          await OrderOfflineStorage.updateOrderStatus(accountId, localId, {
            status:   'synced',
            serverId,
            syncError: undefined,
          });

          await SyncQueue.remove(localId);
          result.synced++;
          console.log(`[SyncService] ✅ ${localId} → serveur #${serverId}`);

        } catch (e: any) {
          const msg = e?.message ?? 'Erreur inconnue';
          const orders = await OrderOfflineStorage.getOrders(accountId);
          const order  = orders.find((o) => o.localId === localId);
          const attempts = (order?.syncAttempts ?? 0) + 1;
          const failed   = attempts >= MAX_SYNC_ATTEMPTS;

          await OrderOfflineStorage.updateOrderStatus(accountId, localId, {
            status:       failed ? 'failed' : 'pending_sync',
            syncAttempts: attempts,
            syncError:    msg,
          });

          if (failed) {
            await SyncQueue.remove(localId);
            console.warn(`[SyncService] ❌ ${localId} abandonné (${attempts} tentatives)`);
          }

          result.failed++;
          result.errors.push(`${localId}: ${msg}`);
        }
      }
    } finally {
      this._isSyncing = false;
    }

    console.log(`[SyncService] Fin — ${result.synced} ok, ${result.failed} échec`);
    return result;
  },
};