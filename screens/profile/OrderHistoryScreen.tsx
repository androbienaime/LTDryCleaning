// screens/OrderHistoryScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMultiAccount } from '@/context/MultiAccountContext';
import { useProducts } from '@/context/ProductContext';
import type { OfflineDeliveryOrder, OfflineOrder } from '@/src/@types/models';

// ─── Clé AsyncStorage (même que useCheckout) ─────────────────────────────────
const OFFLINE_ORDERS_KEY = (accountId: string) =>
  `@offline_delivery_orders:${accountId}`;

// ─── Badge statut ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending_sync: { label: 'En attente',       color: '#F59E0B', bg: '#FEF3C7', icon: 'time-outline'          },
  syncing:      { label: 'Envoi...',         color: '#3B82F6', bg: '#EFF6FF', icon: 'sync-outline'          },
  synced:       { label: 'Envoyée',          color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle-outline'},
  failed:       { label: 'Échec (5 essais)', color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle-outline'  },
} as const;

const StatusBadge = ({ status }: { status: OfflineDeliveryOrder['status'] }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Carte commande ───────────────────────────────────────────────────────────
const OrderCard = ({ order }: { order: OfflineOrder }) => {
  const date = new Date(order.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // const deliveryLabel = order.delivery_date
  //   ? new Date(order.delivery_date).toLocaleDateString('fr-FR', {
  //       day: '2-digit', month: 'short',
  //     })
  //   : null;

    
  return (
    <View style={styles.card}>
      {/* En-tête */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardRef} numberOfLines={1}>
            {order.localId}
          </Text>
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Client */}
      <View style={styles.cardRow}>
        <Ionicons name="person-outline" size={14} color="#64748B" />
        <Text style={styles.cardRowText}>{order._customer?.name ?? ''}</Text>
        <Text style={styles.cardRowSub}>{order._customer?.phone ?? ''}</Text>
      </View>

      {/* Livraison */}
      {/* {deliveryLabel && (
        <View style={styles.cardRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.cardRowText}>
            {deliveryLabel}{order.delivery_time ? ` à ${order.delivery_time}` : ''}
          </Text>
        </View>
      )} */}

      {/* Articles */}
      <View style={styles.cardRow}>
        <Ionicons name="cube-outline" size={14} color="#64748B" />
        <Text style={styles.cardRowText}>
          {order.order_products.length} article{order.order_products.length > 1 ? 's' : ''}
        </Text>
      </View>

      
      {/* Liste articles */}
      <View style={styles.itemsList}>
        {order.order_products.map((item, i) => (
          <View key={i} style={styles.itemRow}>
             <Text style={styles.itemName} numberOfLines={1}>{item.product.name ?? ''}</Text>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
            <Text style={styles.itemPrice}>
            {(item.sub_totals).toLocaleString()}
            </Text> 
          </View> 
          
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{order.total_amount_order.toLocaleString()} HTG</Text>
      </View>

      {/* Erreur sync */}
      {order.syncError && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={13} color="#B91C1C" />
          <Text style={styles.errorText} numberOfLines={2}>{order.syncError}</Text>
        </View>
      )}

      {/* Note */}
      {/* {order.note ? (
        <Text style={styles.note}>📝 {order.note}</Text>
      ) : null} */}
    </View>
  );
};

// ─── Écran principal ──────────────────────────────────────────────────────────
const OrderHistoryScreen = ({ navigation }: any) => {
  const { activeAccount } = useMultiAccount();
  const { apiStatus }     = useProducts();
  const accountId         = activeAccount?.id ?? '';

  const [orders,      setOrders]      = useState<OfflineOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_ORDERS_KEY(accountId));
      const parsed: OfflineOrder[] = raw ? JSON.parse(raw) : [];
      // Plus récente en premier
      setOrders(parsed.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error('[OrdersScreen] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (accountId) load(); }, [accountId]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // Compteurs
  const pending = orders.filter((o) => o.status === 'pending_sync').length;
  const synced  = orders.filter((o) => o.status === 'synced').length;
  const failed  = orders.filter((o) => o.status === 'failed').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {/* <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes commandes</Text>
        <View style={{ width: 24 }} />
      </View> */}

      {/* Statut API */}
      <View style={[styles.apiBanner, { backgroundColor: apiStatus === 'offline' ? '#FEF3C7' : '#ECFDF5' }]}>
        <Ionicons
          name={apiStatus === 'offline' ? 'cloud-offline-outline' : 'wifi-outline'}
          size={14}
          color={apiStatus === 'offline' ? '#92400E' : '#065F46'}
        />
        <Text style={[styles.apiBannerText, { color: apiStatus === 'offline' ? '#92400E' : '#065F46' }]}>
          {apiStatus === 'offline' ? 'API hors ligne — commandes en attente de sync' : 'API disponible'}
        </Text>
      </View>

      {/* Résumé */}
      {orders.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{orders.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: '#F59E0B' }]}>{pending}</Text>
            <Text style={styles.summaryLabel}>En attente</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: '#10B981' }]}>{synced}</Text>
            <Text style={styles.summaryLabel}>Envoyées</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: '#EF4444' }]}>{failed}</Text>
            <Text style={styles.summaryLabel}>Échecs</Text>
          </View>
        </View>
      )}

      

      {/* Liste */}
      
      <FlatList
        data={orders}
        keyExtractor={(o) => o.localId}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : { padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.emptyText}>
              Les commandes passées (en ligne ou hors ligne) apparaîtront ici.
            </Text>
          </View>
        }
      />
     
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 5, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: '#1E293B' },

  apiBanner:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5, paddingVertical: 5 },
  apiBannerText: { fontSize: 12, fontWeight: '500' },

  summary:       { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 5, marginTop: 5, borderRadius: 12, padding: 16, gap: 0, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  summaryItem:   { flex: 1, alignItems: 'center', gap: 2 },
  summaryCount:  { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  summaryLabel:  { fontSize: 11, color: '#94A3B8' },

  // Card
  card:          { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardRef:       { fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' },
  cardDate:      { fontSize: 13, fontWeight: '600', color: '#1E293B', marginTop: 2 },

  badge:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText:     { fontSize: 11, fontWeight: '600' },

  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardRowText:   { fontSize: 13, color: '#475569', fontWeight: '500' },
  cardRowSub:    { fontSize: 12, color: '#94A3B8', marginLeft: 4 },

  itemsList:     { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, gap: 6 },
  itemRow:       { flexDirection: 'row', alignItems: 'center' },
  itemName:      { flex: 1, fontSize: 12, color: '#475569' },
  itemQty:       { fontSize: 12, color: '#94A3B8', marginRight: 8 },
  itemPrice:     { fontSize: 12, fontWeight: '600', color: '#1E293B' },

  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  totalLabel:    { fontSize: 14, fontWeight: '600', color: '#475569' },
  totalAmount:   { fontSize: 15, fontWeight: '700', color: '#4F46E5' },

  errorBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  errorText:     { flex: 1, fontSize: 11, color: '#B91C1C' },

  note:          { fontSize: 12, color: '#64748B', fontStyle: 'italic' },

  emptyContainer: { flex: 1 },
  emptyInner:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#94A3B8' },
  emptyText:      { fontSize: 14, color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },
});

export default OrderHistoryScreen;