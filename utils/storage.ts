import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  User, Product, CartItem, Order, Address, Category, Declination,
  buildCartItemId, resolveBasePrice,
} from '../src/@types/models';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token', REFRESH_TOKEN: 'refresh_token', USER: 'user',
  CART: 'cart', FAVORITES: 'favorites', RECENT_PRODUCTS: 'recent_products',
  ADDRESSES: 'addresses', RECENTLY_VIEWED: 'recently_viewed', SEARCH_HISTORY: 'search_history',
};

// ═══════════════════════════════════════════════════════════
// STORAGE SERVICE (inchangé)
// ═══════════════════════════════════════════════════════════

export class StorageService {
  static isAvailable(): boolean {
    try { AsyncStorage.setItem('__t__', '__t__'); AsyncStorage.removeItem('__t__'); return true; }
    catch { return false; }
  }
  static async setData(key: string, value: any): Promise<void> {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error(`setData(${key}):`, e); }
  }
  static async getData(key: string): Promise<any> {
    try { const v = await AsyncStorage.getItem(key); return v === null ? null : JSON.parse(v); }
    catch (e) { console.error(`getData(${key}):`, e); return null; }
  }
  static async removeData(key: string): Promise<void> {
    try { await AsyncStorage.removeItem(key); }
    catch (e) { console.error(`removeData(${key}):`, e); }
  }
  static setItem<T>(key: string, value: T): void { this.setData(key, value); }
  static getItem<T>(key: string, defaultValue: T): Promise<T> {
    return this.getData(key).then((d: any) => d === null ? defaultValue : d);
  }
  static removeItem(key: string): void { this.removeData(key); }
  static async clear(): Promise<void> { try { await AsyncStorage.clear(); } catch (e) { console.error(e); } }
}

// ═══════════════════════════════════════════════════════════
// AUTH STORAGE (inchangé)
// ═══════════════════════════════════════════════════════════

export class AuthStorage {
  static async setToken(t: string)           { await StorageService.setData(STORAGE_KEYS.AUTH_TOKEN, t); }
  static async getToken(): Promise<string | null> { return StorageService.getData(STORAGE_KEYS.AUTH_TOKEN); }
  static async setRefreshToken(t: string)    { await StorageService.setData(STORAGE_KEYS.REFRESH_TOKEN, t); }
  static async getRefreshToken(): Promise<string | null> { return StorageService.getData(STORAGE_KEYS.REFRESH_TOKEN); }
  static async hasToken(): Promise<boolean>  { return (await this.getToken()) !== null; }
  static async setUser(u: User)              { await StorageService.setData(STORAGE_KEYS.USER, u); }
  static async getUser(): Promise<User | null> { return StorageService.getData(STORAGE_KEYS.USER); }
  static async setAuth(d: { token: string; refreshToken?: string; user: User }) {
    await this.setToken(d.token);
    if (d.refreshToken) await this.setRefreshToken(d.refreshToken);
    await this.setUser(d.user);
  }
  static async clearAuth() {
    await StorageService.removeData(STORAGE_KEYS.AUTH_TOKEN);
    await StorageService.removeData(STORAGE_KEYS.REFRESH_TOKEN);
    await StorageService.removeData(STORAGE_KEYS.USER);
  }
}

// ═══════════════════════════════════════════════════════════
// CART STORAGE  ← MODIFIÉ
// ═══════════════════════════════════════════════════════════

export class CartStorage {

  static async getItems(): Promise<CartItem[]> {
    const cart = await StorageService.getData(STORAGE_KEYS.CART);
    return cart ?? [];
  }

  static async setItems(items: CartItem[]): Promise<void> {
    await StorageService.setData(STORAGE_KEYS.CART, items);
  }

  /**
   * Ajoute ou incrémente un article dans le panier.
   *
   * La clé d'unicité est buildCartItemId(product.id, offerPrice) :
   *   "42__base"   → produit 42 au prix catalogue
   *   "42__80"     → produit 42 avec offre à 80
   *   "42__65"     → produit 42 avec offre à 65  (ligne distincte)
   *
   * Même produit + prix différent = articles séparés.
   */
  static async addItem(
    product:      Product,
    quantity:     number = 1,
    declination?: Declination,
    offerPrice?:  number | null,
  ): Promise<CartItem[]> {
    const currentCart = await this.getItems();

    const offer        = offerPrice ?? null;
    const cartKey      = buildCartItemId(product.id, offer);
    const base         = resolveBasePrice(product, declination);
    const displayPrice = offer ?? base;

    // Article déjà présent avec la même clé → incrémenter la quantité
    const existingIndex = currentCart.findIndex((item) => item.id === cartKey);
    if (existingIndex >= 0) {
      currentCart[existingIndex].quantity += quantity;
      await this.setItems(currentCart);
      return currentCart;
    }

    // Nouvel article
    const newItem: CartItem = {
      id:           cartKey,
      product_slug: product.slug,
      product,
      quantity,
      Declination:  declination,
      basePrice:    base,
      offerPrice:   offer,
      displayPrice,
    };

    currentCart.push(newItem);
    await this.setItems(currentCart);
    return currentCart;
  }

  /** @param cartItemId  clé composite string ex: "42__base" ou "42__80" */
  static async updateQuantity(cartItemId: string, quantity: number): Promise<CartItem[]> {
    const currentCart = await this.getItems();
    const idx = currentCart.findIndex((item) => item.id === cartItemId);
    if (idx >= 0) {
      if (quantity <= 0) currentCart.splice(idx, 1);
      else currentCart[idx].quantity = quantity;
      await this.setItems(currentCart);
    }
    return currentCart;
  }

