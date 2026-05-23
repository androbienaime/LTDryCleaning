// screens/OrderHistoryScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Modal,
  Alert, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProducts } from '@/context/ProductContext';
import { useAppSetup } from '@/context/AppSetupContext';
import type { OfflineOrder, Order } from '@/src/@types/models';
import { SyncService, OFFLINE_KEY_PREFIX } from '@/src/api/services/sync.service';
import { ordersService } from '@/src/api/services/orders.services';

// ═══════════════════════════════════════════════════════════════════════════════
//  Constantes
// ═══════════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 20;

type Tab = 'offline' | 'online';

const ORDER_STATES = [
  { key: 'pending',    label: 'En attente', color: '#F59E0B', bg: '#FEF3C7', icon: 'time-outline'             },
  { key: 'processing', label: 'En cours',   color: '#3B82F6', bg: '#EFF6FF', icon: 'refresh-circle-outline'   },
  { key: 'shipped',    label: 'Expédiée',   color: '#8B5CF6', bg: '#EDE9FE', icon: 'car-outline'              },
  { key: 'delivered',  label: 'Livrée',     color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle-outline' },
  { key: 'cancelled',  label: 'Annulée',    color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle-outline'     },
  { key: 'returned',   label: 'Retournée',  color: '#64748B', bg: '#F1F5F9', icon: 'return-down-back-outline' },
] as const;

type OrderStateKey = typeof ORDER_STATES[number]['key'];

const OFFLINE_STATUS_CONFIG = {
  pending_sync: { label: 'En attente',  color: '#F59E0B', bg: '#FEF3C7', icon: 'time-outline'            },
  syncing:      { label: 'Envoi...',    color: '#3B82F6', bg: '#EFF6FF', icon: 'sync-outline'            },
  synced:       { label: 'Envoyée',     color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle-outline' },
  failed:       { label: 'Échec',       color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle-outline'    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function loadAllOfflineOrders(): Promise<OfflineOrder[]> {
  try {
    const allKeys     = await AsyncStorage.getAllKeys();
    const offlineKeys = allKeys.filter((k) => k.startsWith(OFFLINE_KEY_PREFIX));
    if (!offlineKeys.length) return [];
    const pairs  = await AsyncStorage.multiGet(offlineKeys);
    const orders : OfflineOrder[] = [];
    for (const [, value] of pairs) {
      if (value) orders.push(...JSON.parse(value));
    }
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('fr-FR', opts ?? {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getStateConfig(state: string) {
  return ORDER_STATES.find((s) => s.key === state) ?? ORDER_STATES[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Sous-composants partagés
// ═══════════════════════════════════════════════════════════════════════════════

const SearchBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <View style={s.searchBar}>
    <Ionicons name="search-outline" size={16} color="#94A3B8" />
    <TextInput
      style={s.searchInput}
      value={value}
      onChangeText={onChange}
      placeholder="Client, téléphone, référence..."
      placeholderTextColor="#CBD5E1"
      autoCorrect={false}
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChange('')}>
        <Ionicons name="close-circle" size={16} color="#CBD5E1" />
      </TouchableOpacity>
    )}
  </View>
);

const StateBadge = ({ state, type }: { state: string; type: 'online' | 'offline' }) => {
  const cfg = type === 'online'
    ? getStateConfig(state)
    : (OFFLINE_STATUS_CONFIG as any)[state] ?? OFFLINE_STATUS_CONFIG.pending_sync;
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

const FinRow = ({
  label, value, bold, color,
}: { label: string; value: string; bold?: boolean; color?: string }) => (
  <View style={s.finRow}>
    <Text style={s.finLabel}>{label}</Text>
    <Text style={[s.finValue, bold && s.finValueBold, color ? { color } : null]}>{value}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  Carte commande OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════

const OfflineCard = ({ order, symbol }: { order: OfflineOrder; symbol: string }) => {
  const fmt        = (n?: number) => n != null ? `${n.toLocaleString('fr-FR')} ${symbol}` : '—';
  const isFullyPaid = (order.balance ?? order.total_amount_order) <= 0;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardRef}>
            {order.serverId ? `#${order.serverId}` : order.localId.slice(-12)}
          </Text>
          <Text style={s.cardDate}>{fmtDate(new Date(order.createdAt).toISOString())}</Text>
        </View>
        <StateBadge state={order.status} type="offline" />
      </View>

      <View style={s.infoRow}>
        <Ionicons name="person-outline" size={13} color="#94A3B8" />
        <Text style={s.infoText}>{order._customer?.name ?? '—'}</Text>
        <Text style={s.infoSub}>{order._customer?.phone}</Text>
      </View>

      {order.delivery?.delivery_date && (
        <View style={s.infoRow}>
          <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
          <Text style={s.infoText}>
            {fmtDate(order.delivery.delivery_date, { weekday: 'short', day: '2-digit', month: 'short' })}
          </Text>
        </View>
      )}

      <View style={s.itemsList}>
        {order.order_products.map((item, i) => (
          <View key={i} style={s.itemRow}>
            <Text style={s.itemName} numberOfLines={1}>{item.product?.name ?? `#${item.product_id}`}</Text>
            <Text style={s.itemQty}>×{item.quantity}</Text>
            <Text style={s.itemPrice}>{item.sub_totals.toLocaleString('fr-FR')}</Text>
          </View>
        ))}
      </View>

      <View style={s.finBlock}>
        {(order.total_discount ?? 0) > 0 && (
          <FinRow label="Réduction" value={`− ${fmt(order.total_discount)}`} color="#EF4444" />
        )}
        <FinRow label="Total net" value={fmt(order.total_amount_order)} bold />
        <View style={s.finDivider} />
        <FinRow label="Méthode" value={order.payment_method === 'card' ? '💳 Carte' : '💵 Espèces'} />
        {(order.order_amount ?? 0) > 0 && (
          <FinRow label="Payé" value={fmt(order.order_amount)} color="#059669" />
        )}
        <View style={[s.balanceBox, isFullyPaid && s.balanceBoxPaid]}>
          <Text style={[s.balanceLabel, isFullyPaid && s.balanceLabelPaid]}>
            {isFullyPaid ? '✓ Soldé' : 'Balance restante'}
          </Text>
          <Text style={[s.balanceValue, isFullyPaid && s.balanceValuePaid]}>
            {fmt(isFullyPaid ? 0 : (order.balance ?? order.total_amount_order))}
          </Text>
        </View>
      </View>

      {order.syncError && (
        <View style={s.errorBox}>
          <Ionicons name="warning-outline" size={13} color="#B91C1C" />
          <Text style={s.errorText} numberOfLines={2}>{order.syncError}</Text>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Carte commande ONLINE
// ═══════════════════════════════════════════════════════════════════════════════

const OnlineCard = ({
  order, symbol, onEditStatus, onAddAdvance,
}: {
  order        : Order;
  symbol       : string;
  onEditStatus : (order: Order) => void;
  onAddAdvance : (order: Order) => void;
}) => {
  const fmt         = (n?: number) => n != null ? `${n.toLocaleString('fr-FR')} ${symbol}` : '—';
  const state       = (order as any).state ?? 'pending';
  const customer    = (order as any).customer;
  const isFullyPaid = (order.balance ?? order.total_amount_order) <= 0;

  const customerName  = typeof customer === 'object'
    ? (customer?.name ?? `${customer?.firstname ?? ''} ${customer?.lastname ?? ''}`.trim())
    : '—';
  const customerPhone = typeof customer === 'object' ? (customer?.phone ?? '') : '';

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardRef}>#{order.id ?? order.reference_order}</Text>
          <Text style={s.cardDate}>{order.created_at ? fmtDate(order.created_at) : '—'}</Text>
        </View>
        <StateBadge state={state} type="online" />

        {/* Bouton modifier statut */}
        <TouchableOpacity style={s.actionBtn} onPress={() => onEditStatus(order)} activeOpacity={0.7}>
          <Ionicons name="swap-horizontal-outline" size={18} color="#6366F1" />
        </TouchableOpacity>

        {/* Bouton ajouter avance — uniquement si non soldé */}
        {!isFullyPaid && (
          <TouchableOpacity style={s.actionBtn} onPress={() => onAddAdvance(order)} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color="#059669" />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.infoRow}>
        <Ionicons name="person-outline" size={13} color="#94A3B8" />
        <Text style={s.infoText}>{customerName}</Text>
        {customerPhone ? <Text style={s.infoSub}>{customerPhone}</Text> : null}
      </View>

      {order.delivery && typeof order.delivery === 'object'
        && (order.delivery as any).delivery_date && (
        <View style={s.infoRow}>
          <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
          <Text style={s.infoText}>
            {fmtDate((order.delivery as any).delivery_date, {
              weekday: 'short', day: '2-digit', month: 'short',
            })}
          </Text>
        </View>
      )}

      {order.order_products?.length > 0 && (
        <View style={s.itemsList}>
          {order.order_products.map((item: any, i: number) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.itemName} numberOfLines={1}>
                {item.product?.name ?? item.product_name ?? `#${item.product_id}`}
              </Text>
              <Text style={s.itemQty}>×{item.quantity}</Text>
              <Text style={s.itemPrice}>{(item.sub_totals ?? 0).toLocaleString('fr-FR')}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.finBlock}>
        {(order.total_discount ?? 0) > 0 && (
          <FinRow label="Réduction" value={`− ${fmt(order.total_discount)}`} color="#EF4444" />
        )}
        <FinRow label="Total net" value={fmt(order.total_amount_order)} bold />
        <View style={s.finDivider} />
        <FinRow label="Méthode" value={(order as any).payment_method === 'card' ? '💳 Carte' : '💵 Espèces'} />
        {(order.order_amount ?? 0) > 0 && (
          <FinRow label="Payé" value={fmt(order.order_amount)} color="#059669" />
        )}
        <View style={[s.balanceBox, isFullyPaid && s.balanceBoxPaid]}>
          <Text style={[s.balanceLabel, isFullyPaid && s.balanceLabelPaid]}>
            {isFullyPaid ? '✓ Soldé' : 'Balance restante'}
          </Text>
          <Text style={[s.balanceValue, isFullyPaid && s.balanceValuePaid]}>
            {fmt(isFullyPaid ? 0 : (order.balance ?? order.total_amount_order))}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Modal — Modifier le statut
// ═══════════════════════════════════════════════════════════════════════════════

const EditStatusModal = ({
  visible, order, shopId, onClose, onSaved,
}: {
  visible : boolean;
  order   : Order | null;
  shopId  : string;
  onClose : () => void;
  onSaved : (updated: Order) => void;
}) => {
  const [saving,         setSaving]         = useState(false);
  const [selectedState,  setSelectedState]  = useState<OrderStateKey>('pending');

  useEffect(() => {
    if (order) setSelectedState(((order as any).state ?? 'pending') as OrderStateKey);
  }, [order]);

  const handleSave = async () => {
    if (!order || !shopId) return;
    setSaving(true);
    try {
      const updated = await ordersService.updateOrder(shopId, Number(order.id), {
        state: selectedState as any,
      });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de modifier le statut.');
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Modifier le statut</Text>
          <Text style={s.modalSubtitle}>Commande #{order.id ?? order.reference_order}</Text>

          <View style={s.stateGrid}>
            {ORDER_STATES.map((st) => {
              const active = selectedState === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  style={[s.stateBtn, active && { backgroundColor: st.bg, borderColor: st.color }]}
                  onPress={() => setSelectedState(st.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={st.icon as any} size={16} color={active ? st.color : '#94A3B8'} />
                  <Text style={[s.stateBtnText, active && { color: st.color, fontWeight: '700' }]}>
                    {st.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark-circle" size={14} color={st.color} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.modalActions}>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={{ color: '#64748B', fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: saving ? '#94A3B8' : '#6366F1' }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '700' }}>Confirmer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Modal — Ajouter une avance
// ═══════════════════════════════════════════════════════════════════════════════

const AddAdvanceModal = ({
  visible, order, shopId, symbol, onClose, onSaved,
}: {
  visible : boolean;
  order   : Order | null;
  shopId  : string;
  symbol  : string;
  onClose : () => void;
  onSaved : (updated: Order) => void;
}) => {
  const [saving,      setSaving]     = useState(false);
  const [amountRaw,   setAmountRaw]  = useState('');
  const [method,      setMethod]     = useState<'cash' | 'card'>('cash');

  // Reset à l'ouverture
  useEffect(() => {
    if (visible) { setAmountRaw(''); setMethod('cash'); }
  }, [visible]);

  if (!order) return null;

  const currentBalance = order.balance ?? order.total_amount_order;
  const advance        = Math.min(Number(amountRaw) || 0, currentBalance);
  const newBalance     = currentBalance - advance;
  const fmt            = (n: number) => `${n.toLocaleString('fr-FR')} ${symbol}`;

  const handleSave = async () => {
    if (!advance || advance <= 0) {
      Alert.alert('Montant requis', 'Veuillez saisir un montant valide.');
      return;
    }
    setSaving(true);
    try {
      const newAmountPaid = (order.order_amount ?? 0) + advance;
      const updated = await ordersService.updateOrder(shopId, Number(order.id), {
        order_amount : newAmountPaid,
        balance      : Math.max(newBalance, 0),
        has_advance  : newBalance > 0,
      });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible d\'enregistrer l\'avance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalOverlay}
      >
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Ajouter une avance</Text>
          <Text style={s.modalSubtitle}>Commande #{order.id} · Balance : {fmt(currentBalance)}</Text>

          {/* Méthode */}
          <Text style={s.modalSectionLabel}>Méthode de paiement</Text>
          <View style={s.methodRow}>
            {(['cash', 'card'] as const).map((m) => {
              const active = method === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[s.methodBtn, active && s.methodBtnActive]}
                  onPress={() => setMethod(m)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={m === 'cash' ? 'cash-outline' : 'card-outline'}
                    size={18}
                    color={active ? '#fff' : '#64748B'}
                  />
                  <Text style={[s.methodBtnText, active && { color: '#fff' }]}>
                    {m === 'cash' ? 'Espèces' : 'Carte'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Montant */}
          <Text style={s.modalSectionLabel}>Montant</Text>
          <View style={s.modalInputRow}>
            <View style={s.modalInputIcon}>
              <Ionicons name="wallet-outline" size={15} color="#059669" />
            </View>
            <TextInput
              style={s.modalInput}
              value={amountRaw}
              onChangeText={(v) => setAmountRaw(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              autoFocus
            />
            <Text style={s.modalInputSuffix}>{symbol}</Text>
          </View>

          {/* Récap live */}
          {advance > 0 && (
            <View style={s.advanceSummary}>
              <FinRow label="Avance" value={fmt(advance)} color="#059669" />
              <View style={s.finDivider} />
              <View style={[s.balanceBox, newBalance <= 0 && s.balanceBoxPaid]}>
                <Text style={[s.balanceLabel, newBalance <= 0 && s.balanceLabelPaid]}>
                  {newBalance <= 0 ? '✓ Soldé après paiement' : 'Nouvelle balance'}
                </Text>
                <Text style={[s.balanceValue, newBalance <= 0 && s.balanceValuePaid]}>
                  {fmt(Math.max(newBalance, 0))}
                </Text>
              </View>
            </View>
          )}

          <View style={s.modalActions}>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={{ color: '#64748B', fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: saving ? '#94A3B8' : '#059669' }]}
              onPress={handleSave}
              disabled={saving || advance <= 0}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '700' }}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Écran principal
// ═══════════════════════════════════════════════════════════════════════════════

const OrderHistoryScreen = ({ navigation }: any) => {
  const { apiStatus }   = useProducts();
  const { setupConfig } = useAppSetup();
  const shopId          = setupConfig.shopId      ?? '';
  const symbol          = setupConfig.currency?.symbol ?? 'HTG';

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<Tab>('offline');
  const [search,    setSearch]    = useState('');

  const tabAnim = useRef(new Animated.Value(0)).current;
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearch('');
    Animated.spring(tabAnim, { toValue: tab === 'offline' ? 0 : 1, useNativeDriver: false, speed: 20 }).start();
  };

  // ── Offline ───────────────────────────────────────────────────────────────

  const [offlineOrders,  setOfflineOrders]  = useState<OfflineOrder[]>([]);
  const [loadingOffline, setLoadingOffline] = useState(true);
  const [refreshingOff,  setRefreshingOff]  = useState(false);
  const [syncing,        setSyncing]        = useState(false);

  const loadOffline = useCallback(async () => {
    try   { setOfflineOrders(await loadAllOfflineOrders()); }
    catch { /* silencieux */ }
    finally { setLoadingOffline(false); setRefreshingOff(false); }
  }, []);

  useEffect(() => { loadOffline(); }, [loadOffline]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setOfflineOrders((prev) =>
      prev.map((o) =>
        o.status === 'pending_sync' || o.status === 'syncing'
          ? { ...o, status: 'syncing' } : o
      )
    );
    try   { await SyncService.syncAll(); }
    finally { setSyncing(false); loadOffline(); }
  };

  // ── Online ────────────────────────────────────────────────────────────────
  // Toutes les commandes sont chargées une seule fois.
  // La pagination est CLIENT-SIDE : on affiche PAGE_SIZE éléments, on en charge
  // plus quand l'utilisateur arrive en bas.
  // La recherche filtre sur l'ensemble complet (pas que la page affichée).

  const [allOnlineOrders, setAllOnlineOrders] = useState<Order[]>([]);
  const [loadingOnline,   setLoadingOnline]   = useState(false);
  const [refreshingOn,    setRefreshingOn]    = useState(false);
  const [page,            setPage]            = useState(1);
  const [loadingMore,     setLoadingMore]     = useState(false);

  const loadOnline = useCallback(async (isRefresh = false) => {
    if (!shopId || apiStatus === 'offline') return;
    isRefresh ? setRefreshingOn(true) : setLoadingOnline(true);
    try {
      const orders = await ordersService.getOrders(shopId);
      setAllOnlineOrders(orders);
      setPage(1);
    } catch (e) {
      console.warn('[OrderHistoryScreen] loadOnline error:', e);
    } finally {
      setLoadingOnline(false);
      setRefreshingOn(false);
    }
  }, [shopId, apiStatus]);

  useEffect(() => {
    if (activeTab === 'online') loadOnline();
  }, [activeTab, loadOnline]);

  // ── Pagination client-side ────────────────────────────────────────────────

  const q = search.toLowerCase().trim();

  // Filtrer sur TOUTES les commandes online (pas que la page)
  const filteredOnline = q
    ? allOnlineOrders.filter((o) => {
        const customer = (o as any).customer;
        const name  = typeof customer === 'object'
          ? `${customer?.name ?? ''} ${customer?.firstname ?? ''} ${customer?.lastname ?? ''}`.toLowerCase()
          : '';
        const phone = typeof customer === 'object' ? (customer?.phone ?? '') : '';
        return (
          name.includes(q) || phone.includes(q) ||
          String(o.id ?? '').includes(q) ||
          (o.reference_order ?? '').toLowerCase().includes(q)
        );
      })
    : allOnlineOrders;

  // Page affichée (si recherche active → tout afficher sans pagination)
  const pagedOnline = q
    ? filteredOnline
    : filteredOnline.slice(0, page * PAGE_SIZE);

  const hasMoreOnline = !q && pagedOnline.length < filteredOnline.length;

  const loadMoreOnline = () => {
    if (!hasMoreOnline || loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 400); // légère pause pour voir le loader
  };

  // ── Filtrage offline (search sur tout) ───────────────────────────────────

  const filteredOffline = q
    ? offlineOrders.filter((o) =>
        (o._customer?.name  ?? '').toLowerCase().includes(q) ||
        (o._customer?.phone ?? '').includes(q) ||
        o.localId.toLowerCase().includes(q) ||
        String(o.serverId ?? '').includes(q) ||
        (o.reference_order ?? '').toLowerCase().includes(q)
      )
    : offlineOrders;

  // ── Modals ────────────────────────────────────────────────────────────────

  const [editingOrder,   setEditingOrder]   = useState<Order | null>(null);
  const [advanceOrder,   setAdvanceOrder]   = useState<Order | null>(null);

  const handleOrderUpdated = (updated: Order) => {
    setAllOnlineOrders((prev) =>
      prev.map((o) => String(o.id) === String(updated.id) ? updated : o)
    );
  };

  // ── Compteurs ─────────────────────────────────────────────────────────────

  const offlinePending = offlineOrders.filter((o) =>
    o.status === 'pending_sync' || o.status === 'syncing'
  ).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>

      {/* Bannière API */}
      <View style={[s.apiBanner, { backgroundColor: apiStatus === 'offline' ? '#FEF3C7' : '#ECFDF5' }]}>
        <Ionicons
          name={apiStatus === 'offline' ? 'cloud-offline-outline' : 'wifi-outline'}
          size={13}
          color={apiStatus === 'offline' ? '#92400E' : '#065F46'}
        />
        <Text style={[s.apiBannerText, { color: apiStatus === 'offline' ? '#92400E' : '#065F46' }]}>
          {apiStatus === 'offline' ? 'API hors ligne — sync en attente' : 'API disponible'}
        </Text>
      </View>

      {/* Onglets */}
      <View style={s.tabs}>
        {(['offline', 'online'] as Tab[]).map((tab) => {
          const active   = activeTab === tab;
          const isOffTab = tab === 'offline';
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, active && s.tabActive]}
              onPress={() => switchTab(tab)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isOffTab ? 'cloud-offline-outline' : 'cloud-done-outline'}
                size={15}
                color={active ? '#6366F1' : '#94A3B8'}
              />
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {isOffTab ? 'Hors ligne' : 'En ligne'}
              </Text>
              {isOffTab && offlinePending > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeText}>{offlinePending}</Text>
                </View>
              )}
              {!isOffTab && allOnlineOrders.length > 0 && (
                <View style={[s.tabBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[s.tabBadgeText, { color: '#16A34A' }]}>{allOnlineOrders.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <Animated.View style={[s.tabIndicator, {
          left: tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] }),
        }]} />
      </View>

      {/* Barre de recherche */}
      <SearchBar value={search} onChange={setSearch} />

      {/* ── TAB OFFLINE ──────────────────────────────────────────────────── */}
      {activeTab === 'offline' && (
        <>
          {loadingOffline
            ? <ActivityIndicator style={{ marginTop: 40 }} color="#6366F1" />
            : (
              <>
                {offlineOrders.length > 0 && (
                  <View style={s.summary}>
                    {[
                      { count: offlineOrders.length,                                              label: 'Total',      color: '#1E293B' },
                      { count: offlineOrders.filter((o) => o.status === 'pending_sync').length,   label: 'En attente', color: '#F59E0B' },
                      { count: offlineOrders.filter((o) => o.status === 'synced').length,         label: 'Envoyées',   color: '#10B981' },
                      { count: offlineOrders.filter((o) => o.status === 'failed').length,         label: 'Échecs',     color: '#EF4444' },
                    ].map(({ count, label, color }) => (
                      <View key={label} style={s.summaryItem}>
                        <Text style={[s.summaryCount, { color }]}>{count}</Text>
                        <Text style={s.summaryLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <FlatList
                  data={filteredOffline}
                  keyExtractor={(o) => o.localId}
                  renderItem={({ item }) => <OfflineCard order={item} symbol={symbol} />}
                  contentContainerStyle={
                    filteredOffline.length === 0
                      ? s.emptyContainer
                      : { padding: 12, gap: 12, paddingBottom: 100 }
                  }
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshingOff}
                      onRefresh={() => { setRefreshingOff(true); loadOffline(); }}
                      colors={['#6366F1']}
                    />
                  }
                  ListEmptyComponent={<EmptyState search={search} />}
                />
              </>
            )
          }

          {/* FAB sync */}
          <TouchableOpacity
            style={[s.fab, syncing && s.fabBusy]}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.8}
          >
            {syncing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="sync-outline" size={24} color="#fff" />
            }
          </TouchableOpacity>
        </>
      )}

      {/* ── TAB ONLINE ───────────────────────────────────────────────────── */}
      {activeTab === 'online' && (
        loadingOnline
          ? <ActivityIndicator style={{ marginTop: 40 }} color="#6366F1" />
          : (
            <>
              {allOnlineOrders.length > 0 && (
                <View style={s.summary}>
                  {ORDER_STATES.map((st) => {
                    const count = allOnlineOrders.filter(
                      (o) => ((o as any).state ?? 'pending') === st.key
                    ).length;
                    if (count === 0) return null;
                    return (
                      <View key={st.key} style={s.summaryItem}>
                        <Text style={[s.summaryCount, { color: st.color }]}>{count}</Text>
                        <Text style={s.summaryLabel}>{st.label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <FlatList
                data={pagedOnline}
                keyExtractor={(o) => String(o.id ?? o.reference_order)}
                renderItem={({ item }) => (
                  <OnlineCard
                    order={item}
                    symbol={symbol}
                    onEditStatus={setEditingOrder}
                    onAddAdvance={setAdvanceOrder}
                  />
                )}
                contentContainerStyle={
                  pagedOnline.length === 0
                    ? s.emptyContainer
                    : { padding: 12, gap: 12, paddingBottom: 40 }
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingOn}
                    onRefresh={() => loadOnline(true)}
                    colors={['#6366F1']}
                  />
                }
                // ── Pagination infinie ──────────────────────────────────────
                onEndReached={loadMoreOnline}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                  hasMoreOnline ? (
                    <View style={s.footerLoader}>
                      {loadingMore
                        ? <ActivityIndicator color="#6366F1" />
                        : <Text style={s.footerLoaderText}>
                            {filteredOnline.length - pagedOnline.length} commande(s) supplémentaire(s)
                          </Text>
                      }
                    </View>
                  ) : null
                }
                ListEmptyComponent={<EmptyState search={search} online />}
              />
            </>
          )
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <EditStatusModal
        visible={!!editingOrder}
        order={editingOrder}
        shopId={shopId}
        onClose={() => setEditingOrder(null)}
        onSaved={handleOrderUpdated}
      />
      <AddAdvanceModal
        visible={!!advanceOrder}
        order={advanceOrder}
        shopId={shopId}
        symbol={symbol}
        onClose={() => setAdvanceOrder(null)}
        onSaved={handleOrderUpdated}
      />

    </SafeAreaView>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ search, online }: { search?: string; online?: boolean }) => (
  <View style={s.emptyInner}>
    <Ionicons name={search ? 'search-outline' : 'receipt-outline'} size={56} color="#CBD5E1" />
    <Text style={s.emptyTitle}>{search ? 'Aucun résultat' : 'Aucune commande'}</Text>
    <Text style={s.emptyText}>
      {search
        ? `Aucune commande pour "${search}"`
        : online
          ? 'Les commandes en ligne apparaîtront ici.'
          : 'Les commandes hors ligne apparaîtront ici.'}
    </Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#F8FAFC' },
  apiBanner   : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5 },
  apiBannerText: { fontSize: 12, fontWeight: '500' },

  tabs         : { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', position: 'relative' },
  tab          : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  tabActive    : {},
  tabText      : { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
  tabTextActive: { color: '#6366F1', fontWeight: '700' },
  tabBadge     : { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText : { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  tabIndicator : { position: 'absolute', bottom: 0, width: '50%', height: 2.5, backgroundColor: '#6366F1', borderRadius: 2 },

  searchBar  : { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 14, backgroundColor: '#fff', borderRadius: 12, height: 44, borderWidth: 1.5, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B' },

  summary     : { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 4, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  summaryItem : { minWidth: '22%', alignItems: 'center', gap: 2, paddingVertical: 2 },
  summaryCount: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 10, color: '#94A3B8' },

  card       : { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader : { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardRef    : { fontSize: 12, color: '#94A3B8', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  cardDate   : { fontSize: 13, fontWeight: '600', color: '#1E293B', marginTop: 2 },

  badge    : { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  actionBtn: { padding: 6 },

  infoRow  : { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText : { fontSize: 13, color: '#475569', fontWeight: '500' },
  infoSub  : { fontSize: 12, color: '#94A3B8', marginLeft: 4 },

  itemsList: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, gap: 6 },
  itemRow  : { flexDirection: 'row', alignItems: 'center' },
  itemName : { flex: 1, fontSize: 12, color: '#475569' },
  itemQty  : { fontSize: 12, color: '#94A3B8', marginRight: 8 },
  itemPrice: { fontSize: 12, fontWeight: '600', color: '#1E293B' },

  finBlock    : { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, gap: 8 },
  finRow      : { flexDirection: 'row', justifyContent: 'space-between' },
  finLabel    : { fontSize: 13, color: '#64748B' },
  finValue    : { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  finValueBold: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  finDivider  : { height: 1, backgroundColor: '#E2E8F0' },

  balanceBox      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10 },
  balanceBoxPaid  : { backgroundColor: '#DCFCE7' },
  balanceLabel    : { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  balanceLabelPaid: { color: '#16A34A' },
  balanceValue    : { fontSize: 14, fontWeight: '800', color: '#DC2626' },
  balanceValuePaid: { color: '#16A34A' },

  errorBox : { flexDirection: 'row', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  errorText: { flex: 1, fontSize: 11, color: '#B91C1C' },

  footerLoader    : { paddingVertical: 20, alignItems: 'center' },
  footerLoaderText: { fontSize: 12, color: '#94A3B8', marginTop: 4 },

  emptyContainer: { flex: 1 },
  emptyInner    : { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle    : { fontSize: 17, fontWeight: '700', color: '#94A3B8' },
  emptyText     : { fontSize: 13, color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },

  fab    : { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', zIndex: 999, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  fabBusy: { backgroundColor: '#94A3B8' },

  modalOverlay  : { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet    : { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, gap: 12 },
  modalHandle   : { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle    : { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalSubtitle : { fontSize: 13, color: '#94A3B8', marginTop: -6 },
  modalSectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 },

  stateGrid   : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stateBtn    : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  stateBtnText: { fontSize: 13, color: '#94A3B8' },

  methodRow      : { flexDirection: 'row', gap: 10 },
  methodBtn      : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  methodBtnActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  methodBtnText  : { fontSize: 14, fontWeight: '700', color: '#64748B' },

  modalInputRow   : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', overflow: 'hidden' },
  modalInputIcon  : { width: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DCFCE7', paddingVertical: 12 },
  modalInput      : { flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#1E293B', fontWeight: '600' },
  modalInputSuffix: { paddingRight: 14, fontSize: 13, fontWeight: '700', color: '#94A3B8' },

  advanceSummary: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, gap: 8 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn    : { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});

export default OrderHistoryScreen;