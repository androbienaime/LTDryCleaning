// src/api/services/customers_service.ts

import apiClient from '@/src/api/client';
import type { ApiResponse, Currency, Customer, Shop } from '@/src/@types/models';
import { CustomersQueryParams, PaginatedResponse } from '@/src/@types/api';

export const customersService = {

  async getAll(shopId: string): Promise<Customer[]> {
    const raw = await apiClient.get<ApiResponse<Customer[]>>(
      `/shops/${shopId}/customers`
    );
    return raw.data ?? [];
  },

  async getCustomersByShop(shopId: string, params: CustomersQueryParams = {}): Promise<PaginatedResponse<Shop>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Shop>>>(`/shops/${shopId}/customers`, { params });
    if (!response.data) throw new Error('Erreur récupération clients');
    return response.data;  // Ajustement pour s'adapter à la structure de réponse
  },

  async create(shopId: string, customer: Customer): Promise<Customer> {
    console.log('Creating customer with data:', customer);
    const raw = await apiClient.post<ApiResponse<Customer>>(
      `/shops/${shopId}/customers`,
      {
        id : null, 
        name : customer.name,
        firstname: customer.firstname,
        lastname: customer.lastname,
        phone : customer.phone,
        email : customer.email,
        // address : customer.address,
      }
    );
    if (!raw.data) throw new Error(raw.message ?? 'Erreur création client');
    return raw.data;
  },

  async update(shopId: string, customer: Customer): Promise<Customer> {
    const raw = await apiClient.put<ApiResponse<Customer>>(
      `/shops/${shopId}/customers/${customer.id}`,
      {
        lastname:    customer.lastname,
        firstname:   customer.firstname,
        phone:   customer.phone,
        email:   customer.email,
        address: customer.address,
        // note:    customer.note,
      }
    );
    if (!raw.data) throw new Error(raw.message ?? 'Erreur mise à jour client');
    return raw.data;
  },

  async remove(shopId: string, customerId: string): Promise<void> {
    await apiClient.delete(`/shops/${shopId}/customers/${customerId}`);
  },

  // Cherche le customer par téléphone, le crée s'il n'existe pas.
  // Retourne toujours un Customer avec un vrai ID backend (number).
  async findOrCreate(shopId: string, customer: Customer): Promise<Customer> {
    
    try {
      const all = await this.getAll(shopId);
      const found = all.find((c) => c.phone === customer.phone);
      if (found) return found;
    } catch {
      // getAll échoue → on tente la création directement
    }
    return this.create(shopId, customer);
  },
};