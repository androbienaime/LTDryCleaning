// src/api/services/customers_service.ts

import apiClient from '@/src/api/client';
import type { ApiResponse, Customer } from '@/src/@types/models';
import type { CustomersQueryParams, PaginatedResponse } from '@/src/@types/api';

// ─── Normalisation du téléphone ───────────────────────────────────────────────
// Compare les phones en ignorant espaces, tirets, parenthèses
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().+]/g, '');
}

function phonesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

// ─── Extraire le Customer depuis n'importe quelle shape de réponse ────────────
// Protège contre les APIs qui retournent { data: customer } ou { data: { data: customer } }
function extractCustomer(raw: any): Customer | null {
  if (!raw) return null;

  // Shape 1 : raw.data est directement le customer (a un id)
  if (raw.data && (raw.data.id !== undefined || raw.data.phone)) {
    // Vérifie si c'est une réponse paginée (a un champ "data" qui est un tableau)
    if (Array.isArray(raw.data.data)) {
      return raw.data.data[0] ?? null;
    }
    return raw.data as Customer;
  }

  // Shape 2 : raw est directement le customer
  if (raw.id !== undefined || raw.phone) {
    return raw as Customer;
  }

  return null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const customersService = {

  /**
   * Récupère tous les customers d'un shop (sans pagination).
   */
  async getAll(shopId: string): Promise<Customer[]> {
    try {
      const raw = await apiClient.get<any>(`/shops/${shopId}/customers`);

      // Gère les différentes shapes de réponse
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw.data)) return raw.data;
      if (Array.isArray(raw.data?.data)) return raw.data.data;
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Récupère les customers paginés d'un shop.
   */
  async getPaginated(
    shopId: string,
    params: CustomersQueryParams = {}
  ): Promise<PaginatedResponse<Customer>> {
    const raw = await apiClient.get<ApiResponse<PaginatedResponse<Customer>>>(
      `/shops/${shopId}/customers`,
      { params }
    );
    if (!raw.data) throw new Error('Erreur récupération clients');
    return raw.data;
  },

  /**
   * Crée un customer et retourne l'objet créé avec son ID backend.
   */
  async create(shopId: string, customer: Customer): Promise<Customer> {
    const raw = await apiClient.post<any>(
      `/shops/${shopId}/customers`,
      {
        name:      customer.name ?? `${customer.firstname ?? ''} ${customer.lastname ?? ''}`.trim(),
        firstname: customer.firstname ?? customer.name?.split(' ')[0] ?? '',
        lastname:  customer.lastname  ?? customer.name?.split(' ').slice(-1)[0] ?? '',
        phone:     customer.phone,
        email:     customer.email ?? null,
        address:   customer.address ?? null,
      }
    );

    const created = extractCustomer(raw);
    if (!created) {
      throw new Error(raw?.message ?? 'Erreur création client : réponse inattendue');
    }
    if (!created.id) {
      throw new Error('Erreur création client : ID manquant dans la réponse');
    }
    return created;
  },

  /**
   * Met à jour un customer.
   */
  async update(shopId: string, customer: Customer): Promise<Customer> {
    const raw = await apiClient.put<any>(
      `/shops/${shopId}/customers/${customer.id}`,
      {
        firstname: customer.firstname,
        lastname:  customer.lastname,
        phone:     customer.phone,
        email:     customer.email,
        address:   customer.address,
      }
    );

    const updated = extractCustomer(raw);
    if (!updated) throw new Error(raw?.message ?? 'Erreur mise à jour client');
    return updated;
  },

  /**
   * Supprime un customer.
   */
  async remove(shopId: string, customerId: string | number): Promise<void> {
    await apiClient.delete(`/shops/${shopId}/customers/${customerId}`);
  },

  /**
   * Cherche un customer par téléphone dans le backend.
   * Retourne null s'il n'existe pas.
   */
  async findByPhone(shopId: string, phone: string): Promise<Customer | null> {
    try {
      // Essaie d'abord une recherche par paramètre si le backend le supporte
      const raw = await apiClient.get<any>(`/shops/${shopId}/customers`, {
        params: { search: normalizePhone(phone), limit: 10 },
      });

      let list: Customer[] = [];
      if (Array.isArray(raw)) list = raw;
      else if (Array.isArray(raw.data)) list = raw.data;
      else if (Array.isArray(raw.data?.data)) list = raw.data.data;

      return list.find((c) => phonesMatch(c.phone, phone)) ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Cherche le customer par téléphone dans le backend.
   * Le crée s'il n'existe pas.
   * Retourne TOUJOURS un Customer avec un vrai ID backend (number | string).
   */
  async findOrCreate(shopId: string, customer: Customer): Promise<Customer> {
    // 1. Cherche par téléphone
    const found = await this.findByPhone(shopId, customer.phone);
    if (found) {
      return found;
    }

    // 2. Crée si absent
    console.log('[customersService.findOrCreate] Absent → création');
    const created = await this.create(shopId, customer);
    console.log('[customersService.findOrCreate] Créé avec ID :', created);
    return created;
  },
};