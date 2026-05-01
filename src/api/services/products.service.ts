import apiClient from '../client';
import { ApiResponse, PaginatedResponse, ProductsQueryParams } from '@/src/@types/api';
import { Product, Review } from '@/src/@types/models';

export const productsService = {
  async getProducts(params: ProductsQueryParams = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>('/products', { params });
    return response.data;  // Ajustement pour s'adapter à la structure de réponse
  },

  async getProductsByShop(shopId: string, params: ProductsQueryParams = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>(`/shops/${shopId}/products`, { params });
    return response.data;  // Ajustement pour s'adapter à la structure de réponse
  },

  async getProductById(id: string): Promise<Product> {
    const response = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
    return response.data;
  },

  async getProductsByCategory(categoryId: string, params: ProductsQueryParams = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>(`/categories/${categoryId}/products`, { params });
    return response.data;
  },

  async searchProducts(query: string, params: ProductsQueryParams = {}): Promise<PaginatedResponse<Product>> {
    const searchParams = { ...params, search: query };
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>('/products/search', { params: searchParams });
    return response.data;
  },

  async getFeaturedProducts(): Promise<Product[]> {
    const response = await apiClient.get<ApiResponse<Product[]>>('/products/featured');
    return response.data;
  },

  async getProductReviews(productId: string): Promise<Review[]> {
    const response = await apiClient.get<ApiResponse<Review[]>>(`/products/${productId}/reviews`);
    return response.data;
  },

  async submitProductReview(productId: string, rating: number, comment: string): Promise<Review> {
    const response = await apiClient.post<ApiResponse<Review>>(`/products/${productId}/reviews`, { rating, comment });
    return response.data;
  }
};