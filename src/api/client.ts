// src/api/apiClient.ts
//
// ⚠️ PRINCIPE CLÉ :
// La source de vérité des tokens est MultiAccountStorage (par compte).
// storage.setData('auth_token') n'est qu'un cache temporaire de la session active.
// À chaque requête, on lit le token du compte ACTIF dans MultiAccountStorage
// pour ne jamais utiliser le token d'un autre compte.

import axios from 'axios';
import type { AxiosRequestConfig, AxiosError, AxiosInstance } from 'axios';
import { storage } from '@/utils/storage';
import { MultiAccountStorage } from '@/utils/multiAccountStorage';
import { extractPermissions } from '@/utils/jwt';
import API_CONFIG from '@/src/api/config';
import type { SavedAccount } from '@/src/@types/models';

// ── Helper : lire le token du compte actif ────────────────────────────────────
// Toujours lire depuis MultiAccountStorage pour éviter les collisions entre comptes.

async function getActiveToken(): Promise<string | null> {
  const account = await MultiAccountStorage.getActiveAccount();
  return account?.token ?? null;
}

async function getActiveRefreshToken(): Promise<string | null> {
  const account = await MultiAccountStorage.getActiveAccount();
  return account?.refreshToken ?? account?.token ?? null;
}

// ── Helper : persister les nouveaux tokens sur le compte actif ────────────────

async function persistTokensOnActiveAccount(
  token:        string,
  refreshToken: string,
): Promise<void> {
  const store = await MultiAccountStorage.getStore();

  store.accounts = store.accounts.map((a: SavedAccount) => {
    if (a.isActive) {
      return { ...a, token, refreshToken };
    }
    return a;
  });

  await MultiAccountStorage.saveStore(store);

  // Mettre à jour aussi le cache storage (utilisé comme fallback rapide)
  await storage.setData('auth_token',    token);
  await storage.setData('refresh_token', refreshToken);
}

// ─────────────────────────────────────────────────────────────────────────────

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject:  (err: unknown) => void;
  }> = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: API_CONFIG.HEADERS,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {

    // REQUEST : injecte le token du compte ACTIF (pas storage global)
    this.instance.interceptors.request.use(
      async (config) => {
        const token = await getActiveToken(); // ← compte actif uniquement
        if (token) {
          config.headers.set?.('Authorization', `Bearer ${token}`);
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // RESPONSE : refresh automatique sur 401
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        if (error.response?.status !== 401 || originalRequest?._retry) {
          return Promise.reject(error);
        }

        if (this.isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            this.failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.set?.('Authorization', `Bearer ${token}`);
            return this.instance(originalRequest);
          });
        }

        this.isRefreshing = true;
        originalRequest._retry = true;

        try {
          // Lire le refresh token du compte ACTIF
          const refreshToken = await getActiveRefreshToken();

          // Appel direct axios (pas apiClient) pour éviter la boucle infinie.
          // /account/refresh est public et lit depuis le header Authorization.
          const response = await axios.post<{
            status: string;
            data:   { token: string; refresh_token: string };
          }>(
            `${API_CONFIG.BASE_URL}/account/refresh`,
            {},
            {
              headers: {
                ...API_CONFIG.HEADERS,
                Authorization: `Bearer ${refreshToken}`,
              },
            },
          );

          const { token, refresh_token: newRefreshToken } = response.data.data;

          // Persister sur le compte actif (MultiAccountStorage + cache storage)
          await persistTokensOnActiveAccount(token, newRefreshToken);

          // Synchroniser les permissions JWT
          await this.syncPermissionsAfterRefresh(token, newRefreshToken);

          this.processQueue(null, token);

          originalRequest.headers.set?.('Authorization', `Bearer ${token}`);
          return this.instance(originalRequest);

        } catch (refreshError) {
          this.processQueue(refreshError, null);

          // Ne pas supprimer les tokens globalement —
          // seulement désactiver le compte actif
          const store = await MultiAccountStorage.getStore();
          store.activeAccountId = null;
          store.accounts = store.accounts.map((a: SavedAccount) =>
            ({ ...a, isActive: false })
          );
          await MultiAccountStorage.saveStore(store);

          await storage.removeData('auth_token');
          await storage.removeData('refresh_token');

          // eventEmitter.emit('auth:logout');

          return Promise.reject(refreshError);
        } finally {
          this.isRefreshing = false;
        }
      },
    );
  }

  private processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach((p) => {
      error ? p.reject(error) : p.resolve(token!);
    });
    this.failedQueue = [];
  }

  private async syncPermissionsAfterRefresh(
    token:        string,
    refreshToken: string,
  ): Promise<void> {
    try {
      const permissions = extractPermissions(token);
      const store = await MultiAccountStorage.getStore();
      store.accounts = store.accounts.map((a: SavedAccount) => {
        if (a.isActive) {
          return {
            ...a,
            token,
            refreshToken,
            user: { ...a.user, permissions },
          };
        }
        return a;
      });
      await MultiAccountStorage.saveStore(store);
    } catch {
      // Non bloquant
    }
  }

  // ── HTTP methods ────────────────────────────────────────────────────────────

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return (await this.instance.get<T>(url, config)).data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return (await this.instance.post<T>(url, data, config)).data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return (await this.instance.put<T>(url, data, config)).data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return (await this.instance.patch<T>(url, data, config)).data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return (await this.instance.delete<T>(url, config)).data;
  }
}

const apiClient = new ApiClient();
export default apiClient;

// ── extractApiError ───────────────────────────────────────────────────────────

export type ApiError = {
  message: string;
  errors:  Record<string, string[]> | null;
  status:  number | null;
  raw:     unknown;
};

export function extractApiError(e: unknown): ApiError {
  const axiosResponse = (e as any)?.response;

  if (axiosResponse) {
    const data   = axiosResponse.data ?? {};
    const status = axiosResponse.status ?? null;
    const message = data.message ?? data.error ?? `Erreur HTTP ${status}`;
    const errors: Record<string, string[]> | null = data.errors ?? null;
    return { message, errors, status, raw: data };
  }

  return {
    message: (e as any)?.message ?? 'Erreur réseau inconnue',
    errors:  null,
    status:  null,
    raw:     e,
  };
}

export function formatApiErrors(apiError: ApiError): string {
  if (apiError.errors) {
    return Object.entries(apiError.errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('\n');
  }
  return apiError.message;
}