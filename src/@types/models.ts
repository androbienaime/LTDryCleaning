// 1. Types de base (@types/models.ts)
export interface User {
    id: number;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    created_at: string;
    updated_at: string;
  }

  export interface AccountUser {
    id: number;
    lastname?: string;
    firstname: string;
    email: string;
    phone?: string;
    avatar?: string;
    account_cover?: string;
    account_profile?: string;
    shop_id: string;
    shop: Shop[]
    created_at: string;
    updated_at: string;
    permissions?: Record<string, string[]>;

    // currency?: Currency
  }
  
  export interface Shop {
    id: string;
    name: string;
    description?: string;
    profile?: string;
    cover_image?: string;
    created_at: string;
    updated_at: string;
  }

// ═══════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════
 
  export interface Product {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: number;
    discount_price?: number;
    images: string[];
    coverImage: string;
    category_id: number;
    category: Category[];
    in_stock: boolean;
    stock_quantity: number;
    has_unlimited_stock: boolean,
    declination: Declination[];
    currency: Currency;
    created_at: string;
    updated_at: string;
  }
  
  export type OfflineProduct = Product & {
    localImages: string[]; // chemins FileSystem locaux après téléchargement
    cachedAt: number;      // timestamp du dernier cache
    coverImageLocal: string; // chemin local de l'image de couverture (prioritaire)
  };


  export interface Category {
    id: number;
    name: string;
    description?: string;
    images?: [];
    coverImage?: string;
    parent_id?: number;
  }
  
  export interface ProductAttribute {
    id: number;
    name: string;
    value: string;
  }
  
  export interface CartItem {
    id: number;
    product_slug: string;
    product: Product;
    quantity: number;
    selected_attributes?: Record<string, string>;
    Declination?: Declination
    delivery?: DeliveryOrder | null;
  }
  
// ═══════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════
 
 export interface OrderItem {
  id: number | string;

  // Product
  product_id: number;
  quantity: number;

  // Backend fields
  sub_totals: number;
  discount?: number;

  // Optional relations
  declination?: number | null;
  delivery?: number | null;
}

export function itemSubTotal(item: CartItem): number {
  const unitPrice =
    item.Declination?.price ??
    item.product.discount_price ??
    item.product.price ??
    0;
  return unitPrice * item.quantity;
}

export function cartItemsToOrderProducts(cartItems: CartItem[]) {
  return cartItems.map((item) => ({
    id:          item.product.id,
    product :    item.product,
    quantity:    item.quantity,
    sub_totals:  itemSubTotal(item),
    declination: item.Declination?.id ?? null,
    delivery:    null,
    discount:    0,
  }));
}

export interface Order {
  id?: number | string;

  // Relations
  customer?: number;
  currency: number |string;
  account?: number | null;
  merchant?: number | null;
  shop?: string | Shop | null,
  coupon?: number | null;
  delivery?: Delivery | DeliveryPayload | null;

  // Products
  order_products: ReturnType <typeof cartItemsToOrderProducts>;

  // Amounts
  order_amount: number;
  total_amount_order: number;
  balance?: number;
  total_discount?: number;

  // Order info
  reference_order: string;
  secure_key: string;
  has_delivery: boolean;

  // Optional frontend fields
  status?: OrderStatus;
  shipping_address?: Address;
  billing_address?: Address;
  payment_method?: string | PaymentMethod;
  has_advance : boolean;

  // Dates
  created_at?: string;
  updated_at?: string;
}

  
// Commande créée hors ligne, en attente de synchronisation
// Même shape que Order (online) + metadata + _customer pour findOrCreate à la sync.
export type OfflineOrder = Omit<Order, 'status'> & {
  _customer:    Customer;          // raw Customer → findOrCreate au moment de la sync
  localId:      string;            // ID temporaire local (AsyncStorage)
  status:       'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt:    number;
  syncAttempts: number;
  serverId?:    number;            // ID assigné par le serveur après sync réussie
  syncError?:   string;
};
  

  export interface OrderItem {
    id: number | string;
    product_id: number;
    product: Product;
    quantity: number;
    declination_id?: number;
    price: number;
    selected_attributes?: Record<string, string>;
  }

  export type SyncQueueItem = {
    localId: string;
    accountId: string;
    addedAt: number;
  };

  // ═══════════════════════════════════════════════════════════
// CUSTOMER (client de la commande)
// ═══════════════════════════════════════════════════════════
 
export interface Customer {
  id:          string | number;
  firstname?:   string;           // optionnel
  lastname?:    string;           // optionnel
  name?:        string;           // nom complet (pour contacts téléphoniques)
  middle_name?: string;           // optionnel
  phone:        string;           // seul champ obligatoire
  email?:       string;
  address?:     string;
  shop?: string | Shop | null;
  note?:        string;
  savedToContacts?: boolean;
  contactId?:   string;
  createdAt?:   number;
}
 
