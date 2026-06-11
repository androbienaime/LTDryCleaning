import { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, Declination } from '@/src/@types/models';
import useDisabledAttributeValues from '@/hooks/useDisabledAttributeValues';
import { useCart } from '@/hooks/useCart';
import { useProducts } from '@/context/ProductContext';

export default function useProductDetails(product: Product) {
    const [selectedDeclinations, setSelectedDeclinations] = useState<Record<string, string>>({});
    const [errors,        setErrors]        = useState<Record<string, string>>({});
    const [quantity,      setQuantity]      = useState<number>(1);
    const [currentPrice,  setCurrentPrice]  = useState<number>(product.price);
    const [currentImages, setCurrentImages] = useState<string[]>(product.images ?? []);
    const [maxQuantity,   setMaxQuantity]   = useState<number>(product.stock_quantity);

    const { isProductInCart, addProductToCart } = useCart();
    const { isFromCache, apiStatus } = useProducts();
    const isOnline = apiStatus === 'online' && !isFromCache;

    const organizedValues = useMemo(() => {
        const attributeMap: Record<number, { id: number; values: any[]; name: string; type: string }> = {};
        product.declination?.forEach((item) => {
            item.values.forEach((val) => {
                const attrId = val.attribute.id;
                if (!attributeMap[attrId]) {
                    attributeMap[attrId] = { id: val.id, values: [], name: val.attribute.name, type: val.attribute.type };
                }
                const attr = attributeMap[attrId];
                if (!attr.values.find((v) => v.id === val.id)) {
                    attr.values.push({ id: val.id, value: val.value, color: val.color, attribute: val.attribute });
                }
            });
        });
        return attributeMap;
    }, [product.declination]);

    const disabledValues = useDisabledAttributeValues(product.declination, selectedDeclinations);

    const findMatchingDeclination = useMemo(() => {
        if (Object.keys(selectedDeclinations).length === 0) return undefined;
        const firstDecl = product.declination?.[0];
        if (!firstDecl) return undefined;
        const expectedCount = new Set(firstDecl.values.map(v => v.attribute.name)).size;
        if (Object.keys(selectedDeclinations).length !== expectedCount) return undefined;
        return product.declination?.find(declination => {
            const attrs: Record<string, string> = {};
            declination.values.forEach(v => { attrs[v.attribute.name] = v.id.toString(); });
            return Object.entries(selectedDeclinations).every(([name, id]) => attrs[name] === id);
        });
    }, [product.declination, selectedDeclinations]);

    useEffect(() => {
        const decl = findMatchingDeclination;
        if (decl) {
            setCurrentPrice(decl.price > 0 ? decl.price : product.price);
            if (decl.quantity >= 1) setMaxQuantity(decl.quantity);
            const images = decl.declination_images?.length
                ? (isOnline ? decl.declination_images : product.localImages)
                : (isOnline ? product.images : product.localImages);
            setCurrentImages(images);
        } else {
            setCurrentPrice(product.price);
            setCurrentImages(isOnline ? product.images : product.localImages);
            setMaxQuantity(product.stock_quantity);
        }
    }, [findMatchingDeclination, product.price, product.images, product.stock_quantity]);

    const handleDeclinationSelect = (attributeName: string, value: string) => {
        setSelectedDeclinations(prev => ({ ...prev, [attributeName]: value }));
        setErrors(prev => { const u = { ...prev }; delete u[attributeName]; return u; });
    };

    const handleQuantityChange = (value: number) => setQuantity(value);

    const validateSelections = useCallback(() => {
        const missing: Record<string, string> = {};
        Object.values(organizedValues).forEach((item) => {
            if (!selectedDeclinations[item.name]) {
                missing[item.name] = `Veuillez sélectionner une valeur pour ${item.name}`;
            }
        });
        if (Object.keys(missing).length > 0) { setErrors(missing); return false; }
        return true;
    }, [organizedValues, selectedDeclinations]);

    /**
     * Ajoute le produit au panier.
     * @param offerPrice  Prix personnalisé saisi par l'utilisateur, ou null pour le prix catalogue.
     */
    const handleAddToCart = useCallback(async (offerPrice?: number | null) => {
        if (!validateSelections()) return;

        const matchingDeclination = findMatchingDeclination;

        try {
            const result = await addProductToCart(
                product,
                quantity,
                matchingDeclination as Declination,
                offerPrice ?? null,
            );
            if (result.success) console.log('Succès', result.message);
            else console.log('Erreur', result.message);
        } catch (error) {
            console.error("Erreur ajout panier:", error);
        }
    }, [product, quantity, findMatchingDeclination, addProductToCart, validateSelections]);

    const isInCart = useMemo(() => {
        return isProductInCart(product.slug, findMatchingDeclination as Declination | undefined);
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
        isInCart,
    };
}