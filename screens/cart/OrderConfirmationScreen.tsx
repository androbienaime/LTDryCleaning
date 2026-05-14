// screens/OrderConfirmationScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { Customer } from '@/src/@types/models';

type Params = {
  OrderConfirmation: {
    orderId:      string | number;
    isOffline:    boolean;
    message:      string;
    customer:     Customer;
    total:        number;
    deliveryDate: string; // ISO string
  };
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route:      RouteProp<Params, 'OrderConfirmation'>;
};

const OrderConfirmationScreen = ({ navigation, route }: Props) => {
  const { orderId, isOffline, message, customer, total, deliveryDate } = route.params;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 15 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true, delay: 200 }),
    ]).start();
  }, []);

  const deliveryDateFormatted = new Date(deliveryDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Icône animée */}
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: isOffline ? '#F59E0B' : '#10B981' }]}>
            <Ionicons
              name={isOffline ? 'cloud-offline-outline' : 'checkmark'}
              size={48}
              color="#fff"
            />
          </View>
        </Animated.View>

        {/* Texte */}
        <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
          <Text style={styles.title}>
            {isOffline ? 'Commande enregistrée' : 'Commande confirmée !'}
          </Text>
          <Text style={styles.subtitle}>{message}</Text>

          {isOffline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="sync-outline" size={16} color="#92400E" />
              <Text style={styles.offlineBannerText}>
                Sera automatiquement envoyée à la reconnexion
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Récapitulatif */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Row label="Référence"  value={isOffline ? String(orderId).slice(0, 16) + '...' : `#${orderId}`} />
          <Row label="Client"     value={customer.name} />
          <Row label="Téléphone"  value={customer.phone} />
          <Row label="Livraison"  value={deliveryDateFormatted} />
          <View style={styles.divider} />
          <Row label="Total"      value={`${total.toLocaleString()} HTG`} bold />
        </Animated.View>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: '#4F46E5' }]}
          onPress={() => navigation.navigate('Main', { screen: 'Shop' })}
        >
          <Text style={styles.btnText}>Continuer les achats</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnOutline]}
          onPress={() => navigation.navigate('Profile', { screen: 'OrderHistory' })}
        >
          <Text style={[styles.btnText, { color: '#4F46E5' }]}>Voir mes commandes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#fff' },
  content:         { flex: 1, alignItems: 'center', padding: 24, gap: 24 },
  iconWrapper:     { marginTop: 32 },
  iconCircle:      { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  textBlock:       { alignItems: 'center', gap: 8 },
  title:           { fontSize: 22, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  subtitle:        { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  offlineBanner:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginTop: 8 },
  offlineBannerText: { fontSize: 12, color: '#92400E', flex: 1 },
  card:            { width: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, gap: 12 },
  row:             { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel:        { fontSize: 13, color: '#64748B' },
  rowValue:        { fontSize: 13, color: '#1E293B', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  rowValueBold:    { fontWeight: '700', fontSize: 15, color: '#4F46E5' },
  divider:         { height: 1, backgroundColor: '#E2E8F0' },
  footer:          { padding: 20, gap: 12 },
  btn:             { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  btnOutline:      { borderWidth: 1.5, borderColor: '#4F46E5', backgroundColor: 'transparent' },
  btnText:         { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default OrderConfirmationScreen;