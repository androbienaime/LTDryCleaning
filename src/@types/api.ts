import { User, Product, Order, CartItem } from './models';

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface ProductsQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: string;
  featured?: boolean;
  per_page?: number;  // Modifié de 'limit' à 'per_page'
}

export interface CategoriesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  featured?: boolean;
}
export interface CustomersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  featured?: boolean;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface CreateOrderRequest {
  items: { productId: string; variantId?: string; quantity: number }[];
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  paymentMethod: {
    type: 'card' | 'paypal' | 'applepay' | 'googlepay';
    details: Record<string, string>;
  };
}