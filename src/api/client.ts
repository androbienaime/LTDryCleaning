// src/api/apiClient.ts
import axios from 'axios';
import type { AxiosRequestConfig, AxiosError, AxiosInstance } from 'axios';
import { storage } from '@/utils/storage';
import { MultiAccountStorage } from '@/utils/multiAccountStorage';
import { extractPermissions } from '@/utils/jwt';
import API_CONFIG from '@/src/api/config';
import type { SavedAccount } from '@/src/@types/models';

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: API_CONFIG.HEADERS,
    });

    this.setupInterceptors();
  }

  // ── Interceptors ────────────────────────────────────────────────────────────

  private setupInterceptors(): void {
    // REQUEST : injecte le Bearer token automatiquement
    this.instance.interceptors.request.use(
      async (config) => {
        const token = await storage.getData('auth_token');
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

        // Plusieurs requêtes simultanées → mise en file d'attente
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
          const refresh_token = await storage.getData('refresh_token');

          const response = await axios.post<{ token: string }>(
            `${API_CONFIG.BASE_URL}/account/refresh`,
            { refresh_token },
          );

          const { token } = response.data;

          // Persiste les nouveaux tokens
          await storage.setData('auth_token', token);
          await storage.setData('refresh_token', token);

          // Met à jour les permissions dans le multi-account storage
          await this.syncPermissionsAfterRefresh(token);

          this.processQueue(null, token);

          originalRequest.headers.set?.('Authorization', `Bearer ${token}`);
          return this.instance(originalRequest);

        } catch (refreshError) {
          this.processQueue(refreshError, null);

          await storage.removeData('auth_token');
          await storage.removeData('refresh_token');

          // Déclenche le logout global via event emitter si disponible
          // eventEmitter.emit('auth:logout');

          return Promise.reject(refreshError);
        } finally {
          this.isRefreshing = false;
        }
      },
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach((p) => {
      error ? p.reject(error) : p.resolve(token!);
    });
    this.failedQueue = [];
  }

  /**
   * Après un refresh, les claims JWT contiennent de nouvelles permissions.
   * On les synchronise dans le multi-account storage pour que
   * AuthContext reflète la réalité sans logout/login.
   */
  private async syncPermissionsAfterRefresh(token: string): Promise<void> {
    try {
      const permissions = extractPermissions(token);
      const store = await MultiAccountStorage.getStore();
      store.accounts = store.accounts.map((a: SavedAccount) => {
        if (a.isActive) {
          return {
            ...a,
            token,
            refreshToken: token,
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

  // ── HTTP methods ─────────────────────────────────────────────────────────────

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const r = await this.instance.get<T>(url, config);
    return r.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const r = await this.instance.post<T>(url, data, config);
    return r.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const r = await this.instance.put<T>(url, data, config);
    return r.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const r = await this.instance.patch<T>(url, data, config);
    return r.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const r = await this.instance.delete<T>(url, config);
    return r.data;
  }
}

const apiClient = new ApiClient();
export default apiClient;

// ── extractApiError ──────────────────────────────────────────────────────────
//
// Axios met le vrai corps de réponse dans error.response.data.
// Laravel retourne :
//   { message: "...", errors: { field: ["msg"] } }  ← validation 422
//   { message: "...", error: "..." }                ← erreur 500 applicative
//
// Cette fonction extrait tout ça pour l'afficher lisiblement dans les logs
// ou le montrer à l'utilisateur.

export type ApiError = {
  message: string;                               // message principal
  errors:  Record<string, string[]> | null;      // erreurs de validation champ par champ
  status:  number | null;                        // code HTTP (422, 500, ...)
  raw:     unknown;                              // corps brut pour debug
};

export function extractApiError(e: unknown): ApiError {
  // AxiosError → response.data contient la vraie réponse Laravel
  const axiosResponse = (e as any)?.response;

  if (axiosResponse) {
    const data    = axiosResponse.data ?? {};
    const status  = axiosResponse.status ?? null;

    // Laravel validation (422) : { message, errors: { field: [msg] } }
    // Laravel applicative (500) : { message, error: "string" }
    const message =
      data.message ??
      data.error   ??
      `Erreur HTTP ${status}`;

    const errors: Record<string, string[]> | null =
      data.errors ?? null;

    return { message, errors, status, raw: data };
  }

  // Erreur réseau pure (pas de réponse)
  return {
    message: (e as any)?.message ?? 'Erreur réseau inconnue',
    errors:  null,
    status:  null,
    raw:     e,
  };
}

// Formatte les erreurs de validation en une seule string lisible
// Utile pour les toasts / alerts dans l'UI
export function formatApiErrors(apiError: ApiError): string {
  if (apiError.errors) {
    return Object.entries(apiError.errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('\n');
  }
  return apiError.message;
}