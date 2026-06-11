// screens/Shop/ProductDetails/components/MakeOfferButton.tsx
// Bouton "Prix personnalisé" toujours visible sous les déclinaisons.

import React from 'react';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemeTypography } from '@/theme';
import { ThemedText } from '@/components/ThemedText';

type Props = {
  onPress:        () => void;
  /** Quand une offre est déjà active, on affiche le prix négocié */
  activeOffer?:   { offeredPrice: number } | null;
  currencySymbol: string;
};

const MakeOfferButton: React.FC<Props> = ({ onPress, activeOffer, currencySymbol }) => {
  const colors     = useThemeColors();
  const typography = useThemeTypography();

  const hasOffer = !!activeOffer;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor:     hasOffer ? colors.button.primary : colors.border.default,
          backgroundColor: hasOffer
            ? colors.button.primary + '12'   // teinte légère de la couleur primaire
            : colors.background.white,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {/* Icône */}
      <View style={[styles.iconWrap, { backgroundColor: colors.button.primary + '18' }]}>
        <Ionicons
          name={hasOffer ? 'checkmark-circle' : 'pricetag-outline'}
          size={20}
          color={colors.button.primary}
        />
      </View>

      {/* Texte */}
      <View style={styles.textWrap}>
        <ThemedText
          style={[
            styles.label,
            { color: colors.button.primary, ...typography.body2 },
          ]}
        >
          {hasOffer ? 'Offre appliquée' : 'Prix personnalisé'}
        </ThemedText>

        <ThemedText
          style={[styles.sub, { color: colors.text.secondary }]}
        >
          {hasOffer
            ? `${currencySymbol} ${activeOffer!.offeredPrice.toFixed(2)} · Appuyer pour modifier`
            : 'Proposez votre prix'}
        </ThemedText>
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={18}
        color={hasOffer ? colors.button.primary : colors.text.tertiary}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    borderWidth:    1.5,
    borderRadius:   12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
  },
  sub: {
    fontSize: 12,
  },
});

export default MakeOfferButton;