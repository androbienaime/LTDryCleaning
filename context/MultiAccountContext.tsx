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

  // Ajouter un compte après login API
  addAccount: (params: {
    user: AccountUser;
    token: string;
    refreshToken?: string;
    pin?: string;
  }) => Promise<SavedAccount>;

  // Basculer vers un compte (switch manuel)
  switchToAccount: (accountId: string) => Promise<void>;

  // Vérifier un PIN et switcher automatiquement
  verifyPinAndSwitch: (pin: string) => Promise<SavedAccount | null>;

  // Configurer / modifier le PIN d'un compte
  setAccountPin: (accountId: string, pin: string) => Promise<void>;

  // Supprimer le PIN d'un compte
  removeAccountPin: (accountId: string) => Promise<void>;

  // Supprimer un compte enregistré
  removeAccount: (accountId: string) => Promise<void>;

  // Comptes qui ont un PIN configuré
  accountsWithPin: SavedAccount[];

  // Y a-t-il au moins un compte avec PIN (pour afficher l'écran PIN au démarrage)
  hasPinAccounts: boolean;

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

  // const switchToAccount = async (accountId: string) => {
  //   try {
  //     const token = await 
  //     setIsLoading(true);
  //     await MultiAccountStorage.switchToAccount(accountId);
  //     await loadStore();
  //   } catch (e) {
  //     setError('Impossible de changer de compte.');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // context/MultiAccountContext.tsx — switchToAccount mis à jour

const switchToAccount = async (accountId: string) => {
  try {
    setIsLoading(true);
 
    // 1. Basculer le compte actif dans le store
    const switched = await MultiAccountStorage.switchToAccount(accountId);
    if (!switched) throw new Error('Compte introuvable');
 
    console.log("Switched successfuly for email : " + switched.user.email);
    // 2. Écrire les tokens sauvegardés de ce compte
    await RefreshToken(accountId, switched.token, switched.refreshToken);
 
    await loadStore();
 
  // } catch (e) {
    // setError('Impossible de changer de compte.');
  } finally {
    setIsLoading(false);
  }
};

  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // exp est en secondes
      const currentTime = Date.now() / 1000;

      return payload.exp < currentTime;

    } catch (e) {
      return true;
    }
  };
  
  
  const RefreshToken = async(accountId: string, token1 : string, refreshToken : string | undefined) => {

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected && netState.isInternetReachable;

    // const { isOnline } = useOffline();
     // 2. Écrire les tokens sauvegardés de ce compte
    //    (authService.refreshToken va les écraser avec les nouveaux si le refresh réussit)
    await storage.setData('auth_token',    token1);
    await storage.setData('refresh_token', refreshToken ?? token1);
 
    if(isTokenExpired(token1) && isOnline) {
      console.log('[MultiAccount] Token expiré détecté pour le compte ' + accountId);
      // 3. Refresh silencieux via authService
      //    → utilise axios direct (pas de boucle infinie)
      //    → sauvegarde automatiquement les nouveaux tokens dans storage
      try {
        const { token, refresh_token } = await authService.refreshToken(
          refreshToken ?? token1
        );
  
        console.log('[MultiAccount] Refresh réussi — tokens mis à jour : ' + token);
        // Mettre à jour le store avec les nouveaux tokens
        const store = await MultiAccountStorage.getStore();
        store.accounts = store.accounts.map((a) =>
          a.id === accountId
            ? { ...a, token, refreshToken: refresh_token }
            : a
        );
        await MultiAccountStorage.saveStore(store);
  
      } catch(e) {
        // Refresh échoué → tokens sauvegardés utilisés
        // L'interceptor 401 de client.ts tentera un nouveau refresh à la prochaine requête
        console.warn('[MultiAccount] Refresh silencieux échoué — token sauvegardé utilisé');
          const apiError = extractApiError(e);
          console.warn('  message :', apiError.message);
          console.warn('  errors  :', JSON.stringify(apiError.errors, null, 2));
          console.warn('  status  :', apiError.status);
          console.warn('  raw     :', JSON.stringify(apiError.raw, null, 2));
      }
    }else {
      console.log('[MultiAccount] Token valide — pas de refresh nécessaire pour le compte ' + accountId);
    }
  }

  const verifyPinAndSwitch = async (pin: string): Promise<SavedAccount | null> => {
    try {
      const account = await MultiAccountStorage.verifyPin(pin);
      if (account) {
        const switched = await MultiAccountStorage.switchToAccount(account.id);
        if (!switched) throw new Error('Compte introuvable');

        // 2. Écrire les tokens sauvegardés de ce compte
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
      }}
    >
      {children}
    </MultiAccountContext.Provider>
  );
};

export default MultiAccountProvider;