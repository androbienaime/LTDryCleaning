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
  }
  
// ═══════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════
 
  export interface Order {
    id: number;
    account_id: number;
    items: OrderItem[];
    status: OrderStatus;
    shipping_address: Address;
    billing_address: Address;
    payment_method: PaymentMethod;
    total_amount: number;
    created_at: string;
    updated_at: string;
  }

  
// Commande créée hors ligne, en attente de synchronisation
export type OfflineOrder={
  localId: string;        // ID temporaire local
  accountId: string;      // compte propriétaire
  items: OrderItem[];
  total: number;
  address?: string;
  note?: string;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt: number;
  syncAttempts: number;
  serverId?: number;      // ID assigné par le serveur après sync réussie
  syncError?: string;
};
  
  export interface OrderItem {
    id: number;
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
  id?:          string | number;
  firstname?:   string;           // optionnel
  lastname?:    string;           // optionnel
  name?:        string;           // nom complet (pour contacts téléphoniques)
  middle_name?: string;           // optionnel
  phone:        string;           // seul champ obligatoire
  email?:       string;
  address?:     string;
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

