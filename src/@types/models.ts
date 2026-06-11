// @types/models.ts

export interface User {
  id: number; name: string; email: string; phone?: string; avatar?: string;
  created_at: string; updated_at: string;
}

export interface AccountUser {
  id: number; lastname?: string; firstname: string; email: string; phone?: string;
  avatar?: string; account_cover?: string; account_profile?: string;
  shop_id: string; shop: Shop[]; created_at: string; updated_at: string;
  permissions?: Record<string, string[]>;
}

export interface Shop {
  id: string; name: string; description?: string; profile?: string;
  cover_image?: string; created_at: string; updated_at: string;
}

// ═══════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════

export interface Product {
  id: number; name: string; slug: string; description: string;
  price: number; discount_price?: number; images: string[]; coverImage: string;
  category_id: number; category: Category[]; in_stock: boolean;
  stock_quantity: number; has_unlimited_stock: boolean;
  declination: Declination[]; currency: Currency;
  created_at: string; updated_at: string;
}

export type OfflineProduct = Product & {
  localImages: string[];
  cachedAt: number;
  coverImageLocal: string;
};

export interface Category {
  id: number; name: string; description?: string;
  images?: []; coverImage?: string; parent_id?: number;
}

export interface ProductAttribute { id: number; name: string; value: string; }

// ═══════════════════════════════════════════════════════════
// PANIER
// ═══════════════════════════════════════════════════════════

export interface CartItem {
  /**
   * Clé composite unique :
   *   "{productId}__base"          → prix catalogue normal
   *   "{productId}__{offerPrice}"  → prix personnalisé
   *
   * Même produit avec prix différents = deux lignes distinctes dans le panier.
   */
  id:           string;

  product_slug: string;
  product:      Product;
  quantity:     number;
  selected_attributes?: Record<string, string>;
  Declination?: Declination;
  delivery?:    DeliveryOrder | null;

  /** Prix de base (déclinaison > discount_price > price) — jamais modifié */
  basePrice:    number;

  /** Prix personnalisé saisi par l'utilisateur, null = pas d'offre */
  offerPrice:   number | null;

