// context/ProductContext.tsx

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { productsService } from '@/src/api/services/products.service';
import { useMultiAccount } from './MultiAccountContext';
import { useOffline } from './OfflineContext';
import type { Product, OfflineProduct } from '@/src/@types/models';
import { extractApiError } from '@/src/api/client';
import { getTokens } from './RefreshAccountContext';
import { isTokenExpired } from '@/utils/jwt';

// ✅ CHANGEMENT 3 — Import pour redémarrer l'app
// Si vous utilisez Expo :
import * as Updates from 'expo-updates';
// Si vous utilisez React Native bare, remplacez par :
// import RNRestart from 'react-native-restart';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiStatus = 'online' | 'offline' | 'unknown';

type ProductContextType = {
  products:        OfflineProduct[];
  loading:         boolean;
  hasMore:         boolean;
  refreshing:      boolean;
  currentPage:     number;
  apiStatus:       ApiStatus;
  isFromCache:     boolean;
  cacheAgeMinutes: number | null;

  loadProducts:    (page: number, refresh?: boolean) => Promise<void>;
  handleRefresh:   () => void;
  handleLoadMore:  () => void;
  setSearchQuery:  (query: string) => void;
  setCategoryId:   (id: string | undefined) => void;
  searchQuery:     string | undefined;
  categoryId:      string | undefined;
};

const ProductContext = createContext<ProductContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

type ProductProviderProps = {
  children:              ReactNode;
  initialLimit?:         number;
  retryIntervalMs?:      number;
  // ✅ CHANGEMENT 2 — Délai avant fallback cache sur erreur (défaut : 5 s)
  cacheLoadFallbackMs?:  number;
};

