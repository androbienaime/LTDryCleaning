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
import {
  Customer, OfflineOrder, CartItem, Order,
  buildDeliveryPayload,
  OrderPaymentPayload, OrderFinancialSummary,
} from '@/src/@types/models';
import { useAppSetup } from '@/context/AppSetupContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const OFFLINE_ORDERS_KEY = (accountId: string) =>
  `@offline_delivery_orders:${accountId}`;

function generateLocalId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckoutStep = 'customer' | 'date' | 'summary';

export type PlaceOrderResult = {
  success       : boolean;
  isOffline     : boolean;
  orderId?      : string | number;
  message       : string;
  total         : number;
  discount      : number;
  amountPaid    : number;
  balance       : number;
  paymentMethod : OrderPaymentPayload['payment_method'];
  hasAdvance    : boolean;
};

export type UseCheckoutReturn = {
  // ── Step ──
  step    : CheckoutStep;
  setStep : (s: CheckoutStep) => void;

  // ── Panier (ré-exposé pour que CheckoutScreen n'importe pas useCart) ──
  cartItems    : CartItem[];
  computedTotal: number;
  isCalculating: boolean;
  recalculate  : () => Promise<void>;

  // ── Customers ──
  customers           : Customer[];
  filteredContacts    : Customer[];
  phoneContacts       : Customer[];
  contactsLoading     : boolean;
  selectedCustomer    : Customer | null;
  selectCustomer      : (c: Customer) => void;
  newCustomer         : Partial<Customer>;
  setNewCustomerField : (field: keyof Customer, value: string) => void;
  saveNewCustomer     : (saveToPhone?: boolean) => Promise<Customer | null>;
  searchContacts      : (query: string) => void;
  contactSearch       : string;
  errors              : Record<string, string>;

  // ── Livraison ──
  deliveryDate    : Date;
  setDeliveryDate : (d: Date) => void;
  deliveryTime    : string;
  setDeliveryTime : (t: string) => void;

  // ── Note ──
  note    : string;
  setNote : (n: string) => void;

  // ── Paiement ──
  paymentPayload   : OrderPaymentPayload;
  financialSummary : OrderFinancialSummary | null;
  setPaymentData   : (p: OrderPaymentPayload, s: OrderFinancialSummary) => void;

  // ── Commande ──
  isPlacing     : boolean;
  placeOrder    : () => Promise<PlaceOrderResult>;
  offlineOrders : OfflineOrder[];
  syncPending   : () => Promise<void>;
  isSyncing     : boolean;
  canProceed    : boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckout(): UseCheckoutReturn {
  const { cartItems, clearCart }   = useCart();
  const { activeAccount }          = useMultiAccount();
  const { apiStatus }              = useProducts();
  const { setupConfig }            = useAppSetup();

  const accountId        = activeAccount?.id       ?? '';
  const backendAccountId = activeAccount?.user?.id ?? null;
  const shopId           = setupConfig.shopId             ?? '';
  const currencyId       = setupConfig.currency?.iso_code ?? 'HTG';
  const apiOk            = apiStatus !== 'offline';

  // ── Step ──────────────────────────────────────────────────────────────────

  const [step, setStep] = useState<CheckoutStep>('customer');

  // ── Customers ─────────────────────────────────────────────────────────────

  const [customers,        setCustomers]        = useState<Customer[]>([]);
  const [phoneContacts,    setPhoneContacts]     = useState<Customer[]>([]);
  const [contactsLoading,  setContactsLoading]  = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer,      setNewCustomer]       = useState<Partial<Customer>>({});
  const [contactSearch,    setContactSearch]     = useState('');
  const [filteredContacts, setFilteredContacts]  = useState<Customer[]>([]);
  const [errors,           setErrors]            = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accountId) return;
    CustomerStorage.getAll(accountId).then(setCustomers);
    setContactsLoading(true);
    PhoneContacts.getAll()
      .then((c) => { setPhoneContacts(c); setFilteredContacts(c); })
      .finally(() => setContactsLoading(false));
  }, [accountId]);

  const selectCustomer = (c: Customer) =>
    setSelectedCustomer({ ...c, shop: shopId });

  const setNewCustomerField = (field: keyof Customer, value: string) => {
    setNewCustomer((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field as string]; return e; });
  };

  const saveNewCustomer = async (saveToPhone = false): Promise<Customer | null> => {
    if (!newCustomer.name || !newCustomer.phone) {
      setErrors((prev) => ({
        ...prev,
        ...(!newCustomer.name  ? { name:  'Le nom est requis' }       : {}),
        ...(!newCustomer.phone ? { phone: 'Le téléphone est requis' } : {}),
      }));
      return null;
    }

    let contactId: string | null = null;
    if (saveToPhone) {
      contactId = await PhoneContacts.saveToContacts({
        ...newCustomer as Customer,
        firstname: newCustomer.firstname ?? newCustomer.name.split(' ')[0]           ?? '',
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
      return idx >= 0
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [...prev, saved];
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

  // ── Livraison ─────────────────────────────────────────────────────────────

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [deliveryDate, setDeliveryDate] = useState<Date>(tomorrow);
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00');

  // ── Note ──────────────────────────────────────────────────────────────────

  const [note, setNote] = useState('');

  // ── Total calculé ─────────────────────────────────────────────────────────

  const [computedTotal, setComputedTotal] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);

  const recalculate = useCallback(async () => {
    if (cartItems.length === 0) { setComputedTotal(0); return; }

    // Calcul local immédiat
    const localTotal = cartItems.reduce((sum, item) => sum + itemSubTotal(item), 0);
    setComputedTotal(localTotal);

    // Recalcul serveur si online
    if (!apiOk || !shopId) return;
    setIsCalculating(true);
    try {
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
      const apiError = extractApiError(e);
      console.warn('[useCheckout] calculateTotal échec, total local conservé');
      console.warn('  message :', apiError.message);
      console.warn('  errors  :', JSON.stringify(apiError.errors, null, 2));
    } finally {
      setIsCalculating(false);
    }
  }, [apiOk, cartItems, currencyId, shopId]);

  useEffect(() => { recalculate(); }, [cartItems.length, apiOk]);

  // ── Paiement ──────────────────────────────────────────────────────────────

  const [paymentPayload, setPaymentPayload] = useState<OrderPaymentPayload>({
    payment_method : 'cash',
    amount_paid    : 0,
    discount       : 0,
  });
  const [financialSummary, setFinancialSummary] = useState<OrderFinancialSummary | null>(null);

  const setPaymentData = useCallback(
    (p: OrderPaymentPayload, s: OrderFinancialSummary) => {
      setPaymentPayload(p);
      setFinancialSummary(s);
    },
    []
  );

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
    const failResult: PlaceOrderResult = {
      success: false, isOffline: false,
      message: 'Veuillez sélectionner un client et ajouter des produits.',
      total: computedTotal, discount: 0, amountPaid: 0,
      balance: computedTotal, paymentMethod: 'cash', hasAdvance: false,
    };

    if (!canProceed) return failResult;

    setIsPlacing(true);

    // ── Valeurs financières ────────────────────────────────────────────────
    const discount   = paymentPayload.discount;
    const totalNet   = financialSummary?.total_net   ?? (computedTotal - discount);
    const amountPaid = paymentPayload.amount_paid;
    const balance    = financialSummary?.balance     ?? (totalNet - amountPaid);
    const hasAdvance = amountPaid > 0 && amountPaid < totalNet;

    const deliveryPayload  = buildDeliveryPayload(deliveryDate, deliveryTime);

    const paymentResult = {
      total: totalNet, discount, amountPaid, balance,
      paymentMethod: paymentPayload.payment_method, hasAdvance,
    };

    // ── Mode online ────────────────────────────────────────────────────────
    if (apiOk && shopId) {
      let onlineOrderId: number | string | null = null;

      try {
        const backendCustomer = await customersService.findOrCreate(
          shopId, selectedCustomer!
        );

        if (!backendCustomer?.id) {
          throw new Error('Impossible de résoudre le client (ID manquant)');
        }

        // Sync locale silencieuse
        CustomerStorage.save(accountId, {
          ...selectedCustomer!, id: backendCustomer.id,
        }).then((saved) => {
          setSelectedCustomer(saved);
          setCustomers((prev) => prev.map((c) => (c.phone === saved.phone ? saved : c)));
        }).catch(() => {});

        const orderPayload: Order = {
          customer           : Number(backendCustomer.id),
          currency           : currencyId,
          account            : backendAccountId,
          order_amount       : amountPaid,
          total_amount_order : totalNet,
          total_discount     : discount,
          balance,
          has_advance        : hasAdvance,
          payment_method     : paymentPayload.payment_method,
          delivery           : deliveryPayload,
          reference_order    : generateOrderReference(),
          secure_key         : generateSecureKey(),
          has_delivery       : false,
          order_products     : cartItemsToOrderProducts(cartItems),
        };

        const created = await ordersService.createOrder(shopId, orderPayload);
        onlineOrderId = created.id ?? null;

      } catch (e: any) {
        const apiError = extractApiError(e);
        console.warn('[useCheckout] Erreur création commande :');
        console.warn('  message :', apiError.message);
        console.warn('  errors  :', JSON.stringify(apiError.errors, null, 2));
        console.warn('  status  :', apiError.status);
      }

      if (onlineOrderId !== null) {
        try { await clearCart(); } catch (e) {
          console.warn('[useCheckout] clearCart échoué (commande déjà créée) :', e);
        }
        setIsPlacing(false);
        return {
          success: true, isOffline: false,
          orderId: onlineOrderId,
          message: 'Commande passée avec succès !',
          ...paymentResult,
        };
      }
    }

    // ── Mode offline ───────────────────────────────────────────────────────
    const offline: OfflineOrder = {
      currency           : currencyId,
      account            : backendAccountId,
      order_amount       : amountPaid,
      total_amount_order : totalNet,
      total_discount     : discount,
      balance,
      has_advance        : hasAdvance,
      payment_method     : paymentPayload.payment_method,
      delivery           : deliveryPayload,
      reference_order    : generateOrderReference(),
      secure_key         : generateSecureKey(),
      has_delivery       : false,
      order_products     : cartItemsToOrderProducts(cartItems),
      _customer          : selectedCustomer!,
      localId            : generateLocalId(),
      status             : 'pending_sync',
      createdAt          : Date.now(),
      syncAttempts       : 0,
    };

    const existing = await AsyncStorage.getItem(OFFLINE_ORDERS_KEY(accountId))
      .then((r) => (r ? JSON.parse(r) : []))
      .catch(() => []);

    await AsyncStorage.setItem(
      OFFLINE_ORDERS_KEY(accountId),
      JSON.stringify([...existing, offline])
    );
    setOfflineOrders([...existing, offline]);

    try { await clearCart(); } catch {}
    setIsPlacing(false);

    return {
      success: true, isOffline: true,
      orderId: offline.localId,
      message: 'Commande enregistrée — sera envoyée à la reconnexion.',
      ...paymentResult,
    };
  };

  // ── Sync manuelle ──────────────────────────────────────────────────────────

  const syncPending = async (): Promise<void> => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await SyncService.syncAll();
      await reloadOfflineOrders();
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const canProceed =
    !!selectedCustomer?.phone &&
    !!(selectedCustomer?.name ?? selectedCustomer?.firstname) &&
    cartItems.length > 0;

  // ── Retour ────────────────────────────────────────────────────────────────

  return {
    step, setStep,
    // Panier ré-exposé → CheckoutScreen n'importe plus useCart
    cartItems, computedTotal, isCalculating, recalculate,
    // Customers
    customers, filteredContacts, phoneContacts, contactsLoading,
    selectedCustomer, selectCustomer,
    newCustomer, setNewCustomerField, saveNewCustomer,
    searchContacts, contactSearch, errors,
    // Livraison
    deliveryDate, setDeliveryDate,
    deliveryTime, setDeliveryTime,
    // Note
    note, setNote,
    // Paiement
    paymentPayload, financialSummary, setPaymentData,
    // Commande
    isPlacing, placeOrder,
    offlineOrders, syncPending, isSyncing,
    canProceed,
  };
}