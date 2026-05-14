// src/api/services/orders_service.ts

import apiClient from '@/src/api/client';
import type { ApiResponse, Order, CartItem } from '@/src/@types/models';

// ─── Helpers URL ──────────────────────────────────────────────────────────────

const url = {
  orders:    (shopId: string)                  => `/shops/${shopId}/orders`,
  order:     (shopId: string, id: number)      => `/shops/${shopId}/orders/${id}`,
  state:     (shopId: string, id: number)      => `/shops/${shopId}/orders/${id}/state`,
  subTotal:  (shopId: string)                  => `/shops/${shopId}/orders/calculate-sub-total`,
  total:     (shopId: string)                  => `/shops/${shopId}/orders/calculate-total`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateOrderReference(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rnd}`;
}

export function generateSecureKey(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// Convertit les CartItem en order_products attendu par le backend
export function cartItemsToOrderProducts(cartItems: CartItem[]) {
  return cartItems.map((item) => ({
    id:          item.product.id,
    quantity:    item.quantity,
    declination: item.Declination?.id   ?? null,
    delivery:    null,
    discount:    0,
  }));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ordersService = {

  // GET /shops/{shop}/orders
  async getOrders(shopId: string): Promise<Order[]> {
    const raw = await apiClient.get<ApiResponse<Order[]>>(url.orders(shopId));
    return raw.data ?? [];
  },

  // GET /shops/{shop}/orders/{order}
  async getOrder(shopId: string, orderId: number): Promise<Order> {
    const raw = await apiClient.get<ApiResponse<Order>>(url.order(shopId, orderId));
    if (!raw.data) throw new Error('Commande introuvable');
    return raw.data;
  },

  // POST /shops/{shop}/orders
  // Utilise Order comme base — les champs correspondent au OrderRequest Laravel
  async createOrder(shopId: string, order: {
    customer_id:        number;   // vrai ID backend du customer
    currency_id:        string;
    account_id?:        string | null;
    order_amount:       number;
    total_amount_order: number;
    reference_order:    string;
    secure_key:         string;
    has_delivery:       boolean;
    balance?:           number;
    total_discount?:    number;
    order_products:     ReturnType<typeof cartItemsToOrderProducts>;
  }): Promise<Order> {
    const raw = await apiClient.post<ApiResponse<Order>>(url.orders(shopId), {
      customer:           order.customer_id,
      currency:           order.currency_id,
      account:            order.account_id ?? null,
      order_amount:       order.order_amount,
      total_amount_order: order.total_amount_order,
      reference_order:    order.reference_order,
      secure_key:         order.secure_key,
      has_delivery:       order.has_delivery,
      balance:            order.balance           ?? 0,
      total_discount:     order.total_discount    ?? 0,
      order_products:     order.order_products,
    });
    if (!raw.data) throw new Error(raw.message ?? 'Erreur création commande');
    return raw.data;
  },

  // PUT /shops/{shop}/orders/{order}
  async updateOrder(shopId: string, orderId: number, data: Partial<Order>): Promise<Order> {
    const raw = await apiClient.put<ApiResponse<Order>>(url.order(shopId, orderId), data);
    if (!raw.data) throw new Error(raw.message ?? 'Erreur mise à jour commande');
    return raw.data;
  },

  // DELETE /shops/{shop}/orders/{order}
  async deleteOrder(shopId: string, orderId: number): Promise<void> {
    await apiClient.delete(url.order(shopId, orderId));
  },

  // GET /shops/{shop}/orders/{order}/state
  async getAvailableStates(shopId: string, orderId: number): Promise<Record<string, string>> {
    const raw = await apiClient.get<ApiResponse<Record<string, string>>>(
      url.state(shopId, orderId)
    );
    return raw.data ?? {};
  },

  // POST /shops/{shop}/orders/{order}/state
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

  // POST /shops/{shop}/orders/calculate-sub-total
  async calculateSubTotal(shopId: string, data: {
    product:         string; // slug
    currency_id:     string;
    quantity:        number;
    delivery_id?:    number | null;
    declination_id?: number | null;
  }): Promise<number> {
    const raw = await apiClient.post<ApiResponse<number>>(url.subTotal(shopId), data);
    return raw.data ?? 0;
  },

  // POST /shops/{shop}/orders/calculate-total
  async calculateTotal(shopId: string, data: {
    order_products: { product: string; quantity: number; delivery_id?: number | null; declination_id?: number | null; discount?: number }[];
    currency_id:    string;
    coupon?:        string;
  }): Promise<number> {
    const raw = await apiClient.post<ApiResponse<number>>(url.total(shopId), data);
    return raw.data ?? 0;
  },
};