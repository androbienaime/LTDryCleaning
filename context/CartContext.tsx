import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CartStorage } from '@/utils/storage';
import { CartItem, Declination, Product } from '@/src/@types/models';

type CartContextType = {
  cartItems:    CartItem[];
  itemCount:    number;
  totalAmount:  number;
  loading:      boolean;
  addToCart:    (product: Product, quantity: number, declination?: Declination, offerPrice?: number | null) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem:   (cartItemId: string) => Promise<void>;
  clearCart:    () => Promise<void>;
  isProductInCart: (productSlug: string, declination?: Declination) => boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartProviderProps = { children: ReactNode };

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems,   setCartItems]   = useState<CartItem[]>([]);
  const [itemCount,   setItemCount]   = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loading,     setLoading]     = useState<boolean>(true);

  useEffect(() => { loadCartData(); }, []);

  const loadCartData = async () => {
    setLoading(true);
    try {
      const items  = await CartStorage.getItems();
      const count  = await CartStorage.getItemCount();
      const amount = await CartStorage.getTotalAmount();
      setCartItems(items);
      setItemCount(count);
      setTotalAmount(amount);
    } catch (e) {
      console.error('Erreur chargement panier:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshTotals = async (updatedCart: CartItem[]) => {
    setCartItems(updatedCart);
    setItemCount(updatedCart.reduce((c, i) => c + i.quantity, 0));
    setTotalAmount(updatedCart.reduce((t, i) => t + (i.displayPrice ?? i.offerPrice ?? i.basePrice ?? 0) * i.quantity, 0));
  };

  /**
   * Ajoute un produit au panier.
   * offerPrice non-null → ligne distincte du même produit sans offre.
   * "42__base" et "42__80" coexistent comme deux articles séparés.
   */
  const addToCart = async (
    product:      Product,
    quantity:     number,
    declination?: Declination,
    offerPrice?:  number | null,
  ) => {
    setLoading(true);
    try {
      const updatedCart = await CartStorage.addItem(product, quantity, declination, offerPrice ?? null);
      await refreshTotals(updatedCart);
    } catch (e) {
      console.error("Erreur ajout panier:", e);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    setLoading(true);
    try {
      const updatedCart = await CartStorage.updateQuantity(cartItemId, quantity);
      await refreshTotals(updatedCart);
    } catch (e) {
      console.error('Erreur mise à jour quantité:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (cartItemId: string) => {
    setLoading(true);
    try {
      const updatedCart = await CartStorage.removeItem(cartItemId);
      await refreshTotals(updatedCart);
    } catch (e) {
      console.error('Erreur suppression:', e);
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      await CartStorage.clearCart();
      setCartItems([]); setItemCount(0); setTotalAmount(0);
    } catch (e) {
      console.error('Erreur vidage panier:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Vérifie si le produit est dans le panier AU PRIX CATALOGUE (sans offre).
   * Un même produit avec offerPrice est une ligne distincte et n'est pas comptabilisé ici.
   */
  const isProductInCart = (productSlug: string, declination?: Declination): boolean => {
    return cartItems.some((item) => {
      if (item.product_slug !== productSlug) return false;
      if (item.offerPrice != null) return false; // ligne avec offre → ignorée
      if (!declination && !item.Declination) return true;
      if (!declination || !item.Declination) return false;
      return item.Declination.sku === declination.sku;
    });
  };

  return (
    <CartContext.Provider value={{
      cartItems, itemCount, totalAmount, loading,
      addToCart, updateQuantity, removeItem, clearCart, isProductInCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};