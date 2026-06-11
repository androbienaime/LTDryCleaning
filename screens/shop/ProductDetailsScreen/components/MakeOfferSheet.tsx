// screens/Shop/ProductDetails/components/MakeOfferSheet.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback,
  View, ActivityIndicator,
} from 'react-native';
import { useThemeColors, useThemeTypography } from '@/theme';
// import { useOffer } from '@/context/OfferContext';
import { useOffline } from '@/context/OfflineContext';

type AcceptedOffer = {
  // token:        string;
  offeredPrice: number;
  // expiresAt?:   number;
};

type Props = {
  visible:         boolean;
  onClose:         () => void;
  productId:       string | number;
  productName:     string;
  catalogPrice:    number;
  currencySymbol:  string;
  onOfferAccepted: (offer: AcceptedOffer) => void;
};

const MakeOfferSheet: React.FC<Props> = ({
  visible, onClose, productId, productName,
  catalogPrice, currencySymbol, onOfferAccepted,
}) => {
  const colors     = useThemeColors();
  const typography = useThemeTypography();
  // const { createOffer } = useOffer();
  const { isOnline }    = useOffline();

  const [offeredPrice, setOfferedPrice] = useState('');
  const [note,         setNote]         = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setOfferedPrice('');
      setNote('');
      setError(null);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0,   duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,   duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const price = parseFloat(offeredPrice.replace(',', '.'));
    if (!offeredPrice || isNaN(price) || price <= 0) {
      setError('Veuillez saisir un prix valide.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      // const offer = await createOffer({
      //   productId, productName, offeredPrice: price,
      //   note: note.trim() || undefined,
      // });
      // Fermer immédiatement, puis notifier le parent
      onClose();
      onOfferAccepted({
        // token:        offer.token ?? offer.localId,
        offeredPrice: price,
        // expiresAt:    offer.expiresAt,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  }, [offeredPrice, note, productId, productName, onClose, onOfferAccepted]);

  const parsedPrice = parseFloat(offeredPrice.replace(',', '.'));
  const discountPct = !isNaN(parsedPrice) && parsedPrice > 0 && catalogPrice > 0
    ? Math.round(((catalogPrice - parsedPrice) / catalogPrice) * 100)
    : null;

  const s = styles(colors, typography);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.avoidingView} pointerEvents="box-none">
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <Text style={s.title}>Faire une offre</Text>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <View style={s.refPriceRow}>
            <Text style={s.refLabel}>Prix catalogue</Text>
            <Text style={s.refPrice}>
              {currencySymbol} {catalogPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {!isOnline && (
            <View style={s.offlineBadge}>
              <Text style={s.offlineBadgeText}>📵 Hors ligne — votre offre sera envoyée à la reconnexion</Text>
            </View>
          )}

          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Votre prix proposé</Text>
            <View style={s.inputRow}>
              <Text style={s.currencyPrefix}>{currencySymbol}</Text>
              <TextInput
                style={s.priceInput}
                value={offeredPrice}
                onChangeText={(v) => { setOfferedPrice(v); setError(null); }}
                placeholder="0.00"
                placeholderTextColor={colors.text?.secondary ?? '#999'}
                keyboardType="decimal-pad"
                returnKeyType="done"
                maxLength={12}
              />
              {discountPct !== null && discountPct > 0 && (
                <View style={s.discountBadge}>
                  <Text style={s.discountBadgeText}>-{discountPct}%</Text>
                </View>
              )}
              {discountPct !== null && discountPct < 0 && (
                <View style={[s.discountBadge, s.discountBadgeOver]}>
                  <Text style={s.discountBadgeText}>+{Math.abs(discountPct)}%</Text>
                </View>
              )}
            </View>
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [s.submitBtn, pressed && s.submitBtnPressed]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>Envoyer l'offre</Text>
            }
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = (colors: any, typography: any) =>
  StyleSheet.create({
    backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    avoidingView:    { flex: 1, justifyContent: 'flex-end' },
    sheet:           { backgroundColor: colors.background?.white ?? '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 16 },
    handle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border?.light ?? '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
    header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title:           { fontSize: 18, fontWeight: '700', color: colors.text?.primary ?? '#111', ...(typography?.h3 ?? {}) },
    closeBtn:        { padding: 6 },
    closeBtnText:    { fontSize: 16, color: colors.text?.secondary ?? '#777' },
    refPriceRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background?.primary ?? '#F5F5F5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 20 },
    refLabel:        { fontSize: 13, color: colors.text?.secondary ?? '#777' },
    refPrice:        { fontSize: 15, fontWeight: '600', color: colors.text?.primary ?? '#111' },
    offlineBadge:    { backgroundColor: '#FFF3CD', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 },
    offlineBadgeText:{ fontSize: 12, color: '#856404' },
    inputGroup:      { marginBottom: 16 },
    inputLabel:      { fontSize: 13, fontWeight: '500', color: colors.text?.secondary ?? '#777', marginBottom: 8 },
    inputRow:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border?.medium ?? '#E0E0E0', borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: colors.background?.white ?? '#fff' },
    currencyPrefix:  { fontSize: 16, fontWeight: '600', color: colors.text?.primary ?? '#111', marginRight: 8 },
    priceInput:      { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text?.primary ?? '#111', padding: 0 },
    discountBadge:   { backgroundColor: '#D4EDDA', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
    discountBadgeOver:{ backgroundColor: '#FDECEA' },
    discountBadgeText:{ fontSize: 12, fontWeight: '700', color: '#155724' },
    errorText:       { color: '#D32F2F', fontSize: 13, marginBottom: 12 },
    submitBtn:       { backgroundColor: colors.button?.primary ?? '#111', borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
    submitBtnPressed:{ opacity: 0.8 },
    submitBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

export default MakeOfferSheet;