export const ProductProvider = ({
  children,
  initialLimit        = 2,
  retryIntervalMs     = 5000,
  cacheLoadFallbackMs = 5000,   // ✅ CHANGEMENT 2
}: ProductProviderProps) => {
  const { activeAccount, RefreshToken }  = useMultiAccount();

  const {
    isOnline,
    cachedProducts,
    cacheProducts,
    cacheAgeMinutes,
  } = useOffline();

  // ── State ─────────────────────────────────────────────────────────────────

  const [products,    setProducts]    = useState<OfflineProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [hasMore,     setHasMore]     = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryId,  setCategoryId]  = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const [apiStatus,   setApiStatus]   = useState<ApiStatus>('unknown');
  const [isFromCache, setIsFromCache] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────

  const cachedProductsRef  = useRef<OfflineProduct[]>(cachedProducts);
  const isOnlineRef        = useRef<boolean>(isOnline);
  const retryTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApiDownRef       = useRef(false);
  // ✅ CHANGEMENT 2 — Timer pour le fallback cache après erreur de chargement
  const cacheLoadTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchroniser les refs avec les valeurs du context
  useEffect(() => { cachedProductsRef.current = cachedProducts; }, [cachedProducts]);
  useEffect(() => { isOnlineRef.current       = isOnline;       }, [isOnline]);

  const shopId: string = activeAccount?.user?.shop?.[0]?.id ?? '';

  // ── Timers ────────────────────────────────────────────────────────────────

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ✅ CHANGEMENT 2 — Annuler le timer de fallback cache
  const clearCacheLoadTimer = useCallback(() => {
    if (cacheLoadTimerRef.current) {
      clearTimeout(cacheLoadTimerRef.current);
      cacheLoadTimerRef.current = null;
    }
  }, []);

  // ── loadProducts ──────────────────────────────────────────────────────────

  const loadProducts = useCallback(
    async (page: number, refresh = false) => {

      const online = isOnlineRef.current;
      const cached = cachedProductsRef.current;

      // ── CAS 1 : Hors ligne ────────────────────────────────────────────────
      if (!online) {
        console.info('[ProductContext] Hors ligne');
        setApiStatus('offline');
        setHasMore(false);
        setLoading(false);
        setRefreshing(false);

        if (cached.length > 0) {
          console.info(`[ProductContext] Cache disponible → ${cached.length} produits`);
          setProducts(cached);
          setIsFromCache(true);
        } else {
          console.warn('[ProductContext] Cache vide pour l\'instant — en attente...');
          setProducts([]);
        }
        return;
      }

      // ── CAS 2 : En ligne → fetch API ──────────────────────────────────────
      if (refresh) setLoading(true);

      try {
        const params = { page, per_page: initialLimit };
        let response: any;

        if (categoryId) {
          response = await productsService.getProductsByCategory(categoryId, params);
        } else if (searchQuery) {
          response = await productsService.searchProducts(searchQuery, params);
        } else {
          try {
            console.log("Fetching products with params : ", params);
            response = await productsService.getProductsByShop(shopId, params);

          } catch (e) {
            console.log("ERREUR DE CHARGEMENT DE PROD : ", e);
            const error = extractApiError(e);
            console.log("Les erreurs : " + JSON.stringify(error));

            // ✅ CHANGEMENT 2 — Fallback cache après délai si les produits
            //    ne se chargent pas suite à cette erreur
            clearCacheLoadTimer();
            cacheLoadTimerRef.current = setTimeout(() => {
              const cachedNow = cachedProductsRef.current;
              if (cachedNow.length > 0) {
                console.info(
                  `[ProductContext] Fallback cache après ${cacheLoadFallbackMs}ms d'erreur → ${cachedNow.length} produits`
                );
                setProducts(cachedNow);
                setIsFromCache(true);
                setLoading(false);
                setRefreshing(false);
              }
            }, cacheLoadFallbackMs);

            // Vérifier le compte avant tout
            if (!activeAccount?.id) {
              console.warn("[ProductContext] No active account, skipping refresh.");
              return;
            }

            console.log("Account Act: " + activeAccount.id);

            // Récupérer les tokens
            const tokens = await getTokens(String(activeAccount.id));

            if (!tokens) {
              console.warn("[ProductContext] No tokens found for account.");
              return;
            }

            // ✅ CHANGEMENT 3 — Token expiré → redémarrer l'app
            //    au lieu de le regénérer silencieusement
            if (tokens.isExpired && !activeAccount.id) {
              console.warn(
                "[ProductContext] Token expiré → redémarrage de l'application"
              );
              try {
                // Expo — recharge le bundle JS proprement
                await Updates.reloadAsync();
              } catch {
                // Fallback bare React Native :
                // RNRestart.Restart();
                console.error(
                  "[ProductContext] Impossible de redémarrer via Updates," +
                  " vérifiez votre setup (expo-updates / react-native-restart)."
                );
              }
              return; // ne pas continuer après le redémarrage
            }
          }
        }

        // API répond → remettre le flag online
        if (isApiDownRef.current) {
          console.info('[ProductContext] API de nouveau en ligne ✅');
          isApiDownRef.current = false;
        }
        setApiStatus('online');
        clearRetryTimer();
        // ✅ CHANGEMENT 2 — Annuler le fallback cache puisque les données arrivent
        clearCacheLoadTimer();

        // Extraire les données brutes
        let rawData: Product[] = [];
        let totalPages         = 1;
        let currentPageFromApi = page;

        if (Array.isArray(response)) {
          rawData = response;
        } else if (response && typeof response === 'object') {
          rawData = Array.isArray(response.data)        ? response.data
                  : Array.isArray(response.data?.data)  ? response.data.data
                  : [];
          totalPages =
            response.total_pages      ||
            response.last_page         ||
            response.meta?.last_page   ||
            response.meta?.total_pages || 1;
          currentPageFromApi =
            response.current_page      ||
            response.meta?.current_page || page;
        }

        // Afficher IMMÉDIATEMENT les données (sans images locales)
        const immediate: OfflineProduct[] = rawData.map((p) => ({
          ...p,
          images:          Array.isArray(p.images) ? p.images : [],
          localImages:     [],
          coverImageLocal: '',
          cachedAt:        Date.now(),
        }));

        if (refresh) {
          // ✅ CHANGEMENT 1 — On remplace les produits (cache ou vide) SEULEMENT
          //    ici, une fois les données API reçues avec succès.
          setProducts(immediate);
          setCurrentPage(1);
        } else {
          setProducts((prev) => [...prev, ...immediate]);
          setCurrentPage(currentPageFromApi);
        }

        setHasMore(currentPageFromApi < totalPages);
        setIsFromCache(false);

        // Sauvegarder en cache EN ARRIÈRE-PLAN (télécharge les images)
        cacheProducts(rawData).catch((e) =>
          console.warn('[ProductContext] Cache offline :', e?.message)
        );

      } catch (error: any) {
        const status        = error?.response?.status ?? error?.status;
        const isServerError = !status || status === 0 || status >= 500;

        if (isServerError) {
          console.error(`[ProductContext] API indisponible (${status ?? 'réseau'})`);
          isApiDownRef.current = true;
          setApiStatus('offline');

          // Fallback cache immédiat sur erreur serveur
          const cached = cachedProductsRef.current;
          if (cached.length > 0) {
            console.info('[ProductContext] Fallback → cache');
            setProducts(cached);
            setIsFromCache(true);
            setHasMore(false);
          } else if (refresh) {
            setProducts([]);
          }

          // Retry auto
          clearRetryTimer();
          retryTimerRef.current = setTimeout(
            () => loadProducts(page, true),
            retryIntervalMs
          );
        } else {
          console.error(`[ProductContext] Erreur ${status}`);
          setApiStatus('online');
          if (refresh) setProducts([]);
        }
      } finally {
        setLoading(false);
        if (refresh) setRefreshing(false);
      }
    },
    [
      categoryId, searchQuery, initialLimit, shopId,
      cacheProducts, clearRetryTimer, clearCacheLoadTimer,
      retryIntervalMs, cacheLoadFallbackMs,
      activeAccount?.id,
    ]
  );

  // ── Réagir quand le cache se charge (cas offline au démarrage) ────────────

  useEffect(() => {
    if (cachedProducts.length === 0) return;

    if (!isOnline) {
      console.info(`[ProductContext] Cache chargé hors ligne → ${cachedProducts.length} produits`);
      setProducts(cachedProducts);
      setIsFromCache(true);
      setLoading(false);
    } else if (isFromCache) {
      setProducts(cachedProducts);
    } else {
      // En ligne, cache mis à jour (images téléchargées) → patch localImages uniquement
      setProducts((prev) =>
        prev.map((p) => {
          const cached = cachedProducts.find((c) => c.id === p.id);
          if (cached && cached.localImages.length > 0) {
            return { ...p, localImages: cached.localImages };
          }
          return p;
        })
      );
    }
  }, [cachedProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Réagir quand la connexion revient ─────────────────────────────────────
  // ✅ CHANGEMENT 1 — On NE vide PLUS les produits ici.
  //    Le cache reste affiché jusqu'à ce que l'API réponde avec succès.

  useEffect(() => {
    if (isOnline && isFromCache) {
      console.info(
        '[ProductContext] Connexion revenue → re-fetch API' +
        ' (cache conservé jusqu\'au retour des données)'
      );
      clearRetryTimer();
      setRefreshing(true);
      setLoading(true);
      setHasMore(true);
      // ✅ Pas de setProducts([]) → le cache reste visible pendant le fetch
      loadProducts(1, true);
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Charger au montage et quand les filtres/compte changent ──────────────

  useEffect(() => {
    setLoading(true);
    // ✅ Pas de setProducts([]) — le cache offline reste affiché
    //    pendant toute la durée du fetch initial (filtres, changement de compte…).
    //    Les produits ne sont remplacés que dans loadProducts au succès de l'API.
    setCurrentPage(1);
    setHasMore(true);
    setIsFromCache(false);
    loadProducts(1, true);
    return () => {
      clearRetryTimer();
      clearCacheLoadTimer();
    };
  }, [categoryId, searchQuery, initialLimit, activeAccount?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    clearRetryTimer();
    clearCacheLoadTimer();
    setRefreshing(true);
    setLoading(true);
    // ✅ Pas de setProducts([]) — le cache offline reste affiché
    //    jusqu'à ce que l'API retourne les produits avec succès.
    setHasMore(true);
    setIsFromCache(false);
    loadProducts(1, true);
  }, [loadProducts, clearRetryTimer, clearCacheLoadTimer]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) loadProducts(currentPage + 1, false);
  }, [hasMore, loading, currentPage, loadProducts]);

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        hasMore,
        refreshing,
        currentPage,
        apiStatus,
        isFromCache,
        cacheAgeMinutes,
        loadProducts,
        handleRefresh,
        handleLoadMore,
        setSearchQuery,
        setCategoryId,
        searchQuery,
        categoryId,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useProducts = (): ProductContextType => {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used within a ProductProvider');
  return context;
};