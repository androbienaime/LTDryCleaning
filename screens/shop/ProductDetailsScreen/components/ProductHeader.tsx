import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemeTypography } from '@/theme';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { fontWeight } from '@/theme/typography';

type ProductHeaderProps = {
  name: string;
  price: number;
  productQuantity: number;
  discountPrice?: number;
  currencySymbol: string;
  onSharePress: () => void;
  onFavoritePress: () => void;
};

const ProductHeader: React.FC<ProductHeaderProps> = ({
  name,
  price,
  productQuantity,
  discountPrice,
  currencySymbol,
  onSharePress,
  onFavoritePress
}) => {
  const colors = useThemeColors();
  const typography = useThemeTypography();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background.white
    },
    detailsContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: 10
    },
    titleContainer: {
      flex: 1
    },
    caption: {
      color: colors.text.primary,
      ...typography.h3,
      backgroundColor: colors.background.white
    },
    productTitle: {
      color: colors.text.primary,
      ...typography.h5,
      backgroundColor: colors.background.white
      
    },
    detailsIcons: {
      flexDirection: 'row',
      alignItems: 'baseline',
      paddingLeft: 20,
      backgroundColor: colors.background.white

    },
    priceAndRating: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      marginBottom: 10
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end'
    },
    productPrice: {
      ...typography.h3,
      color: colors.button.secondary
    },
    priceDiscount: {
      ...typography.h5,
      paddingHorizontal: 5,
      textDecorationLine: 'line-through',
      color: colors.text.tertiary
    },
    ratingWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5
    },
    rating: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: 'bold'
    }
  });

  return (
    <ThemedView style={styles.container}>
      {/* Titre du produit et boutons d'action */}
      <View style={styles.detailsContainer}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.caption}>Details du produit</ThemedText>
          <ThemedText style={styles.productTitle}>{name}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.detailsIcons}>
          <Ionicons 
            name="share-outline" 
            size={32} 
            onPress={onSharePress}
          />
          <Ionicons 
            name="heart" 
            size={25} 
            style={{ marginLeft: 10 }} 
            color="red" 
            onPress={onFavoritePress}
          />
        </ThemedView>
      </View>

      {/* Prix et évaluations */}
      <View style={styles.priceAndRating}>
        <View style={styles.priceContainer}>
          <ThemedText style={styles.productPrice}>
            {currencySymbol}
            {parseInt(price.toString()).toFixed(2)}
          </ThemedText>
          {discountPrice && (
            <ThemedText style={styles.priceDiscount}>
              {currencySymbol}{parseInt(discountPrice.toString()).toFixed(2)}
            </ThemedText>
          )}
        </View>
        
        
        <View style={styles.ratingWrapper}>
          {/* <Ionicons name="star" size={20} color="#D4AF34" /> */}
          <ThemedText style={styles.rating}>
            Total : {currencySymbol}
            {parseInt((price * productQuantity).toString()).toFixed(2)}</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
};

export default ProductHeader;