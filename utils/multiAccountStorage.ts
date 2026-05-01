import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountUser } from '@/src/@types/models';
import { AuthStorage } from './storage';
import { SavedAccount, MultiAccountStore } from '@/src/@types/models';
// ─── Types ────────────────────────────────────────────────────────────────────




// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = '@ecommerce:multi_accounts';

const AVATAR_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#059669', '#0284C7', '#0891B2',
];

// ─── Hashing simple (sans dépendance native) ──────────────────────────────────
// Pour la production, remplacer par expo-crypto ou react-native-sha256

function hashPin(pin: string, salt: string): string {
  // djb2 hash combiné avec salt — suffisant pour un PIN local
  let hash = 5381;
  const str = pin + salt;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32bit
  }
  return hash.toString(16).padStart(8, '0');
}

function generateSalt(accountId: string): string {
  return `${accountId}_ecommerce_salt_2024`;
}

function generateId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pickAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class MultiAccountStorage {
  // Lire le store complet
  static async getStore(): Promise<MultiAccountStore> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return { accounts: [], activeAccountId: null };
      return JSON.parse(raw) as MultiAccountStore;
    } catch {
      return { accounts: [], activeAccountId: null };
    }
  }

  // Persister le store
  static async saveStore(store: MultiAccountStore): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  // Ajouter ou mettre à jour un compte après login
  static async upsertAccount(params: {
    user: AccountUser;
    token: string;
    refreshToken?: string;
    pin?: string;           // PIN en clair — sera haché
    existingAccountId?: string;
  }): Promise<SavedAccount> {
    const store = await this.getStore();
    // Vérifier si un compte avec ce user.id existe déjà
        // console.log(params.existingAccountId, 'Existing params');

    const existingIndex = store.accounts.findIndex((a) => {
      return a.user.id === params.user.id || a.id === params.existingAccountId;
    });



    if (existingIndex >= 0) {
      const existing = store.accounts[existingIndex];
      const updated: SavedAccount = {
        ...existing,
        user: params.user,
        token: params.token,
        refreshToken: params.refreshToken ?? existing.refreshToken,
        pinHash: params.pin
          ? hashPin(params.pin, generateSalt(existing.id))
          : existing.pinHash,
        lastUsedAt: Date.now(),
        isActive: true,
      };
      store.accounts[existingIndex] = updated;
      store.activeAccountId = updated.id;
      await this.saveStore(store);
      return updated;
    }
    // Nouveau compte
    const id = generateId();
    const newAccount: SavedAccount = {
      id,
      user: params.user,
      token: params.token,
      refreshToken: params.refreshToken,
      pinHash: params.pin ? hashPin(params.pin, generateSalt(id)) : null,
      avatarColor: pickAvatarColor(store.accounts.length),
      addedAt: Date.now(),
      lastUsedAt: Date.now(),
      isActive: true,
    };

    // Désactiver les autres
    store.accounts = store.accounts.map((a) => ({ ...a, isActive: false }));
    store.accounts.push(newAccount);
    store.activeAccountId = id;

    await this.saveStore(store);
    return newAccount;
  }

  // Définir/modifier le PIN d'un compte
  static async setPin(accountId: string, pin: string): Promise<void> {
    const store = await this.getStore();
    const idx = store.accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) throw new Error('Compte introuvable');
    store.accounts[idx].pinHash = hashPin(pin, generateSalt(accountId));
    await this.saveStore(store);
  }

  // Supprimer le PIN d'un compte
  static async removePin(accountId: string): Promise<void> {
    const store = await this.getStore();
    const idx = store.accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) throw new Error('Compte introuvable');
    store.accounts[idx].pinHash = null;
    await this.saveStore(store);
  }

  // Vérifier un PIN → retourne le compte correspondant ou null
  static async verifyPin(pin: string): Promise<SavedAccount | null> {
    const store = await this.getStore();
    for (const account of store.accounts) {
      if (!account.pinHash) continue;
      const hash = hashPin(pin, generateSalt(account.id));
      if (hash === account.pinHash) return account;
    }
    return null;
  }

  // Activer un compte (switch)
  static async switchToAccount(accountId: string): Promise<SavedAccount | null> {
    const store = await this.getStore();
    const idx = store.accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) return null;

    store.accounts = store.accounts.map((a) => ({
      ...a,
      isActive: a.id === accountId,
      lastUsedAt: a.id === accountId ? Date.now() : a.lastUsedAt,
    }));
    store.activeAccountId = accountId;

    await this.saveStore(store);
    return store.accounts[idx];
  }

  // Supprimer un compte
  static async removeAccount(accountId: string): Promise<MultiAccountStore> {
    const store = await this.getStore();
    store.accounts = store.accounts.filter((a) => a.id !== accountId);

    if (store.activeAccountId === accountId) {
      // Basculer sur le compte le plus récent
      const sorted = [...store.accounts].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      store.activeAccountId = sorted[0]?.id ?? null;
      if (store.activeAccountId) {
        store.accounts = store.accounts.map((a) => ({
          ...a,
          isActive: a.id === store.activeAccountId,
        }));
      }
    }

    await this.saveStore(store);
    return store;
  }

  // Récupérer le compte actif
  static async getActiveAccount(): Promise<SavedAccount | null> {
    const store = await this.getStore();
    if (!store.activeAccountId) return null;
    return store.accounts.find((a) => a.id === store.activeAccountId) ?? null;
  }

  // Comptes ayant un PIN configuré
  static async getAccountsWithPin(): Promise<SavedAccount[]> {
    const store = await this.getStore();
    return store.accounts.filter((a) => a.pinHash !== null);
  }

  // Vider tous les comptes
  static async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // Sauvegarder le token du compte actif dans le stockage global
  static async saveAuthToken(token: string): Promise<void> {
    await AuthStorage.setToken(token);
  }

  // Supprimer le token du stockage global
  static async clearAuthToken(): Promise<void> {
    await AuthStorage.setToken('');
  }
}

export { hashPin, generateSalt };