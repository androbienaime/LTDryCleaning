import { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, Declination } from '@/src/@types/models';
import useDisabledAttributeValues from '@/hooks/useDisabledAttributeValues';
import { useCart } from '@/hooks/useCart'; // Import the enhanced useCart hook instead
import { useProducts } from '@/context/ProductContext';

export default function useProductDetails(product: Product) {
    const [selectedDeclinations, setSelectedDeclinations] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState<number>(1);
    const [currentPrice, setCurrentPrice] = useState<number>(product.price);
    const [currentImages, setCurrentImages] = useState<string[]>(product.images ?? []);
    const [maxQuantity, setMaxQuantity] = useState<number>(product.stock_quantity);
    const { isProductInCart, addProductToCart } = useCart(); // Use addProductToCart from enhanced hook

    const { isFromCache, apiStatus } = useProducts();
    const isOnline = apiStatus === 'online' && !isFromCache ? true : false;

    // Organiser les attributs et valeurs des déclinaisons
    const organizedValues = useMemo(() => {
        const attributeMap: Record<number, { id: number; values: any[]; name: string; type: string }> = {};

        product.declination?.forEach((item) => {
            item.values.forEach((val) => {
                const attrId = val.attribute.id;
                if (!attributeMap[attrId]) {
                    attributeMap[attrId] = {
                        id: val.id,
                        values: [],
                        name: val.attribute.name,
                        type: val.attribute.type
                    };
                }

                const attr = attributeMap[attrId];
                let existingValue = attr.values.find((v) => v.id === val.id);
                if (!existingValue) {
                    existingValue = {
                        id: val.id,
                        value: val.value,
                        color: val.color,
                        attribute: val.attribute
                    };
                    attr.values.push(existingValue);
                }
            });
        });

        return attributeMap;
    }, [product.declination]);

    // Utiliser notre hook pour déterminer les valeurs désactivées
    const disabledValues = useDisabledAttributeValues(product.declination, selectedDeclinations);

    // Fonction pour trouver la déclinaison correspondante aux sélections actuelles
    const findMatchingDeclination = useMemo(() => {
        // Si aucune sélection n'est faite, on retourne undefined
        if (Object.keys(selectedDeclinations).length === 0) {
            return undefined;
        }

        // Le nombre d'attributs sélectionnés
        const selectedAttributesCount = Object.keys(selectedDeclinations).length;
        
        // On récupère le nombre d'attributs unique dans la première déclinaison
        const firstDecl = product.declination?.[0];
        if (!firstDecl) return undefined;
        
        const uniqueAttrsInFirstDecl = new Set(firstDecl.values.map(v => v.attribute.name));
        const expectedAttributesCount = uniqueAttrsInFirstDecl.size;
        
        // On vérifie si tous les attributs nécessaires sont sélectionnés
        if (selectedAttributesCount !== expectedAttributesCount) {
            return undefined;
        }

        // Chercher la déclinaison qui correspond aux valeurs sélectionnées
        return product.declination?.find(declination => {
            // Créer un mapping des attributs de cette déclinaison
            const declinationAttrs: Record<string, string> = {};
            declination.values.forEach(v => {
                declinationAttrs[v.attribute.name] = v.id.toString();
            });

            // Vérifier si toutes les sélections correspondent
            return Object.entries(selectedDeclinations).every(([attrName, valueId]) => {
                return declinationAttrs[attrName] === valueId;
            });
        });
    }, [product.declination, selectedDeclinations]);

    // Mettre à jour le prix et les images lorsqu'une déclinaison complète est sélectionnée
    useEffect(() => {
        const matchingDeclination = findMatchingDeclination;
        
        if (matchingDeclination) {
            // Mettre à jour le prix si la déclinaison a un prix spécifique
            if (matchingDeclination.price > 0) {
                setCurrentPrice(matchingDeclination.price);
            } else {
                // Revenir au prix par défaut du produit
                setCurrentPrice(product.price);
            }
            
            if(matchingDeclination.quantity >= 1){
                setMaxQuantity(matchingDeclination.quantity);
            }
            // Mettre à jour les images si la déclinaison a des images spécifiques
            if (matchingDeclination.declination_images && matchingDeclination.declination_images.length > 0) {
                if(isOnline){
                    setCurrentImages(matchingDeclination.declination_images);

                }else{
                    setCurrentImages(product.localImages);
                }
            } else {
                // Revenir aux images par défaut du produit
                if(isOnline){
                    setCurrentImages(product.images);
                }else{                     
                    setCurrentImages(product.localImages);
                }
            }
        } else {
            // Si aucune déclinaison complète n'est sélectionnée, revenir aux valeurs par défaut
            setCurrentPrice(product.price);
            if(isOnline){
                setCurrentImages(product.images);
            }else{                     
                setCurrentImages(product.localImages);
            }            
            
            setMaxQuantity(product.stock_quantity);
        }
    }, [findMatchingDeclination, product.price, product.images, product.stock_quantity]);

    const handleDeclinationSelect = (attributeName: string, value: string) => {
        setSelectedDeclinations((prev) => ({
            ...prev,
            [attributeName]: value,
        }));
      
        // Clear error for this attribute if any
        setErrors((prev) => {
            const updated = { ...prev };
            delete updated[attributeName];
            return updated;
        });
    };
      
    const handleQuantityChange = (value: number) => {
        setQuantity(value);
    };

    const validateSelections = () => {
        const missingSelections: Record<string, string> = {};
      
        // Vérifier si tous les attributs nécessaires sont sélectionnés
        Object.values(organizedValues).forEach((item) => {
            if (!selectedDeclinations[item.name]) {
                missingSelections[item.name] = `Veuillez sélectionner une valeur pour ${item.name}`;
            }
        });
      
        if (Object.keys(missingSelections).length > 0) {
            setErrors(missingSelections);
            return false;
        }
        
        return true;
    };

    // Fonction pour ajouter le produit au panier
    const handleAddToCart = useCallback(async () => {
        if (!validateSelections()) {
            return;       
        }
        
        // Trouver la déclinaison correspondante à utiliser
        const matchingDeclination = findMatchingDeclination;
        
        try {
            // Utiliser la fonction améliorée d'ajout au panier 
            const result = await addProductToCart(
                product, 
                quantity, 
                matchingDeclination as Declination
            );
            
            if (result.success) {
                // Afficher une confirmation de succès
                console.log("Succès", result.message);
            } else {
                // Afficher l'erreur
                console.log("Erreur", result.message);
            }
        } catch (error) {
            console.error("Erreur lors de l'ajout au panier:", error);
            console.log("Erreur", "Impossible d'ajouter le produit au panier");
        }
    }, [product, quantity, findMatchingDeclination, addProductToCart, validateSelections]);

    // Vérifier si le produit est déjà dans le panier avec les mêmes attributs
    const isInCart = useMemo(() => {
        // Pour être cohérent avec l'implémentation du useCart
        const matchingDeclination = findMatchingDeclination as Declination | undefined;
        return isProductInCart(product.slug, matchingDeclination);
    }, [product.slug, findMatchingDeclination, isProductInCart]);

    return {
        organizedValues,
        selectedDeclinations,
        errors,
        quantity,
        currentPrice,
        currentImages,
        maxQuantity,
        disabledValues,
        findMatchingDeclination,
        handleDeclinationSelect,
        handleQuantityChange,
        handleAddToCart,
        validateSelections,
        isInCart
    };
}