export interface Currencies {
  id: number;
  iso_code: string;
  symbol: string;
  name: string;
  country: string;
  exchange_rate: number;
}
// ═══════════════════════════════════════════════════════════
// COMMANDE COMPLÈTE (online + offline)
// ═══════════════════════════════════════════════════════════
 
export interface Delivery {
  id: number;
  costs?: number | 0;
  delivery_date : string;
}

// ─── DELIVERY PAYLOAD (création inline, sans id) ───────────────────────────
// Analogue à cartItemsToOrderProducts : on construit la livraison
// directement dans le payload de la commande, sans appel séparé.

export interface DeliveryPayload {
  costs?:        number;
  delivery_date: string;   // ISO combiné : date + heure de deliveryTime
}

/**
 * Fusionne deliveryDate (Date) et deliveryTime ("HH:mm")
 * en remplaçant la partie heure de deliveryDate par deliveryTime.
 *
 * Exemple :
 *   deliveryDate = new Date("2025-05-10")
 *   deliveryTime = "14:00"
 *   → delivery_date = "2025-05-10T14:00:00.000Z"
 */
export function buildDeliveryPayload(
  date:   Date,
  time:   string,
  costs = 0,
): DeliveryPayload {
  const [hours, minutes] = time.split(':').map(Number);

  const combined = new Date(date);          // clone pour ne pas muter l'original
  combined.setHours(hours, minutes, 0, 0);  // ← remplace le time

  return {
    costs,
    delivery_date: combined.toISOString(),
  };
}

export interface DeliveryOrderItem {
  product_id:     number;
  product_slug:   string;
  product_name:   string;
  price:          number;
  quantity:       number;
  declination_id?: number;
  declination_sku?: string;
}
 
export interface DeliveryOrder {
  customer:      Customer;
  items:         DeliveryOrderItem[];
  total:         number;
  delivery_date: string;       // ISO date "2025-05-10"
  delivery_time?: string;      // ex: "14:00"
  note?:         string;
  address?:      string;
}
 
// Commande hors ligne enrichie (remplace OfflineOrder basique)
export type OfflineDeliveryOrder = DeliveryOrder & {
  localId:      string;
  accountId:    string;
  status:       'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt:    number;
  syncAttempts: number;
  serverId?:    number;
  syncError?:   string;
};
 
  
  export interface Currency{
    iso_code : string;
    symbol: string;
    name: string;
    country: string;
    exchange_rate: number;
  }

  export interface Declination{
    id: number;
    price: number;
    quantity: number;
    sku: string;
    declination_images?: [];
    values : Values[];
  }

  export interface Values{
    id: number;
    value: string;
    color?: string;
    attribute: Attribute 
  }

  export interface Attribute{
    id: number;
    name: string;
    type: string;
    shop_id: string;
    account_id: string;
  }

  export enum OrderStatus {
    PENDING = 'pending',
    PAID = 'paid',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
  }
  
  export interface Address {
    id?: number;
    full_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone: string;
    is_default?: boolean;
  }
  
  export enum PaymentMethod {
    CREDIT_CARD = 'credit_card',
    PAYPAL = 'paypal',
    APPLE_PAY = 'apple_pay',
    GOOGLE_PAY = 'google_pay',
  }
  
  // 2. Types API (@types/api.ts)
  export interface ApiResponse<T> {
    status: boolean;
    message: string;
    data?: T;
    errors?: Record<string, string[]>;
  }
  
  export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }
  
  export interface SocialLoginRequest {
    provider: 'google' | 'apple' | 'facebook';
    token: string;
    userData?: {
      name?: string;
      email?: string;
    };
  }
  
  export interface AuthAccountResponse {
  user: AccountUser;
  token: string;
  refresh_token: string;
  }

  export interface Review{
    
  }

  // 🔐 Types spécifiques à l'auth

export interface LoginPayload {
  email: string;
  password: string;
}

// Offline 
  
  export interface OfflineOrderItem {
    id: number;
    product_id: number;
    product: Product;
    quantity: number;
    price: number;
    selected_attributes?: Record<string, string>;
  }

  export type SyncResult = {
    synced: number;
    failed: number;
    errors: string[];
  };
  // 
  export type SavedAccount = {
  id: string;              // uuid local
  user: AccountUser;
  token: string;
  refreshToken?: string;
  pinHash: string | null;  // null = pas de PIN configuré
  avatarColor: string;     // couleur générée automatiquement
  addedAt: number;
  lastUsedAt: number;
  isActive: boolean;
};

export type MultiAccountStore = {
  accounts: SavedAccount[];
  activeAccountId: string | null;
};

export type PaymentMethodType = 'cash' | 'card';
 
export interface OrderPaymentPayload {
  payment_method : PaymentMethodType;
  amount_paid    : number;   // 0 = pas de paiement immédiat
  discount       : number;   // réduction fixe
}
 
export interface OrderFinancialSummary {
  subtotal    : number;
  discount    : number;
  total_net   : number;
  amount_paid : number;
  balance     : number;
}