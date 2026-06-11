import { useCart as useCartContext } from "@/context/CartContext";
import { useCallback } from "react";
import { Declination, Product } from "@/src/@types/models";

export function useCart() {
  const cartContext = useCartContext();

  /**
   * Ajoute un produit au panier avec vérification de stock.
   * offerPrice → ligne distincte du même produit sans offre.
   */
  const addProductToCart = useCallback(
    async (
      product:      Product,
      quantity:     number = 1,
      declination?: Declination,
      offerPrice?:  number | null,
    ): Promise<{ success: boolean; message: string }> => {
      try {
        if (quantity <= 0) {
          return { success: false, message: "La quantité doit être supérieure à 0" };
        }

        const stockQuantity = declination?.quantity ?? product.stock_quantity;
        if (!product.has_unlimited_stock && stockQuantity < quantity) {
          return { success: false, message: `Stock insuffisant. Maximum disponible: ${stockQuantity}` };
        }

        await cartContext.addToCart(product, quantity, declination, offerPrice ?? null);
        return { success: true, message: "Produit ajouté au panier avec succès" };
      } catch (error) {
        console.error("Erreur ajout panier:", error);
        return { success: false, message: "Une erreur est survenue lors de l'ajout au panier" };
      }
    },
    [cartContext]
  );

  const calculateProductPrice = useCallback((product: Product): number => {
    return (product.discount_price ?? 0) > 0 ? product.discount_price! : product.price;
  }, []);

  const canAddToCart = useCallback(
    (product: Product, quantity: number = 1): boolean => {
      if (product.has_unlimited_stock) return true;
      return product.stock_quantity >= quantity;
    },
    []
  );

  return {
    ...cartContext,
    addProductToCart,
    calculateProductPrice,
    canAddToCart,
  };
}

export default useCart;