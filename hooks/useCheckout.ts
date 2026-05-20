// hooks/useCheckout.ts

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '@/context/CartContext';
import { useMultiAccount } from '@/context/MultiAccountContext';
import { useProducts } from '@/context/ProductContext';
import {
  ordersService,
  generateOrderReference,
  generateSecureKey,
  cartItemsToOrderProducts,
  itemSubTotal,
} from '@/src/api/services/orders.services';
import { customersService } from '@/src/api/services/customers.services';
import { SyncService } from '@/src/api/services/sync.service';
import { extractApiError } from '@/src/api/client';
import { CustomerStorage, PhoneContacts } from '@/utils/customerStorage';
import { Customer, OfflineOrder, CartItem, Order, DeliveryPayload, buildDeliveryPayload } from '@/src/@types/models';

// ─── Constantes ───────────────────────────────────────────────────────────────

const OFFLINE_ORDERS_KEY = (accountId: string) =>
  `@offline_delivery_orders:${accountId}`;

function generateLocalId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckoutStep = 'customer' | 'date' | 'summary';

export type PlaceOrderResult = {
  success:   boolean;
  isOffline: boolean;
  orderId?:  string | number;
  message:   string;
};

export type UseCheckoutReturn = {
  step:     CheckoutStep;
  setStep:  (s: CheckoutStep) => void;

  customers:           Customer[];
  phoneContacts:       Customer[];
  contactsLoading:     boolean;
  selectedCustomer:    Customer | null;
  selectCustomer:      (c: Customer) => void;
  newCustomer:         Partial<Customer>;
  setNewCustomerField: (field: keyof Customer, value: string) => void;
  saveNewCustomer:     (saveToPhone?: boolean) => Promise<Customer | null>;
  searchContacts:      (query: string) => void;
  contactSearch:       string;
  filteredContacts:    Customer[];

  deliveryDate:    Date;
  setDeliveryDate: (d: Date) => void;
  deliveryTime:    string;
  setDeliveryTime: (t: string) => void;

  note:    string;
  setNote: (n: string) => void;

  computedTotal: number;
  isCalculating: boolean;
  recalculate:   () => Promise<void>;

  isPlacing:     boolean;
  placeOrder:    () => Promise<PlaceOrderResult>;
  offlineOrders: OfflineOrder[];
  syncPending:   () => Promise<void>;
  isSyncing:     boolean;

  canProceed: boolean;
  errors:     Record<string, string>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckout(): UseCheckoutReturn {
  const { cartItems, totalAmount, clearCart } = useCart();
  const { activeAccount }                     = useMultiAccount();
  const { apiStatus }                         = useProducts();

  // accountId        → UUID local (clé AsyncStorage)
  // backendAccountId → ID numérique du compte dans la BDD (envoyé à l'API)
  const accountId        = activeAccount?.id             ?? '';
  const backendAccountId = activeAccount?.user?.id       ?? null;
  const shopId           = activeAccount?.user?.shop?.[0]?.id ?? '';
  const currencyId       = 3; // activeAccount?.user?.shop?.[0]?.currency?.id ?? 3
  const apiOk            = apiStatus !== 'offline';

  // ── Step ──────────────────────────────────────────────────────────────────

  const [step, setStep] = useState<CheckoutStep>('customer');

  // ── Customers ─────────────────────────────────────────────────────────────

  const [customers,        setCustomers]        = useState<Customer[]>([]);
  const [phoneContacts,    setPhoneContacts]    = useState<Customer[]>([]);
  const [contactsLoading,  setContactsLoading]  = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer,      setNewCustomer]      = useState<Partial<Customer>>({});
  const [contactSearch,    setContactSearch]    = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Customer[]>([]);
  const [errors,           setErrors]           = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accountId) return;
    CustomerStorage.getAll(accountId).then(setCustomers);
    setContactsLoading(true);
    PhoneContacts.getAll()
      .then((c) => { setPhoneContacts(c); setFilteredContacts(c); })
      .finally(() => setContactsLoading(false));
  }, [accountId]);

  const selectCustomer = (c: Customer) => setSelectedCustomer(c);

  const setNewCustomerField = (field: keyof Customer, value: string) => {
    setNewCustomer((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field as string]; return e; });
  };

  const saveNewCustomer = async (saveToPhone = false): Promise<Customer | null> => {
    if (!newCustomer.name || !newCustomer.phone) {
      setErrors((prev) => ({
        ...prev,
        ...(!newCustomer.name  ? { name:  'Le nom est requis' }  : {}),
        ...(!newCustomer.phone ? { phone: 'Le téléphone est requis' } : {}),
      }));
      return null;
    }

    let contactId: string | null = null;
    if (saveToPhone) {
      contactId = await PhoneContacts.saveToContacts({
        ...newCustomer as Customer,
        firstname: newCustomer.firstname ?? newCustomer.name.split(' ')[0]          ?? '',
        lastname:  newCustomer.lastname  ?? newCustomer.name.split(' ').slice(-1)[0] ?? '',
      });
    }

    const saved = await CustomerStorage.save(accountId, {
      ...newCustomer as Customer,
      savedToContacts: saveToPhone && !!contactId,
      contactId:       contactId ?? undefined,
    });

    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      return idx >= 0 ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
    });
    setSelectedCustomer(saved);
    setNewCustomer({});
    return saved;
  };

  const searchContacts = useCallback((query: string) => {
    setContactSearch(query);
    if (!query.trim()) { setFilteredContacts(phoneContacts); return; }
    const q = query.toLowerCase();
    setFilteredContacts(
      phoneContacts.filter(
        (c) =>
          (c.name      ?? '').toLowerCase().includes(q) ||
          (c.firstname ?? '').toLowerCase().includes(q) ||
          (c.lastname  ?? '').toLowerCase().includes(q) ||
          c.phone.includes(q)
      )
    );
  }, [phoneContacts]);

  // ── Date ──────────────────────────────────────────────────────────────────

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [deliveryDate, setDeliveryDate] = useState<Date>(tomorrow);
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00');

  // ── Note ──────────────────────────────────────────────────────────────────

  const [note, setNote] = useState('');

  // ── Total calculé ─────────────────────────────────────────────────────────

  const [computedTotal, setComputedTotal] = useState<number>(totalAmount);
  const [isCalculating, setIsCalculating] = useState(false);

  const recalculate = useCallback(async () => {
    if (cartItems.length === 0) { setComputedTotal(0); return; }

    // Calcul local immédiat
    const localTotal = cartItems.reduce((sum, item) => sum + itemSubTotal(item), 0);
    setComputedTotal(localTotal);

    // Recalcul serveur si online (peut inclure coupons, livraison, etc.)
    if (!apiOk || !shopId) return;
    setIsCalculating(true);
    try {
      console.log("[useCheckout] CartItems : ", cartItems[0].Declination?.id);
      const serverTotal = await ordersService.calculateTotal(shopId, {
        order_products: cartItems.map((item: CartItem) => ({
          product:        item.product.slug,
          quantity:       item.quantity,
          declination_id: item.Declination?.id ?? null,
        })),
        currency_id: currencyId,
      });
      setComputedTotal(serverTotal);
    } catch (e) {
      console.warn('[useCheckout] calculateTotal échec, total local conservé', e);
        const apiError = extractApiError(e);
        console.warn('  message :', apiError.message);
        console.warn('  errors  :', JSON.stringify(apiError.errors, null, 2));
        console.warn('  status  :', apiError.status);
        console.warn('  raw     :', JSON.stringify(apiError.raw, null, 2));
    } finally {
      setIsCalculating(false);
    }
  }, [apiOk, cartItems, currencyId, shopId]);

  useEffect(() => { recalculate(); }, [cartItems.length, apiOk]);

  // ── Commandes offline ──────────────────────────────────────────────────────

  const [offlineOrders, setOfflineOrders] = useState<OfflineOrder[]>([]);
  const [isPlacing,     setIsPlacing]     = useState(false);
  const [isSyncing,     setIsSyncing]     = useState(false);

  const reloadOfflineOrders = useCallback(async () => {
    if (!accountId) return;
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_ORDERS_KEY(accountId));
      setOfflineOrders(raw ? JSON.parse(raw) : []);
    } catch {
      setOfflineOrders([]);
    }
  }, [accountId]);

  useEffect(() => { reloadOfflineOrders(); }, [reloadOfflineOrders]);

  // ── Passer la commande ─────────────────────────────────────────────────────

  const placeOrder = async (): Promise<PlaceOrderResult> => {
    if (!canProceed) {
      return {
        success:   false,
        isOffline: false,
        message:   'Veuillez sélectionner un client et ajouter des produits.',
      };
    }

    setIsPlacing(true);

    const deliveryPayload = buildDeliveryPayload(deliveryDate, deliveryTime);


    // ── Mode online ────────────────────────────────────────────────────────
    if (apiOk && shopId) {

      // Posé dès que createOrder réussit.
      // Si non-null → on retourne success online même si clearCart échoue après.
      let onlineOrderId: number | string | null = null;

      try {
        // 1. Résoudre le customer (cherche par téléphone, crée si absent)
        const backendCustomer = await customersService.findOrCreate(
          shopId,
          selectedCustomer!
        );

        if (!backendCustomer?.id) {
          throw new Error('Impossible de résoudre le client (ID manquant)');
        }

        // Synchroniser l'ID backend localement (non bloquant)
        CustomerStorage.save(accountId, {
          ...selectedCustomer!,
          id: backendCustomer.id,
        }).then((savedLocal) => {
          setSelectedCustomer(savedLocal);
          setCustomers((prev) =>
            prev.map((c) => (c.phone === savedLocal.phone ? savedLocal : c))
          );
        }).catch(() => {});

        // 2. Construire et envoyer la commande
        const orderPayload: Order = {
          customer:           Number(backendCustomer.id),
          currency:           currencyId,
          account:            backendAccountId,
          order_amount:       computedTotal,
          total_amount_order: computedTotal,
          delivery: deliveryPayload,
          reference_order:    generateOrderReference(),
          secure_key:         generateSecureKey(),
          has_delivery:       false,
          balance:            0,
          total_discount:     0,
          order_products:     cartItemsToOrderProducts(cartItems),
        };

        const created = await ordersService.createOrder(shopId, orderPayload);

        // ✅ Commande confirmée — verrouille le succès
        onlineOrderId = created.id ?? null;

      } catch (e: any) {
        const apiError = extractApiError(e);
        console.warn('[useCheckout] Erreur création commande :');
        console.warn('  message :', apiError.message);
        console.warn('  errors  :', JSON.stringify(apiError.errors, null, 2));
        console.warn('  status  :', apiError.status);
        console.warn('  raw     :', JSON.stringify(apiError.raw, null, 2));
      }

      // Commande créée en ligne → succès garanti
      if (onlineOrderId !== null) {
        try { await clearCart(); } catch (e) {
          console.warn('[useCheckout] clearCart échoué (commande déjà créée) :', e);
        }
        setIsPlacing(false);
        return {
          success:   true,
          isOffline: false,
          orderId:   onlineOrderId,
          message:   'Commande passée avec succès !',
        };
      }

      // onlineOrderId === null → erreur avant/pendant createOrder → fallback offline
    }

    // ── Mode offline (pas de réseau OU erreur API avant création) ──────────
    // Même shape que Order + metadata + _customer pour findOrCreate à la sync
    const offline: OfflineOrder = {
      // Champs Order — identiques au payload online
      currency:           currencyId,
      account:            backendAccountId, // ID numérique backend (pas l'UUID local)
      order_amount:       computedTotal,
      total_amount_order: computedTotal,
      delivery: deliveryPayload,
      reference_order:    generateOrderReference(),
      secure_key:         generateSecureKey(),
      has_delivery:       false,
      balance:            0,
      total_discount:     0,
      order_products:     cartItemsToOrderProducts(cartItems),
      // Metadata offline
      _customer:          selectedCustomer!,
      localId:            generateLocalId(),
      status:             'pending_sync',
      createdAt:          Date.now(),
      syncAttempts:       0,
    };

    const existing = await AsyncStorage.getItem(OFFLINE_ORDERS_KEY(accountId))
      .then((r) => (r ? JSON.parse(r) : []))
      .catch(() => []);

    const newList = [...existing, offline];
    await AsyncStorage.setItem(OFFLINE_ORDERS_KEY(accountId), JSON.stringify(newList));
    setOfflineOrders(newList);

    try { await clearCart(); } catch {}
    setIsPlacing(false);

    return {
      success:   true,
      isOffline: true,
      orderId:   offline.localId,
      message:   'Commande enregistrée — sera envoyée à la reconnexion.',
    };
  };

  // ── Sync manuelle ──────────────────────────────────────────────────────────
  // La sync automatique (NetInfo) est gérée par SyncService.startListening()
  // → à appeler UNE SEULE FOIS dans App.tsx

  const syncPending = async (): Promise<void> => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await SyncService.syncAll();
      await reloadOfflineOrders(); // rafraîchit l'UI avec les statuts mis à jour
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const canProceed =
    !!selectedCustomer?.phone &&
    !!(selectedCustomer?.name ?? selectedCustomer?.firstname) &&
    cartItems.length > 0;

  return {
    step, setStep,
    customers, phoneContacts, contactsLoading,
    selectedCustomer, selectCustomer,
    newCustomer, setNewCustomerField, saveNewCustomer,
    searchContacts, contactSearch, filteredContacts,
    deliveryDate, setDeliveryDate,
    deliveryTime, setDeliveryTime,
    note, setNote,
    computedTotal, isCalculating, recalculate,
    isPlacing, placeOrder,
    offlineOrders, syncPending, isSyncing,
    canProceed, errors,
  };
}