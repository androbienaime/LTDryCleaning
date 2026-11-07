import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/ThemedView';
import Header from '@/components/Header';
import { useThemeColors, useThemeTypography } from '@/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShopStackParamList } from '@/src/@types/navigation';

import useProductDetails   from '@/hooks/useProductDetails';
import DeclinationSelector from './modules/DeclinationSelector';
import QuantitySelector    from './modules/QuantitySelector';

import ProductHeader      from './components/ProductHeader';
import ProductImages      from './components/ProductImages';
import ProductDescription from './components/ProductDescription';
import AddToCartButton    from './components/AddToCartButton';
import MakeOfferButton    from './components/Makeofferbutton';
import MakeOfferSheet     from './components/MakeOfferSheet';

import createStyles from './styles';
import { StyleSheet } from 'react-native';

type Props = NativeStackScreenProps<ShopStackParamList, 'ProductDetails'>;

// Prix personnalisé : juste un nombre, pas de token
type ActiveOffer = { offeredPrice: number };

const ProductDetailsScreen: React.FC<Props> = ({ route }) => {
  const { product } = route.params;
  const colors      = useThemeColors();
  const typography  = useThemeTypography();

  const {
    organizedValues,
    selectedDeclinations,
    errors,
    quantity,
    currentPrice,
    currentImages,
    maxQuantity,
    disabledValues,
    handleDeclinationSelect,
    handleQuantityChange,
    handleAddToCart,
  } = useProductDetails(product);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeOffer,  setActiveOffer]  = useState<ActiveOffer | null>(null);

  // Prix affiché : offre si active, sinon prix catalogue
  const displayedPrice     = activeOffer?.offeredPrice ?? currentPrice;
  // Prix barré : prix catalogue si offre active, sinon discount catalogue
  const strikethroughPrice = activeOffer ? currentPrice : product.discount_price;

  const handleOfferAccepted = useCallback((offer: ActiveOffer) => {
    setActiveOffer(offer);
  }, []);

  const handleAddToCartWithOffer = useCallback(() => {
    // Transmet le prix d'offre (number | null) — handleAddToCart l'envoie au panier
    handleAddToCart(activeOffer?.offeredPrice ?? null);
  }, [activeOffer, handleAddToCart]);

  const onSharePress    = () => {};
  const onFavoritePress = () => {};
  const onAddToWishlist = () => {};

  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const styles2 = StyleSheet.create({
    offerButtonAnchor: {
    position: 'absolute',
    right: 25,          // juste à gauche de l'icône panier
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    },
  });

  return (
    <>
      <SafeAreaView style={styles.controlThemedView}>
        <ThemedView style={styles.controlThemedView}>
          <Header
            previousButton={true}
            hideFilterIcon={true}
            hideCartIcon={false}
            backgroundColor={colors.background.white}
            inputBackground={colors.background.primary}
          />

          <FlatList
            data={[1]}
            keyExtractor={() => 'product-details'}
            renderItem={() => (
              <View>
                <ThemedView style={styles.controlThemedView}>
                  <ProductImages images={currentImages} height={300}/>

                  <Pressable onPress={() => Keyboard.dismiss()}>
                    <ThemedView style={styles.container}>

                     {/* Header + MakeOfferButton fixé dessus */}
                      <View style={{ position: 'relative' }}>
                        <ProductHeader
                          name={product.name}
                          price={displayedPrice}
                          discountPrice={strikethroughPrice}
                          currencySymbol={product.currency.symbol}
                          onSharePress={onSharePress}
                          productQuantity={quantity}
                          onFavoritePress={onFavoritePress}
                          offerActive={!!activeOffer}
                      />
                      {/* Bouton flottant ancré à droite du header */}
                      <View style={styles2.offerButtonAnchor}>
                        <MakeOfferButton
                          onPress={() => setSheetVisible(true)}
                          activeOffer={activeOffer}
                          currencySymbol={product.currency.symbol}
                          compact // ← prop pour le mode icône seule
                        />
                      </View>
                    </View>

                      {product.declination && product.declination.length > 0 && (
                        <DeclinationSelector
                          organizedValues={organizedValues}
                          selectedDeclinations={selectedDeclinations}
                          errors={errors}
                          disabledValues={disabledValues}
                          onDeclinationSelect={handleDeclinationSelect}
                        />
                      )}

                      {/* Bouton "Prix personnalisé" — toujours visible sous les déclinaisons */}
                      {/* <MakeOfferButton
                        onPress={() => setSheetVisible(true)}
                        activeOffer={activeOffer}
                        currencySymbol={product.currency.symbol}
                      /> */}

                      <QuantitySelector
                        quantity={quantity}
                        maxQuantity={maxQuantity}
                        hasUnlimitedStock={product.has_unlimited_stock}
                        onQuantityChange={handleQuantityChange}
                      />

                      <ProductDescription description={product.description} />

                    </ThemedView>
                  </Pressable>
                </ThemedView>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          />
        </ThemedView>
      </SafeAreaView>

      <AddToCartButton
        onAddToCart={handleAddToCartWithOffer}
        onAddToWishlist={onAddToWishlist}
      />

      <MakeOfferSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        productId={product.id}
        productName={product.name}
        catalogPrice={currentPrice}
        currencySymbol={product.currency.symbol}
        onOfferAccepted={handleOfferAccepted}
      />
    </>
  );


};


export default ProductDetailsScreen;
