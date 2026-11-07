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
  compact?:       boolean; // optionnel : affiche une version plus compacte du bouton
};

const MakeOfferButton: React.FC<Props> = ({ onPress, activeOffer, currencySymbol, compact }) => {
  const colors     = useThemeColors();
  const typography = useThemeTypography();

  const hasOffer = !!activeOffer;

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.compactBtn,
          {
            borderColor: colors.button.primary,
            backgroundColor: hasOffer ? colors.button.primary : colors.background.white,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Ionicons
          name="pricetag-outline"
          size={14}
          color={hasOffer ? colors.text.inverse : colors.button.primary}
        />
        <Text
          style={[
            styles.compactLabel,
            { color: hasOffer ? colors.text.inverse : colors.button.primary },
          ]}
        >
          Prix perso.
        </Text>
      </Pressable>
    );
  }

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
  compactBtn: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  compactLabel: {
    fontSize: 7,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default MakeOfferButton;