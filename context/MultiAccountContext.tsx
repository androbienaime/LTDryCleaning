// context/MultiAccountContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { SavedAccount, MultiAccountStore } from '@/src/@types/models';
import { MultiAccountStorage } from '@/utils/multiAccountStorage';
import { AuthStorage } from '@/utils/storage';
import { storage } from '@/utils/storage';
import { AccountUser } from '@/src/@types/models';
import { authService } from '@/src/api/services/auth.service';
import { refresh } from '@react-native-community/netinfo';
import { extractApiError } from '@/src/api/client';
import NetInfo from '@react-native-community/netinfo';
// ─── Types ────────────────────────────────────────────────────────────────────

type MultiAccountContextType = {
  accounts: SavedAccount[];
  activeAccount: SavedAccount | null;
  isLoading: boolean;
  error: string | null;

  addAccount: (params: {
    user: AccountUser;
    token: string;
    refreshToken?: string;
    pin?: string;
  }) => Promise<SavedAccount>;

  switchToAccount: (accountId: string) => Promise<void>;
  verifyPinAndSwitch: (pin: string) => Promise<SavedAccount | null>;
  setAccountPin: (accountId: string, pin: string) => Promise<void>;
  removeAccountPin: (accountId: string) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  accountsWithPin: SavedAccount[];
  hasPinAccounts: boolean;

  RefreshToken?: (accountId: string, token1: string, refreshToken: string | undefined) => Promise<void>;

  /**
   * Appelé quand le token est définitivement irrécupérable (expiré + refresh échoué).
   * Efface les tokens du storage et retire le compte actif → l'app redirige vers le PIN.
   */
  logoutExpiredAccount: (accountId: string) => Promise<void>;

  clearError: () => void;
  reload: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const MultiAccountContext = createContext<MultiAccountContextType>({
  accounts: [],
  activeAccount: null,
  isLoading: true,
  error: null,
  addAccount: async () => { throw new Error('Not initialized'); },
  switchToAccount: async () => {},
  verifyPinAndSwitch: async () => null,
  setAccountPin: async () => {},
  removeAccountPin: async () => {},
  removeAccount: async () => {},
  accountsWithPin: [],
  hasPinAccounts: false,
  logoutExpiredAccount: async () => {},
  clearError: () => {},
  reload: async () => {},
});

export const useMultiAccount = () => useContext(MultiAccountContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const MultiAccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [store, setStore] = useState<MultiAccountStore>({
    accounts: [],
    activeAccountId: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Charger le store au démarrage ──────────────────────────────────────────
  const loadStore = useCallback(async () => {
    try {
      setIsLoading(true);
      const loaded = await MultiAccountStorage.getStore();
      setStore(loaded);
    } catch (e) {
      setError('Impossible de charger les comptes enregistrés.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  // Update auth_token in storage when active account changes
  useEffect(() => {
    const updateAuthToken = async () => {
      if (activeAccount?.token) {
        await MultiAccountStorage.saveAuthToken(activeAccount.token);
      } else {
        await MultiAccountStorage.clearAuthToken();
      }
    };
    updateAuthToken();
  }, [activeAccount]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const activeAccount =
    store.accounts.find((a) => a.id === store.activeAccountId) ?? null;

  const accountsWithPin = store.accounts.filter((a) => a.pinHash !== null);
  const hasPinAccounts = accountsWithPin.length > 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  const addAccount: MultiAccountContextType['addAccount'] = async (params) => {
    try {
      setIsLoading(true);
      const account = await MultiAccountStorage.upsertAccount(params);
      await loadStore();
      return account;
    } catch (e) {
      setError("Impossible d'ajouter le compte.");
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const switchToAccount = async (accountId: string) => {
    try {
      setIsLoading(true);
      const switched = await MultiAccountStorage.switchToAccount(accountId);
      if (!switched) throw new Error('Compte introuvable');
      console.log("Switched successfuly for email : " + switched.user.email);
      await RefreshToken(accountId, switched.token, switched.refreshToken);
      await loadStore();
    } finally {
      setIsLoading(false);
    }
  };

  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (e) {
      return true;
    }
  };

  const RefreshToken = async (accountId: string, token1: string, refreshToken: string | undefined) => {
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected && netState.isInternetReachable;

    await storage.setData('auth_token',    token1);
    await storage.setData('refresh_token', refreshToken ?? token1);

    if (isTokenExpired(token1) && isOnline) {
      console.log('[MultiAccount] Token expiré détecté pour le compte ' + accountId);
      try {
        const { token, refresh_token } = await authService.refreshToken(
          refreshToken ?? token1
        );
        console.log('[MultiAccount] Refresh réussi — tokens mis à jour : ' + token);
        const store = await MultiAccountStorage.getStore();
        store.accounts = store.accounts.map((a) =>
          a.id === accountId
            ? { ...a, token, refreshToken: refresh_token }
            : a
        );
        await MultiAccountStorage.saveStore(store);

      } catch (e) {
        console.warn('[MultiAccount] Refresh silencieux échoué — token sauvegardé utilisé');
        const apiError = extractApiError(e);
        console.warn('  message :', apiError.message);
        console.warn('  status  :', apiError.status);

        // ─── NOUVEAU ───────────────────────────────────────────────────────
        // Le refresh a échoué (token révoqué / trop vieux).
        // On marque le token comme invalide dans le store SANS supprimer
        // le compte → l'écran PIN pourra se réafficher proprement.
        console.warn('[MultiAccount] Refresh irrécupérable → invalidation du token');
        await logoutExpiredAccount(accountId);
        // ───────────────────────────────────────────────────────────────────
      }
    } else {
      console.log('[MultiAccount] Token valide — pas de refresh nécessaire pour le compte ' + accountId);
    }
  };

  /**
   * Efface les tokens du storage et désactive le compte actif.
   * Ne supprime PAS le compte (le PIN reste) → l'écran PIN se réaffiche.
   * Appelé par RefreshToken() en cas de refresh irrécupérable,
   * et par ProductContext quand isExpired est détecté côté produits.
   */
  const logoutExpiredAccount = async (accountId: string) => {
    try {
      console.warn('[MultiAccount] logoutExpiredAccount → nettoyage des tokens pour ' + accountId);

      // 1. Vider les tokens du storage global (ce que lit axios)
      await storage.setData('auth_token',    '');
      await storage.setData('refresh_token', '');
      await MultiAccountStorage.clearAuthToken();

      // 2. Invalider les tokens dans le store du compte (sans le supprimer)
      const currentStore = await MultiAccountStorage.getStore();
      currentStore.accounts = currentStore.accounts.map((a) =>
        a.id === accountId
          ? { ...a, token: '', refreshToken: '' }
          : a
      );
      // 3. Désactiver le compte actif → force la navigation vers le PIN
      currentStore.activeAccountId = null;
      await MultiAccountStorage.saveStore(currentStore);

      // 4. Recharger le store en mémoire → les observers (navigation) réagissent
      await loadStore();

    } catch (e) {
      console.error('[MultiAccount] Erreur dans logoutExpiredAccount :', e);
    }
  };

  const verifyPinAndSwitch = async (pin: string): Promise<SavedAccount | null> => {
    try {
      const account = await MultiAccountStorage.verifyPin(pin);
      if (account) {
        const switched = await MultiAccountStorage.switchToAccount(account.id);
        if (!switched) throw new Error('Compte introuvable');
        await RefreshToken(account.id, switched.token, switched.refreshToken);
        console.log('[MultiAccount] PIN vérifié pour le compte ' + account.user.email);
        await loadStore();
      }
      return account;
    } catch {
      setError('Erreur lors de la vérification du PIN.');
      return null;
    }
  };

  const setAccountPin = async (accountId: string, pin: string) => {
    try {
      await MultiAccountStorage.setPin(accountId, pin);
      await loadStore();
    } catch {
      setError('Impossible de configurer le PIN.');
    }
  };

  const removeAccountPin = async (accountId: string) => {
    try {
      await MultiAccountStorage.removePin(accountId);
      await loadStore();
    } catch {
      setError('Impossible de supprimer le PIN.');
    }
  };

  const removeAccount = async (accountId: string) => {
    try {
      setIsLoading(true);
      await MultiAccountStorage.removeAccount(accountId);
      await loadStore();
    } catch {
      setError('Impossible de supprimer le compte.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <MultiAccountContext.Provider
      value={{
        accounts: store.accounts,
        activeAccount,
        isLoading,
        error,
        addAccount,
        switchToAccount,
        verifyPinAndSwitch,
        setAccountPin,
        removeAccountPin,
        removeAccount,
        accountsWithPin,
        hasPinAccounts,
        clearError,
        reload: loadStore,
        RefreshToken,
        logoutExpiredAccount,
      }}
    >
      {children}
    </MultiAccountContext.Provider>
  );
};

export default MultiAccountProvider;