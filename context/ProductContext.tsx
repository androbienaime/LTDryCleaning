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
  children:         ReactNode;
  initialLimit?:    number;
  retryIntervalMs?: number;
};

export const ProductProvider = ({
  children,
  initialLimit    = 2,
  retryIntervalMs = 5000,
}: ProductProviderProps) => {
  const { activeAccount, RefreshToken }  = useMultiAccount();

  const {
    isOnline,
    cachedProducts,
    cacheProducts,
    cacheAgeMinutes,
  } = useOffline();

  // console.log("Cache ", cachedProducts);
  // Debug info: offlineStorage is not available in this context.
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

  // ✅ FIX CLÉ : stocker cachedProducts dans un ref pour que loadProducts
  // puisse toujours lire la valeur courante SANS être dans ses dépendances.
  // Cela évite la boucle infinie :
  //   cachedProducts change → loadProducts recrée → useEffect relance loadProducts
  const cachedProductsRef = useRef<OfflineProduct[]>(cachedProducts);
  const isOnlineRef       = useRef<boolean>(isOnline);
  const retryTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApiDownRef      = useRef(false);

  // Synchroniser les refs avec les valeurs du context
  useEffect(() => { cachedProductsRef.current = cachedProducts; }, [cachedProducts]);
  useEffect(() => { isOnlineRef.current       = isOnline;       }, [isOnline]);

  const shopId: string = activeAccount?.user?.shop?.[0]?.id ?? '';

  // ── Timer ─────────────────────────────────────────────────────────────────

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── loadProducts (deps stables grâce aux refs) ────────────────────────────

  const loadProducts = useCallback(
    async (page: number, refresh = false) => {

      // Lire les valeurs courantes via refs (pas de dépendance → pas de boucle)
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
          // Cache vide → on attend que OfflineContext finisse de charger
          // (le useEffect sur cachedProducts prendra le relais)
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
          try{
            console.log("Fetching products with params : ", params);
            response = await productsService.getProductsByShop(shopId, params);
          
          }catch(e){
            console.log("ERREUR DE CHARGEMENT DE PROD : ", e);
            const error = extractApiError(e);
            console.log("Les erreurs : " + JSON.stringify(error));
            
            // ✅ 1. Vérifier le compte avant tout
            if (!activeAccount?.id) {
              console.warn("[ProductContext] No active account, skipping refresh.");
              return;
            }


            // ✅ 2. Récupérer les tokens
            const tokens = await getTokens(String(activeAccount.id));

            // ✅ 3. Vérifier que les tokens existent
            if (!tokens) {
              console.warn("[ProductContext] No tokens found for account.");
              return;
            }

            // ✅ 4. Utiliser isExpired déjà calculé, pas besoin de rappeler isTokenExpired
            if (tokens.isExpired) {
              console.log("[ProductContext] Token expired, regenerating...");
              await RefreshToken?.(
                String(activeAccount.id),
                tokens.token,
                tokens.refreshToken
              );
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

        // ✅ Afficher IMMÉDIATEMENT les données (sans images locales)
        const immediate: OfflineProduct[] = rawData.map((p) => ({
          ...p,
          images:          Array.isArray(p.images) ? p.images : [],
          localImages:     [], // rempli en arrière-plan par cacheProducts
          coverImageLocal: '',
          cachedAt:        Date.now(),
        }));

        if (refresh) {
          setProducts(immediate);
          setCurrentPage(1);
        } else {
          setProducts((prev) => [...prev, ...immediate]);
          setCurrentPage(currentPageFromApi);
        }

        setHasMore(currentPageFromApi < totalPages);
        setIsFromCache(false);

        // ✅ Sauvegarder en cache EN ARRIÈRE-PLAN (télécharge les images)
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

          // Fallback cache
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
    // ✅ Deps stables : pas de cachedProducts ni isOnline (lus via refs)
    [categoryId, searchQuery, initialLimit, shopId, cacheProducts, clearRetryTimer, retryIntervalMs]
  );

  // ── Réagir quand le cache se charge (cas offline au démarrage) ────────────
  // OfflineContext charge AsyncStorage de façon async. Quand cachedProducts
  // passe de [] à [produits...], on met à jour l'affichage.

  useEffect(() => {
    if (cachedProducts.length === 0) return;

    if (!isOnline) {
      // Hors ligne ET cache vient de se charger → afficher
      console.info(`[ProductContext] Cache chargé hors ligne → ${cachedProducts.length} produits`);
      setProducts(cachedProducts);
      setIsFromCache(true);
      setLoading(false);
    } else if (isFromCache) {
      // Était en cache, cache mis à jour → rafraîchir
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
  // Si on était hors ligne et affichait le cache, re-fetcher depuis l'API

  useEffect(() => {
    if (isOnline && isFromCache) {
      console.info('[ProductContext] Connexion revenue → re-fetch API');
      handleRefresh();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Charger au montage et quand les filtres/compte changent ──────────────

  useEffect(() => {
    setLoading(true);
    setProducts([]);
    setCurrentPage(1);
    setHasMore(true);
    setIsFromCache(false);
    loadProducts(1, true);
    return () => clearRetryTimer();
  }, [categoryId, searchQuery, initialLimit, activeAccount?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    clearRetryTimer();
    setRefreshing(true);
    setLoading(true);
    setProducts([]);    // ← ✅ vide les produits → skeleton s'affiche
    setHasMore(true);
    setIsFromCache(false);
    loadProducts(1, true);
  }, [loadProducts, clearRetryTimer]);

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