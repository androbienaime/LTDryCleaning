import { useOffline } from '@/context/OfflineContext';
 
export function useNetworkStatus() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncResult,
    syncNow,
  } = useOffline();
 
  return {
    isOnline,          // true/false
    isOffline: !isOnline,
    isSyncing,         // true pendant une sync en cours
    pendingCount,      // nombre de commandes en attente de sync
    lastSyncResult,    // { synced: 2, failed: 0 } ou null
    syncNow,           // déclencher manuellement une sync
  };
}