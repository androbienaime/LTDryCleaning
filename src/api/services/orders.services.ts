// src/api/services/orders_services.ts

import apiClient from '@/src/api/client';
import type { ApiResponse, Order, CartItem, OrderStatus } from '@/src/@types/models';

// ─── Helpers URL ──────────────────────────────────────────────────────────────

const url = {
  orders:   (shopId: string)             => `/shops/${shopId}/orders`,
  order:    (shopId: string, id: string | number) => `/shops/${shopId}/orders/${id}`,
  state:    (shopId: string, id: number) => `/shops/${shopId}/orders/${id}/state`,
  subTotal: (shopId: string)             => `/shops/${shopId}/orders/calculate-sub-total`,
  total:    (shopId: string)             => `/shops/${shopId}/orders/calculate-total`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// export function generateOrderReference(): string {
//   const ts  = Date.now().toString(36).toUpperCase();
//   const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
//   return `ORD-${ts}-${rnd}`;
// }

export function generateOrderReference(max: number = 99999): string {
  const min = 15600;

  if (max < min) {
    throw new Error("Le maximum doit être supérieur ou égal à 15600.");
  }

  const random = Math.floor(Math.random() * (max - min + 1)) + min;

  return random.toString();
}

export function generateSecureKey(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Calcule le sous-total d'un CartItem côté client.
 * Priorité : prix déclinaison > prix remisé > prix de base.
 */
export function itemSubTotal(item: CartItem): number {
  const unitPrice =
    item.Declination?.price ??
    item.product.discount_price ??
    item.product.price ??
    0;
  return unitPrice * item.quantity;
}

/**
 * Convertit les CartItem en order_products attendu par OrderRequest.php.
 * Inclut sub_totals (requis|numeric|min:0 dans la validation Laravel).
 */
export function cartItemsToOrderProducts(cartItems: CartItem[]) {
  return cartItems.map((item) => ({
    id:          item.product.id,
    quantity:    item.quantity,
    product :   item.product,
    sub_totals:  itemSubTotal(item),
    declination: item.Declination?.id ?? null,
    delivery:    null,
    discount:    0,
    offer_price: item.offerPrice ?? null,   // ← transmis tel quel au backend

  }));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ordersService = {

  async getOrders(shopId: string): Promise<Order[]> {
    const raw = await apiClient.get<ApiResponse<Order[]>>(url.orders(shopId));
    return raw.data ?? [];
  },

  async getOrder(shopId: string, orderId: string | number): Promise<Order> {
    const raw = await apiClient.get<ApiResponse<Order>>(url.order(shopId, orderId));
    if (!raw.data) throw new Error('Commande introuvable');
    return raw.data;
  },

  async createOrder(shopId: string, order: Order): Promise<Order> {
    const raw = await apiClient.post<ApiResponse<Order>>(url.orders(shopId), order);
    if (!raw.data) throw new Error(raw.message ?? 'Erreur création commande');
    return raw.data;
  },

  async updateOrder(shopId: string, orderId: string, data: Partial<Order>): Promise<Order> {
    // throw new Error("Error : " + JSON.stringify(data));
    const raw = await apiClient.put<ApiResponse<Order>>(url.order(shopId, orderId), data);
    if (!raw.data) throw new Error(raw.message ?? 'Erreur mise à jour commande');
    return raw.data;
  },

  // async updateStatus(shopId: string, orderId: string, data: Partial<OrderStatus>): Promise<OrderStatus> {
  //   // throw new Error("Error : " + JSON.stringify(data));
  //   const raw = await apiClient.put<ApiResponse<OrderStatus>>(url.order(shopId, orderId), data);
  //   if (!raw.data) throw new Error(raw.message ?? 'Erreur mise à jour commande');
  //   return raw.data;
  // },

  

  async deleteOrder(shopId: string, orderId: number): Promise<void> {
    await apiClient.delete(url.order(shopId, orderId));
  },

  async getAvailableStates(shopId: string, orderId: number): Promise<Record<string, string>> {
    const raw = await apiClient.get<ApiResponse<Record<string, string>>>(url.state(shopId, orderId));
    return raw.data ?? {};
  },

  async changeState(
    shopId:   string,
    orderId:  number,
    state:    string,
    options?: { reason?: string; tracking_number?: string }
  ): Promise<Order> {
    const raw = await apiClient.post<ApiResponse<Order>>(
      url.state(shopId, orderId),
      { state, ...options }
    );
    if (!raw.data) throw new Error(raw.message ?? 'Erreur changement état');
    return raw.data;
  },

  async calculateSubTotal(shopId: string, data: {
    product:         string;
    currency_id:     string | number;
    quantity:        number;
    delivery_id?:    number | null;
    declination_id?: number | null;
  }): Promise<number> {
    const raw = await apiClient.post<ApiResponse<number>>(url.subTotal(shopId), data);
    return raw.data ?? 0;
  },

  async calculateTotal(shopId: string, data: {
    order_products: { product: string; quantity: number; delivery_id?: number | null; declination_id?: number | null; discount?: number }[];
    currency_id:    string | number;
    coupon?:        string;
  }): Promise<number> {
    const raw = await apiClient.post<ApiResponse<number>>(url.total(shopId), data);
    return raw.data ?? 0;
  },
};