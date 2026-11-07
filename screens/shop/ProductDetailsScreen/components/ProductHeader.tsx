// screens/Shop/ProductDetails/components/ProductHeader.tsx
// Ajout : prop offerActive + affichage prix d'offre avec catalogue barré.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemeTypography } from '@/theme';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

type ProductHeaderProps = {
  name:            string;
  price:           number;       // prix affiché (offre ou catalogue selon contexte)
  productQuantity: number;
  discountPrice?:  number;       // prix barré
  currencySymbol:  string;
  onSharePress:    () => void;
  onFavoritePress: () => void;
  /** true = une offre est active, affiche le badge "Offre" sur le prix */
  offerActive?:    boolean;
};

const ProductHeader: React.FC<ProductHeaderProps> = ({
  name,
  price,
  productQuantity,
  discountPrice,
  currencySymbol,
  onSharePress,
  onFavoritePress,
  offerActive = false,
}) => {
  const colors     = useThemeColors();
  const typography = useThemeTypography();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background.white,
    },
    detailsContainer: {
      flexDirection: 'row',
      alignItems:    'flex-end',
      marginTop:     10,
    },
    titleContainer: { flex: 1 },
    caption: {
      color:           colors.text.primary,
      ...typography.h3,
      backgroundColor: colors.background.white,
    },
    productTitle: {
      color:           colors.text.primary,
      ...typography.h5,
      backgroundColor: colors.background.white,
    },
    detailsIcons: {
      flexDirection:   'row',
      alignItems:      'baseline',
      paddingLeft:     20,
      backgroundColor: colors.background.white,
    },
    priceAndRating: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginTop:      10,
      marginBottom:   10,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems:    'flex-end',
      gap:           6,
    },
    productPrice: {
      ...typography.h3,
      color: offerActive ? colors.button.primary : colors.button.secondary,
    },
    priceDiscount: {
      ...typography.h5,
      paddingHorizontal:   5,
      textDecorationLine: 'line-through',
      color:               colors.text.tertiary,
    },
    // ── Badge "Offre" ────────────────────────────────────────────────────────
    offerBadge: {
      backgroundColor:  colors.button.primary + '18',
      borderRadius:     6,
      paddingHorizontal: 7,
      paddingVertical:   3,
      alignSelf:        'flex-end',
      marginBottom:      2,
    },
    offerBadgeText: {
      fontSize:   11,
      fontWeight: '700',
      color:      colors.button.primary,
    },
    // ────────────────────────────────────────────────────────────────────────
    ratingWrapper: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           5,
    },
    rating: {
      fontSize:   14,
      color:      colors.text.secondary,
      fontWeight: 'bold',
    },
  });

  return (
    <ThemedView style={styles.container}>
      {/* Titre + boutons */}
      <View style={styles.detailsContainer}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.caption}>Details du produit</ThemedText>
          <ThemedText style={styles.productTitle}>{name}</ThemedText>
        </ThemedView>

        {/* <ThemedView style={styles.detailsIcons}>
          <Ionicons name="share-outline" size={32} onPress={onSharePress} />
          <Ionicons
            name="heart"
            size={25}
            style={{ marginLeft: 10 }}
            color="red"
            onPress={onFavoritePress}
          />
        </ThemedView> */}
      </View>

      {/* Prix + total */}
      <View style={styles.priceAndRating}>
        <View style={styles.priceContainer}>
          {/* Prix principal */}
          <ThemedText style={styles.productPrice}>
            {currencySymbol}{parseInt(price.toString()).toFixed(2)}
          </ThemedText>

          {/* Prix barré : discount catalogue OU prix catalogue quand offre active */}
          {discountPrice != null && discountPrice > 0 && (
            <ThemedText style={styles.priceDiscount}>
              {currencySymbol}{parseInt(discountPrice.toString()).toFixed(2)}
            </ThemedText>
          )}

          {/* Badge "Offre" */}
          {offerActive && (
            <View style={styles.offerBadge}>
              <ThemedText style={styles.offerBadgeText}>Offre</ThemedText>
            </View>
          )}
        </View>

        {/* Total quantité */}
        <View style={styles.ratingWrapper}>
          <ThemedText style={styles.rating}>
            Total : {currencySymbol}
            {parseInt((price * productQuantity).toString()).toFixed(2)}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
};

export default ProductHeader;