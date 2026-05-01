import React, { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/ThemedView';
import Header from '@/components/Header';
import { useThemeColors, useThemeTypography } from '@/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShopStackParamList } from '@/src/@types/navigation';

// Modules fonctionnels
import useProductDetails from '@/hooks/useProductDetails';
import DeclinationSelector from './modules/DeclinationSelector';
import QuantitySelector from './modules/QuantitySelector';

// Composants de l'écran
import ProductHeader from './components/ProductHeader';
import ProductImages from './components/ProductImages';
import ProductDescription from './components/ProductDescription';
import ShippingInfo from './components/ShippingInfo';
import AddToCartButton from './components/AddToCartButton';

// Styles
import createStyles from './styles';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

type Props = NativeStackScreenProps<ShopStackParamList, 'ProductDetails'>;

const ProductDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { product } = route.params;
  const colors = useThemeColors();
  const typography = useThemeTypography();
  
  // Récupérer les fonctionnalités et états du hook personnalisé
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
    handleAddToCart
  } = useProductDetails(product);
  
  // Fonctions de gestion des événements
  const onSharePress = () => {
    console.log('Share pressed');
    // Implémentation du partage
  };
  
  const onFavoritePress = () => {
    console.log('Favorite pressed');
    // Implémentation d'ajout aux favoris
  };
  
  const onAddToWishlist = () => {
    console.log('Add to wishlist');
    // Implémentation d'ajout à la liste de souhaits
  };
  
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

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
            data={[1]} // élément factice pour FlatList
            keyExtractor={() => "product-details"}
            renderItem={() => (
              <View>
                <ThemedView style={styles.controlThemedView}>
                  {/* Images du produit */}
                  <ProductImages images={currentImages} />
                  
                  <Pressable onPress={() => Keyboard.dismiss()}>
                    <ThemedView style={styles.container}>
                      {/* En-tête avec titre et prix */}
                      <ProductHeader
                        name={product.name}
                        price={currentPrice}
                        discountPrice={product.discount_price}
                        currencySymbol={product.currency.symbol}
                        onSharePress={onSharePress}
                        onFavoritePress={onFavoritePress}
                      />
                      
                      {/* Sélecteurs de déclinaisons (si le produit en a) */}
                      {product.declination && product.declination.length > 0 && (
                        <DeclinationSelector
                          organizedValues={organizedValues}
                          selectedDeclinations={selectedDeclinations}
                          errors={errors}
                          disabledValues={disabledValues}
                          onDeclinationSelect={handleDeclinationSelect}
                        />
                      )}
                      
                      {/* Sélecteur de quantité */}
                      <QuantitySelector
                        quantity={quantity}
                        maxQuantity={maxQuantity}
                        hasUnlimitedStock={product.has_unlimited_stock}
                        onQuantityChange={handleQuantityChange}
                      />
                      
                      {/* Description du produit */}
                      <ProductDescription description={product.description} />
                      
                      {/* Informations de livraison */}
                      {/* <ShippingInfo 
                        address="Gonaive, Rue parc Vincent"
                        estimatedDeliveryStart="19/05/2025"
                        estimatedDeliveryEnd="23/05/2025"
                      /> */}
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

      {/* Bouton "Ajouter au panier" fixe en bas de l'écran */}
      <AddToCartButton
        onAddToCart={handleAddToCart}
        onAddToWishlist={onAddToWishlist}
      />
    </>
  );
};

export default ProductDetailsScreen;