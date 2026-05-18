// services/auth.service.ts
import { AccountUser, AuthAccountResponse, LoginPayload } from '@/src/@types/models';
import apiClient from '../client';
import { ApiResponse } from '@/src/@types/api';
import { storage } from '@/utils/storage';
import API_CONFIG from '../config';
import axios from 'axios';

export const authService = {

  async login(payload: LoginPayload): Promise<AuthAccountResponse> {
    // ✅ CORRECTION : apiClient.post<T> retourne déjà response.data de type T
    // Donc on type directement <ApiResponse<AuthAccountResponse>> et on accède à .data
    // pour obtenir AuthAccountResponse — pas de double .data.data
    const response = await apiClient.post<ApiResponse<AuthAccountResponse>>(
      '/account/login',
      payload
    );
    
    const data = response.data; // Type : AuthAccountResponse
    return {
      user: data.account, // 🔥 mapping ici
      token: data.token,
      refresh_token: data.refresh_token,
    };

  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthAccountResponse> {
    const response = await apiClient.post<ApiResponse<AuthAccountResponse>>(
      '/account/register',
      payload
    );
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/account/logout');
  },

  async me(): Promise<AccountUser> {
    const response = await apiClient.get<ApiResponse<AccountUser>>('/account/me');
    return response.data;
  },

  // async refreshToken(refresh_token: string): Promise<AuthAccountResponse> {
  //   const response = await apiClient.post<ApiResponse<AuthAccountResponse>>(
  //     '/account/refresh',
  //     { refresh_token }
  //   );
  //   return response.data;
  // },

  // ✅ La route /account/refresh est publique et lit le token
  // depuis le header Authorization (pas depuis le body).
  // On envoie le refresh_token comme Bearer → JWT le renouvelle.
  // On utilise axios direct pour éviter la boucle infinie avec l'interceptor 401.
  async refreshToken(refreshToken: string): Promise<AuthAccountResponse> {
    const response = await axios.post<ApiResponse<AuthAccountResponse>>(
      `${API_CONFIG.BASE_URL}/account/refresh`,
      {},  // body vide
      {
        headers: {
          ...API_CONFIG.HEADERS,
          Authorization: `Bearer ${refreshToken}`, // ← token dans le header
        },
      }
    );
 
    const result = response.data.data;
 
    await storage.setData('auth_token',    result.token);
    await storage.setData('refresh_token', result.refresh_token);
 
    return result;
  },
};