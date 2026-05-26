// context/OfflineContext.tsx
// Gère l'état hors ligne : produits cachés, commandes en attente, sync auto.
// Doit être placé sous AuthProvider dans App.js.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useMultiAccount } from '@/context/MultiAccountContext';
import { ProductOfflineStorage, OrderOfflineStorage } from '@/utils/offlineStorage';
import { SyncService } from '@/src/api/services/sync.service';
import type { OfflineProduct, OfflineOrder, OrderItem, SyncResult } from '@/src/@types/models';

// ─── Types du context ─────────────────────────────────────────────────────────

type OfflineContextType = {
  // Réseau
  isOnline:          boolean;

  // Produits
  cachedProducts:    OfflineProduct[];
  isCachingProducts: boolean;
  cacheAgeMinutes:   number | null;
  cacheProducts:     (products: any[]) => Promise<void>;
  clearProductCache: () => Promise<void>;

  // Commandes
  allOrders:           OfflineOrder[];
  pendingOrders:       OfflineOrder[];
  pendingCount:        number;
  createOfflineOrder:  (items: OrderItem[], opts?: { address?: string; note?: string }) => Promise<OfflineOrder>;

  // Sync
  isSyncing:        boolean;
  lastSyncResult:   { synced: number; failed: number } | null;
  syncNow:          () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  cachedProducts: [], isCachingProducts: false, cacheAgeMinutes: null,
  cacheProducts: async () => {}, clearProductCache: async () => {},
  allOrders: [], pendingOrders: [], pendingCount: 0,
  createOfflineOrder: async () => { throw new Error('Not initialized'); },
  isSyncing: false, lastSyncResult: null, syncNow: async () => {},
});

export const useOffline = () => useContext(OfflineContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeAccount } = useMultiAccount();
  const accountId = activeAccount?.id ?? null;

  const [isOnline,          setIsOnline]          = useState(true);
  const [cachedProducts,    setCachedProducts]    = useState<OfflineProduct[]>([]);
  const [isCachingProducts, setIsCachingProducts] = useState(false);
  const [cacheAgeMinutes,   setCacheAgeMinutes]   = useState<number | null>(null);
  const [allOrders,         setAllOrders]         = useState<OfflineOrder[]>([]);
  const [isSyncing,         setIsSyncing]         = useState(false);
  const [lastSyncResult,    setLastSyncResult]    = useState<{ synced: number; failed: number } | null>(null);

  // ── Charger les données quand le compte change ────────────────────────────

  const loadData = useCallback(async () => {
    if (!accountId) {
      setCachedProducts([]); setAllOrders([]); setCacheAgeMinutes(null);
      return;
    }
    const [products, orders, age] = await Promise.all([
      ProductOfflineStorage.getProducts(accountId),
      OrderOfflineStorage.getOrders(accountId),
      ProductOfflineStorage.getCacheAgeMinutes(accountId),

    ]);
    setCachedProducts(products);
    setAllOrders(orders);
    setCacheAgeMinutes(age);
  }, [accountId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Surveiller le réseau ──────────────────────────────────────────────────

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnline(online);
      if (online && accountId) handleSync();
    });
    return () => unsub();
  }, [accountId]);

  // ── Synchronisation ───────────────────────────────────────────────────────

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await SyncService.syncAll();
      setLastSyncResult({ synced: result.synced, failed: result.failed });
      if (accountId) {
        setAllOrders(await OrderOfflineStorage.getOrders(accountId));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Actions produits ──────────────────────────────────────────────────────

  const cacheProducts = async (products: any[]) => {
    if (!accountId) return;
    setIsCachingProducts(true);
    try {
      const saved = await ProductOfflineStorage.saveProducts(accountId, products);
      setCachedProducts(saved);
      setCacheAgeMinutes(0);
    } finally {
      setIsCachingProducts(false);
    }
  };

  const clearProductCache = async () => {
    if (!accountId) return;
    await ProductOfflineStorage.clearProducts(accountId);
    setCachedProducts([]);
    setCacheAgeMinutes(null);
  };

  // ── Actions commandes ─────────────────────────────────────────────────────

  const createOfflineOrder = async (
    items: OrderItem[],
    opts?: { address?: string; note?: string }
  ): Promise<OfflineOrder> => {
    if (!accountId) throw new Error('Aucun compte actif');
    const order = await OrderOfflineStorage.createOrder(accountId, items, opts);
    setAllOrders(await OrderOfflineStorage.getOrders(accountId));
    if (isOnline) handleSync(); // tentative immédiate si connecté
    return order;
  };

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const pendingOrders = allOrders.filter(
    (o) => o.status === 'pending_sync' || o.status === 'failed'
  );

  return (
    <OfflineContext.Provider value={{
      isOnline,
      cachedProducts, isCachingProducts, cacheAgeMinutes,
      cacheProducts, clearProductCache,
      allOrders, pendingOrders, pendingCount: pendingOrders.length,
      createOfflineOrder,
      isSyncing, lastSyncResult, syncNow: handleSync,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export default OfflineProvider;