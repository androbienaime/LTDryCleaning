// hooks/useCheckout.ts

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '@/context/CartContext';
import { useMultiAccount } from '@/context/MultiAccountContext';
import { useProducts } from '@/context/ProductContext';
import { ordersService, generateOrderReference, generateSecureKey, cartItemsToOrderProducts } from '@/src/api/services/orders.services';
import { customersService } from '@/src/api/services/customers.services';
import { CustomerStorage, PhoneContacts } from '@/utils/customerStorage';
import type { Customer, OfflineDeliveryOrder, CartItem } from '@/src/@types/models';

const OFFLINE_ORDERS_KEY = (accountId: string) =>
  `@offline_delivery_orders:${accountId}`;

function generateLocalId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

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
  offlineOrders: OfflineDeliveryOrder[];
  syncPending:   () => Promise<void>;
  isSyncing:     boolean;

  canProceed: boolean;
  errors:     Record<string, string>;
};

export function useCheckout(): UseCheckoutReturn {
  const { cartItems, totalAmount, clearCart } = useCart();
  const { activeAccount }                     = useMultiAccount();
  const { apiStatus }                         = useProducts();

  const accountId  = activeAccount?.id                                  ?? '';
  const shopId     = activeAccount?.user?.shop?.[0]?.id                 ?? '';
  const currencyId = activeAccount?.user?.shop?.[0]?.currency?.iso_code ?? 'HTG';
  const apiOk      = apiStatus !== 'offline';

  // ── Step ──────────────────────────────────────────────────────────────────

  const [step, setStep] = useState<CheckoutStep>('customer');

  // ── Customer ──────────────────────────────────────────────────────────────

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
        name: newCustomer.name, phone: newCustomer.phone, email: newCustomer.email,
      });
    }

    // Sauvegarder localement
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
      phoneContacts.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
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
    if (!apiOk || cartItems.length === 0 || !shopId) {
      setComputedTotal(totalAmount);
      return;
    }
    setIsCalculating(true);
    try {
      const total = await ordersService.calculateTotal(shopId, {
        order_products: cartItems.map((item: CartItem) => ({
          product:        item.product.slug,
          quantity:       item.quantity,
          declination_id: item.Declination?.id ?? null,
        })),
        currency_id: currencyId,
      });
      setComputedTotal(total);
    } catch {
      setComputedTotal(totalAmount);
    } finally {
      setIsCalculating(false);
    }
  }, [apiOk, cartItems, totalAmount, currencyId, shopId]);

  useEffect(() => { recalculate(); }, [cartItems.length, apiOk]);

  // ── Commandes hors ligne ───────────────────────────────────────────────────

  const [offlineOrders, setOfflineOrders] = useState<OfflineDeliveryOrder[]>([]);
  const [isPlacing,     setIsPlacing]     = useState(false);
  const [isSyncing,     setIsSyncing]     = useState(false);

  useEffect(() => {
    if (!accountId) return;
    AsyncStorage.getItem(OFFLINE_ORDERS_KEY(accountId))
      .then((raw) => setOfflineOrders(raw ? JSON.parse(raw) : []))
      .catch(() => setOfflineOrders([]));
  }, [accountId]);

  const persist = async (orders: OfflineDeliveryOrder[]) => {
    await AsyncStorage.setItem(OFFLINE_ORDERS_KEY(accountId), JSON.stringify(orders));
    setOfflineOrders(orders);
  };

  const updateOffline = async (localId: string, patch: Partial<OfflineDeliveryOrder>) => {
    const updated = offlineOrders.map((o) => o.localId === localId ? { ...o, ...patch } : o);
    await persist(updated);
  };

  // ── Passer la commande ─────────────────────────────────────────────────────

  const placeOrder = async (): Promise<PlaceOrderResult> => {
    if (!canProceed) {
      return { success: false, isOffline: false, message: 'Veuillez sélectionner un client.' };
    }

    setIsPlacing(true);

    try {

      if (apiOk && shopId) {
        // ── 1. S'assurer que le customer existe dans le backend ──────────
        // findOrCreate cherche par téléphone, crée si absent.
        // Retourne un Customer avec un vrai ID numérique backend.
        let page=10, initialLimit=50;

        const params = { page, per_page: initialLimit };
        
          const backendCustomer = await customersService.findOrCreate(
            shopId,
            selectedCustomer!
          );
        
        
          console.log('Backend customer resolved:', backendCustomer);

        // ── 2. Créer la commande avec le vrai customer_id ────────────────
        const created = await ordersService.createOrder(shopId, {
          customer_id:        Number(backendCustomer.id),
          currency_id:        currencyId,
          account_id:         accountId,
          order_amount:       computedTotal,
          total_amount_order: computedTotal,
          reference_order:    generateOrderReference(),
          secure_key:         generateSecureKey(),
          has_delivery:       false,
          balance:            0,
          total_discount:     0,
          order_products:     cartItemsToOrderProducts(cartItems),
        });

        await clearCart();
        setIsPlacing(false);
        return { success: true, isOffline: false, orderId: created.id, message: 'Commande passée avec succès !' };
      }
    } catch (e: any) {
      console.warn('[useCheckout] API error → fallback offline:', e?.message);
    }

    // ── Hors ligne ou erreur API → sauvegarder localement ─────────────────
    const offline: OfflineDeliveryOrder = {
      customer:      selectedCustomer!,
      items:         cartItems.map((item: CartItem) => ({
        product_id:      item.product.id,
        product_slug:    item.product.slug,
        product_name:    item.product.name,
        price:           item.product.discount_price ?? item.product.price,
        quantity:        item.quantity,
        declination_id:  item.Declination?.id,
        declination_sku: item.Declination?.sku,
      })),
      total:         computedTotal,
      delivery_date: deliveryDate.toISOString().split('T')[0],
      delivery_time: deliveryTime,
      note,
      localId:       generateLocalId(),
      accountId,
      status:        'pending_sync',
      createdAt:     Date.now(),
      syncAttempts:  0,
    };

    await persist([...offlineOrders, offline]);
    await clearCart();
    setIsPlacing(false);

    return { success: true, isOffline: true, orderId: offline.localId, message: 'Commande enregistrée — sera envoyée à la reconnexion.' };
  };

  // ── Sync ──────────────────────────────────────────────────────────────────

  const syncPending = async () => {
    if (isSyncing || !apiOk || !shopId) return;
    setIsSyncing(true);

    const pending = offlineOrders.filter(
      (o) => o.status === 'pending_sync' || o.status === 'failed'
    );

    for (const order of pending) {
      await updateOffline(order.localId, { status: 'syncing' });
      try {
        // Résoudre le vrai customer_id
        const backendCustomer = await customersService.findOrCreate(shopId, order.customer);

        const created = await ordersService.createOrder(shopId, {
          customer_id:        Number(backendCustomer.id),
          currency_id:        currencyId,
          account_id:         order.accountId || null,
          order_amount:       order.total,
          total_amount_order: order.total,
          reference_order:    generateOrderReference(),
          secure_key:         generateSecureKey(),
          has_delivery:       false,
          balance:            0,
          total_discount:     0,
          order_products:     order.items.map((i) => ({
            id:          i.product_id,
            quantity:    i.quantity,
            declination: i.declination_id ?? null,
            delivery:    null,
            discount:    0,
          })),
        });

        await updateOffline(order.localId, { status: 'synced', serverId: created.id });
      } catch (e: any) {
        const attempts = order.syncAttempts + 1;
        await updateOffline(order.localId, {
          status:       attempts >= 5 ? 'failed' : 'pending_sync',
          syncAttempts: attempts,
          syncError:    e?.message,
        });
      }
    }

    setIsSyncing(false);
  };

  useEffect(() => {
    if (apiOk && offlineOrders.some((o) => o.status === 'pending_sync')) {
      syncPending();
    }
  }, [apiOk]); // eslint-disable-line

  const canProceed =
    !!selectedCustomer?.name &&
    !!selectedCustomer?.phone &&
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