  /** @param cartItemId  clé composite string ex: "42__base" ou "42__80" */
  static async removeItem(cartItemId: string): Promise<CartItem[]> {
    const updated = (await this.getItems()).filter((item) => item.id !== cartItemId);
    await this.setItems(updated);
    return updated;
  }

  static async clearCart(): Promise<void> {
    await StorageService.setData(STORAGE_KEYS.CART, []);
  }

  static async getTotalAmount(): Promise<number> {
    const items = await this.getItems();
    return items.reduce((total, item) => {
      const price =
        item.displayPrice ??
        item.offerPrice ??
        item.basePrice ??
        (item.Declination?.price && item.Declination.price > 0
          ? item.Declination.price
          : item.product?.discount_price || item.product?.price || 0);
      return total + price * item.quantity;
    }, 0);
  }

  static async getItemCount(): Promise<number> {
    const items = await this.getItems();
    return items.reduce((count, item) => count + item.quantity, 0);
  }
}

// ═══════════════════════════════════════════════════════════
// AUTRES STORAGES (inchangés)
// ═══════════════════════════════════════════════════════════

export class FavoritesStorage {
  static async getFavoriteIds(): Promise<number[]>              { return (await StorageService.getData(STORAGE_KEYS.FAVORITES)) ?? []; }
  static async isFavorite(id: number): Promise<boolean>        { return (await this.getFavoriteIds()).includes(id); }
  static async addFavorite(id: number): Promise<number[]>      { const f = await this.getFavoriteIds(); if (!f.includes(id)) { f.push(id); await StorageService.setData(STORAGE_KEYS.FAVORITES, f); } return f; }
  static async removeFavorite(id: number): Promise<number[]>   { const f = (await this.getFavoriteIds()).filter(x => x !== id); await StorageService.setData(STORAGE_KEYS.FAVORITES, f); return f; }
  static async toggleFavorite(id: number): Promise<boolean>    { if (await this.isFavorite(id)) { await this.removeFavorite(id); return false; } await this.addFavorite(id); return true; }
}

export class AddressStorage {
  static async getAddresses(): Promise<Address[]>              { return (await StorageService.getData(STORAGE_KEYS.ADDRESSES)) ?? []; }
  static async addAddress(address: Address): Promise<Address[]> {
    const list = await this.getAddresses();
    const item = { ...address, id: address.id ?? Date.now() };
    if (item.is_default) list.forEach(a => { a.is_default = false; });
    list.push(item); await StorageService.setData(STORAGE_KEYS.ADDRESSES, list); return list;
  }
  static async updateAddress(id: number, updated: Address): Promise<Address[]> {
    const list = await this.getAddresses(); const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) { if (updated.is_default) list.forEach(a => { a.is_default = false; }); list[idx] = { ...updated, id }; await StorageService.setData(STORAGE_KEYS.ADDRESSES, list); }
    return list;
  }
  static async removeAddress(id: number): Promise<Address[]>  { const list = (await this.getAddresses()).filter(a => a.id !== id); await StorageService.setData(STORAGE_KEYS.ADDRESSES, list); return list; }
  static async getDefaultAddress(): Promise<Address | undefined> { return (await this.getAddresses()).find(a => a.is_default); }
}

export class RecentViewsStorage {
  private static readonly MAX = 20;
  static async getRecentlyViewed(): Promise<Product[]>         { return (await StorageService.getData(STORAGE_KEYS.RECENTLY_VIEWED)) ?? []; }
  static async addRecentlyViewed(p: Product): Promise<Product[]> {
    const list = (await this.getRecentlyViewed()).filter(x => x.id !== p.id);
    list.unshift(p); const limited = list.slice(0, this.MAX);
    await StorageService.setData(STORAGE_KEYS.RECENTLY_VIEWED, limited); return limited;
  }
  static async removeRecentlyViewed(id: number): Promise<Product[]> { const list = (await this.getRecentlyViewed()).filter(p => p.id !== id); await StorageService.setData(STORAGE_KEYS.RECENTLY_VIEWED, list); return list; }
  static async clearRecentlyViewed(): Promise<void>            { await StorageService.setData(STORAGE_KEYS.RECENTLY_VIEWED, []); }
}

export class SearchHistoryStorage {
  private static readonly MAX = 20;
  static async getSearchHistory(): Promise<string[]>           { return (await StorageService.getData(STORAGE_KEYS.SEARCH_HISTORY)) ?? []; }
  static async addSearchTerm(term: string): Promise<string[]> {
    if (!term.trim()) return this.getSearchHistory();
    const list = (await this.getSearchHistory()).filter(t => t.toLowerCase() !== term.toLowerCase());
    list.unshift(term); const limited = list.slice(0, this.MAX);
    await StorageService.setData(STORAGE_KEYS.SEARCH_HISTORY, limited); return limited;
  }
  static async removeSearchTerm(term: string): Promise<string[]> { const list = (await this.getSearchHistory()).filter(t => t.toLowerCase() !== term.toLowerCase()); await StorageService.setData(STORAGE_KEYS.SEARCH_HISTORY, list); return list; }
  static async clearSearchHistory(): Promise<void>             { await StorageService.setData(STORAGE_KEYS.SEARCH_HISTORY, []); }
}

export default { StorageService, AuthStorage, CartStorage, FavoritesStorage, AddressStorage, RecentViewsStorage, SearchHistoryStorage };
export const storage = StorageService;