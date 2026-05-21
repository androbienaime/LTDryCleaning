// context/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useMultiAccount } from '@/context/MultiAccountContext';
import { MultiAccountStorage } from '@/utils/multiAccountStorage';
import { extractIsSuperAdmin, extractPermissions } from '@/utils/jwt';
import { AccountUser, SavedAccount } from '@/src/@types/models';
import { authService } from '@/src/api/services/auth.service';
import { storage } from '@/utils/storage';
import { AppSetup } from '@/utils/appSetup';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginOptions = {
  saveAccount?: boolean;
  pin?: string;
};

type AuthContextType = {
  user: AccountUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, options?: LoginOptions) => Promise<void>;
  register: (email: string, password: string, name: string, options?: LoginOptions) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateProfile: (userData: Partial<AccountUser>) => Promise<void>;
  /**
   * Vérifie si l'utilisateur a une permission dans un shop donné.
   * Lit les permissions depuis le JWT (pas de requête DB).
   *
   * @example
   * hasPermission(shop.id, 'product.create')
   */
  hasPermission: (shopId: string | number, permission: string) => boolean;
  isSuperAdmin: (shopId : string | number) => boolean;
  clearError: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  updateProfile: async () => {},
  hasPermission: () => false,
  isSuperAdmin: () => false,
  clearError: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeAccount, addAccount } = useMultiAccount();

  const [user, setUser] = useState<AccountUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Sync avec le compte actif ──────────────────────────────────────────────
  useEffect(() => {
    const syncAuth = async () => {
      if (activeAccount) {
        // Rehydrate les permissions depuis le token stocké
        const permissions = extractPermissions(activeAccount.token);
        setUser({ ...activeAccount.user, permissions });

        await storage.setData('auth_token', activeAccount.token);
        await storage.setData('refresh_token', activeAccount.refreshToken);
      } else {
        setUser(null);
        await storage.removeData('auth_token');
        await storage.removeData('refresh_token');
      }

      setIsLoading(false);
    };

    syncAuth();
  }, [activeAccount]);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = async (
    email: string,
    password: string,
    options: LoginOptions = { saveAccount: true },
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const { user: apiUser, token, refresh_token } = await authService.login({ email, password });

      // Extrait les permissions embarquées dans le JWT
      const permissions = extractPermissions(token);
      const userWithPermissions: AccountUser = { ...apiUser, permissions };


    // ── ✅ Vérification shop ───────────────────────────────────────────────
    // Si un SHOP_ID est configuré (setup déjà effectué), on bloque tout
    // utilisateur qui n'est pas associé à ce shop.
    const configuredShopId = await AppSetup.getConfig().then(c => c.shopId);

    if (configuredShopId) {
      const userShopIds = (userWithPermissions.shop ?? []).map(s => String(s.id));

      if (!userShopIds.includes(String(configuredShopId))) {
        // On nettoie immédiatement les tokens déjà écrits par authService
        throw new Error(
          `Accès refusé : votre compte n'est pas associé à ce shop.`
        );
      }
    }

      await storage.setData('auth_token', token);
      await storage.setData('refresh_token', refresh_token);

      if (options.saveAccount !== false) {
        // addAccount → activeAccount change → useEffect sync "user" automatiquement
        await addAccount({
          user: userWithPermissions,
          token,
          refreshToken: refresh_token,
          pin: options.pin,
        });
      } else {
        setUser(userWithPermissions);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Échec de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────

  const register = async (
    email: string,
    password: string,
    name: string,
    options: LoginOptions = { saveAccount: true },
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const { user: apiUser, token, refresh_token } = await authService.register({
        name,
        email,
        password,
        password_confirmation: password,
      });

      const permissions = extractPermissions(token);
      const userWithPermissions: AccountUser = { ...apiUser, permissions };

      await storage.setData('auth_token', token);
      await storage.setData('refresh_token', refresh_token);

      if (options.saveAccount !== false) {
        await addAccount({
          user: userWithPermissions,
          token,
          refreshToken: refresh_token,
          pin: options.pin,
        });
      } else {
        setUser(userWithPermissions);
      }
    } catch (e: any) {
      setError(e?.message ?? "Échec de l'inscription.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  // Ne supprime pas le compte du gestionnaire → prochain lancement demande le PIN.

  const logout = async () => {
    try {
      setIsLoading(true);

      // Invalide le token côté serveur (optionnel)
      // try { await authService.logout(); } catch {}

      await storage.removeData('auth_token');
      await storage.removeData('refresh_token');

      const store = await MultiAccountStorage.getStore();
      store.activeAccountId = null;
      store.accounts = store.accounts.map((a: SavedAccount) => ({ ...a, isActive: false }));
      await MultiAccountStorage.saveStore(store);

      setUser(null);
    } catch {
      setError('Échec de la déconnexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────

  const forgotPassword = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);
      // await authService.forgotPassword(email);
    } catch (e: any) {
      setError(e?.message ?? "Échec de l'envoi de l'email.");
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // ── Update profile ─────────────────────────────────────────────────────────

  const updateProfile = async (userData: Partial<AccountUser>) => {
    try {
      if (!user) throw new Error('Non connecté');
      setIsLoading(true);
      setError(null);

      const updatedUser: AccountUser = { ...user, ...userData };

      if (activeAccount) {
        await MultiAccountStorage.upsertAccount({
          user: updatedUser,
          token: activeAccount.token,
          refreshToken: activeAccount.refreshToken,
          existingAccountId: activeAccount.id,
        });
        // useEffect sur activeAccount mettra "user" à jour automatiquement
      } else {
        setUser(updatedUser);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Échec de la mise à jour.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── hasPermission ──────────────────────────────────────────────────────────

  const hasPermission = (shopId: string | number, permission: string): boolean => {
    const perms = user?.permissions?.[String(shopId)] ?? [];
    return perms.includes(permission);
  };

  const isSuperAdmin = (): boolean => {
    const token = activeAccount?.token;
    if (!token) return false;
    return extractIsSuperAdmin(token);
  };

  const clearError = () => setError(null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        forgotPassword,
        updateProfile,
        hasPermission,
        isSuperAdmin,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;