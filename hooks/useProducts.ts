// hooks/useProducts.ts
// Hook produits : fetch API → fallback cache si hors ligne.
// Hook commande : en ligne direct → hors ligne automatique si pas de réseau.

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/context/OfflineContext';
import { useMultiAccount } from '@/context/MultiAccountContext';
import apiClient from '@/src/api/client';
import type { OfflineProduct, OrderItem } from '@/src/@types/models';

// ═══════════════════════════════════════════════════════════
// useProducts — liste des produits avec fallback offline
// ═══════════════════════════════════════════════════════════

type UseProductsOptions = {
  autoFetch?:           boolean; // fetch au montage (défaut: true)
  maxCacheAgeMinutes?:  number;  // re-fetch si cache plus vieux que N min (défaut: 60)
};

type UseProductsReturn = {
  products:        OfflineProduct[];
  isLoading:       boolean;
  loading:         boolean;        // alias de isLoading pour compatibilité
  isFromCache:     boolean;
  error:           string | null;
  cacheAgeMinutes: number | null;
  refresh:         () => Promise<void>;
  // Propriétés additionnelles pour la liste
  hasMore:         boolean;
  refreshing:      boolean;
  handleRefresh:   () => Promise<void>;
  handleLoadMore:  () => void;
  apiStatus:       string;
};

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const { autoFetch = true, maxCacheAgeMinutes = 60 } = options;

  const { isOnline, cachedProducts, cacheProducts, cacheAgeMinutes } = useOffline();
  const { activeAccount } = useMultiAccount();

  const [products,    setProducts]    = useState<OfflineProduct[]>(cachedProducts);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const fetchFromApi = useCallback(async () => {
    // ── Hors ligne → cache direct ──────────────────────────────────────────
    if (!isOnline) {
      setProducts(cachedProducts);
      setIsFromCache(true);
      if (!cachedProducts.length)
        setError('Hors ligne et aucun cache disponible.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const raw  = await apiClient.get<any>('/products');
      const list: any[] = raw?.data ?? raw?.products ?? (Array.isArray(raw) ? raw : []);

      // Sauvegarder en cache + télécharger les images
      const saved = await cacheProducts(list).then(() => list);

      // Utiliser les produits du cache (avec chemins images locaux)
      setProducts(cachedProducts.length ? cachedProducts : list as any);
      setIsFromCache(false);
    } catch (e: any) {
      if (cachedProducts.length) {
        setProducts(cachedProducts);
        setIsFromCache(true);
        setError('Impossible de rafraîchir — données en cache affichées.');
      } else {
        setError(e?.message ?? 'Impossible de charger les produits.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, cachedProducts, cacheProducts]);

  // Mettre à jour l'affichage quand le cache change (après téléchargement images)
  useEffect(() => {
    if (cachedProducts.length) setProducts(cachedProducts);
  }, [cachedProducts]);

  // Fetch automatique au montage ou au changement de compte
  useEffect(() => {
    if (!autoFetch) return;
    const stale = cacheAgeMinutes === null || cacheAgeMinutes > maxCacheAgeMinutes;
    if (stale || !cachedProducts.length) {
      fetchFromApi();
    } else {
      setProducts(cachedProducts);
      setIsFromCache(true);
    }
  }, [activeAccount?.id]);

  return {
    products,
    isLoading,
    loading: isLoading,
    isFromCache,
    error,
    cacheAgeMinutes,
    refresh: fetchFromApi,
    // Propriétés additionnelles pour la liste
    hasMore: false,
    refreshing: false,
    handleRefresh: fetchFromApi,
    handleLoadMore: () => {},
    apiStatus: isOnline ? 'online' : 'offline',
  };
}

// ═══════════════════════════════════════════════════════════
// useOrder — passer une commande (online ou offline auto)
// ═══════════════════════════════════════════════════════════

type PlaceOrderOptions = { address?: string; note?: string };

type PlaceOrderResult = {
  success:   boolean;
  isOffline: boolean;
  orderId?:  string;
};

type UseOrderReturn = {
  placeOrder: (items: OrderItem[], opts?: PlaceOrderOptions) => Promise<PlaceOrderResult>;
  isPlacing:  boolean;
  error:      string | null;
};

export function useOrder(): UseOrderReturn {
  const { isOnline, createOfflineOrder } = useOffline();
  const [isPlacing, setIsPlacing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const placeOrder = async (
    items: OrderItem[],
    opts?: PlaceOrderOptions
  ): Promise<PlaceOrderResult> => {
    setIsPlacing(true);
    setError(null);

    try {
      if (isOnline) {
        // ── En ligne : envoyer directement au backend ──────────────────────
        const response = await apiClient.post<any>('/orders', {
          items: items.map((i) => ({
            product_id:     i.product_id,
            quantity:       i.quantity,
            declination_id: i.declination_id,
          })),
          ...opts,
        });
        const orderId = String(response?.data?.id ?? response?.id ?? '');
        return { success: true, isOffline: false, orderId };
      }

      // ── Hors ligne : sauvegarder localement + sync plus tard ───────────
      const order = await createOfflineOrder(items, opts);
      return { success: true, isOffline: true, orderId: order.localId };

    } catch (e: any) {
      // Erreur réseau même si isOnline → fallback offline
      try {
        const order = await createOfflineOrder(items, opts);
        return { success: true, isOffline: true, orderId: order.localId };
      } catch {
        const msg = e?.message ?? 'Impossible de passer la commande.';
        setError(msg);
        return { success: false, isOffline: false };
      }
    } finally {
      setIsPlacing(false);
    }
  };

  return { placeOrder, isPlacing, error };
}