  /** Prix effectif = offerPrice ?? basePrice */
  displayPrice: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clé composite identifiant une ligne panier de façon unique */
export function buildCartItemId(productId: number, offerPrice: number | null): string {
  return offerPrice != null ? `${productId}__${offerPrice}` : `${productId}__base`;
}

/** Prix de base d'un produit/déclinaison, sans offre */
export function resolveBasePrice(product: Product, declination?: Declination | null): number {
  if (declination?.price && declination.price > 0) return declination.price;
  if ((product.discount_price ?? 0) > 0) return product.discount_price!;
  return product.price;
}

/** Sous-total d'une ligne panier */
export function itemSubTotal(item: CartItem): number {
  const price =
    item.displayPrice ??
    item.offerPrice ??
    (item.Declination?.price && item.Declination.price > 0
      ? item.Declination.price
      : item.product.discount_price || item.product.price);
  return price * item.quantity;
}

/**
 * Convertit les lignes du panier en order_products pour l'API.
 * offer_price est transmis au backend qui crée le ProductOffer
 * dans la même DB::transaction que la commande.
 */
export function cartItemsToOrderProducts(cartItems: CartItem[]) {
  return cartItems.map((item) => ({
    id:          item.product.id,
    product:     item.product,
    quantity:    item.quantity,
    sub_totals:  itemSubTotal(item),
    declination: item.Declination?.id ?? null,
    delivery:    null,
    discount:    0,
    offer_price: item.offerPrice ?? null,
  }));
}

// ═══════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════

export interface OrderItem {
  id: number | string;
  product_id: number; product: Product; quantity: number;
  sub_totals: number; discount?: number;
  declination?: number | null; delivery?: number | null;
  offer_price?: number | null;
}

export type SyncQueueItem = { localId: string; accountId: string; addedAt: number; };

export interface Order {
  id?: number | string;
  customer?: number; currency: number | string; account?: number | null;
  merchant?: number | null; shop?: string | Shop | null; coupon?: number | null;
  delivery?: Delivery | DeliveryPayload | null;
  order_products: ReturnType<typeof cartItemsToOrderProducts>;
  order_amount: number; total_amount_order: number;
  balance?: number; total_discount?: number;
  reference_order: string; secure_key: string; has_delivery: boolean;
  status?: OrderStatus; shipping_address?: Address; billing_address?: Address;
  payment_method?: string | PaymentMethod; has_advance: boolean;
  created_at?: string; updated_at?: string;
  note?: string;
}

export type OfflineOrder = Omit<Order, 'status'> & {
  _customer: Customer;
  localId: string;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt: number; syncAttempts: number; serverId?: number; syncError?: string;
};

// ═══════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════

export interface Customer {
  id: string | number; firstname?: string; lastname?: string; name?: string;
  middle_name?: string; phone: string; email?: string; address?: string;
  shop?: string | Shop | null; note?: string; savedToContacts?: boolean;
  contactId?: string; createdAt?: number;
}

export interface Currencies {
  id: number; iso_code: string; symbol: string; name: string;
  country: string; exchange_rate: number;
}

export interface Delivery { id: number; costs?: number | 0; delivery_date: string; }

export interface DeliveryPayload { costs?: number; delivery_date: string; }

export function buildDeliveryPayload(date: Date, time: string, costs = 0): DeliveryPayload {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return { costs, delivery_date: combined.toISOString() };
}

export interface DeliveryOrderItem {
  product_id: number; product_slug: string; product_name: string;
  price: number; quantity: number; declination_id?: number; declination_sku?: string;
}

export interface DeliveryOrder {
  customer: Customer; items: DeliveryOrderItem[]; total: number;
  delivery_date: string; delivery_time?: string; note?: string; address?: string;
}

export type OfflineDeliveryOrder = DeliveryOrder & {
  localId: string; accountId: string;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt: number; syncAttempts: number; serverId?: number; syncError?: string;
};

export interface Currency { iso_code: string; symbol: string; name: string; country: string; exchange_rate: number; }

export interface Declination {
  id: number; price: number; quantity: number; sku: string;
  declination_images?: []; values: Values[];
}

export interface Values { id: number; value: string; color?: string; attribute: Attribute; }

export interface Attribute { id: number; name: string; type: string; shop_id: string; account_id: string; }

export enum OrderStatus {
  PENDING = 'PendingState', PAID = 'PaidState', PROCESSING = 'ProcessingState',
  SHIPPED = 'ShippedState', DELIVERED = 'DeliveredState',
  CANCELLED = 'CancelledState', RETURNED = 'ReturnedState',
}

export interface Address {
  id?: number; full_name: string; address_line1: string; address_line2?: string;
  city: string; state: string; postal_code: string; country: string;
  phone: string; is_default?: boolean;
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card', PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay', GOOGLE_PAY = 'google_pay',
}

export interface ApiResponse<T> { status: boolean; message: string; data?: T; errors?: Record<string, string[]>; }
export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { name: string; email: string; password: string; password_confirmation: string; }
export interface SocialLoginRequest { provider: 'google' | 'apple' | 'facebook'; token: string; userData?: { name?: string; email?: string }; }
export interface AuthAccountResponse { user: AccountUser; token: string; refresh_token: string; }
export interface Review {}
export interface LoginPayload { email: string; password: string; }
export interface OfflineOrderItem { id: number; product_id: number; product: Product; quantity: number; price: number; selected_attributes?: Record<string, string>; }
export type SyncResult = { synced: number; failed: number; errors: string[]; };
export type SavedAccount = { id: string; user: AccountUser; token: string; refreshToken?: string; pinHash: string | null; avatarColor: string; addedAt: number; lastUsedAt: number; isActive: boolean; };
export type MultiAccountStore = { accounts: SavedAccount[]; activeAccountId: string | null; };
export type PaymentMethodType = 'cash' | 'card';
export interface OrderPaymentPayload { payment_method: PaymentMethodType; amount_paid: number; discount: number; }
export interface OrderFinancialSummary { subtotal: number; discount: number; total_net: number; amount_paid: number; balance: number; }