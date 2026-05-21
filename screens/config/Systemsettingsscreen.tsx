// screens/settings/SystemSettingsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, FlatList, Alert, StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSetup } from '@/context/AppSetupContext';
import { currencyService } from '@/src/api/services/currency.services';
import { AppSetup, SetupConfig } from '@/utils/appSetup';
import { Currencies } from '@/src/@types/models';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation?: any;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SystemSettingsScreen
// ═══════════════════════════════════════════════════════════════════════════════

export default function SystemSettingsScreen({ navigation }: Props) {
  const { setupConfig, completeSetup } = useAppSetup();

  const [loading,            setLoading]            = useState(false);
  const [savingCurrency,     setSavingCurrency]      = useState(false);
  const [currencyModalOpen,  setCurrencyModalOpen]   = useState(false);
  const [availableCurrencies, setAvailableCurrencies] = useState<Currencies[]>([]);
  const [selectedCurrency,   setSelectedCurrency]    = useState<Currencies | null>(
    setupConfig.currency ?? null
  );
  const [setupAt, setSetupAt] = useState<string>('—');

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    if (setupConfig.setupAt) {
      setSetupAt(new Date(setupConfig.setupAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }));
    }
    setSelectedCurrency(setupConfig.currency ?? null);
  }, [setupConfig]);

  // ── Ouverture modal devise ─────────────────────────────────────────────────
  const openCurrencyModal = useCallback(async () => {
    setLoading(true);
    try {
      const list = await currencyService.list();
      setAvailableCurrencies(list);
      setCurrencyModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sélection + sauvegarde de la devise ────────────────────────────────────
  const handleCurrencySelect = useCallback(async (currency: Currencies) => {
    setCurrencyModalOpen(false);
    setSavingCurrency(true);
    try {
      // Met à jour uniquement la devise, garde tout le reste intact
      const full = await AppSetup.getConfig();
      await completeSetup({
        ...(full as SetupConfig),
        currency: currency,
      });
      setSelectedCurrency(currency);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder la devise.');
    } finally {
      setSavingCurrency(false);
    }
  }, [completeSetup]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* ── En-tête ────────────────────────────────────────────────── */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Paramètres système</Text>
            <Text style={styles.pageSubtitle}>
              Configuration globale de l'application
            </Text>
          </View>

          {/* ══════════════════════════════════════════════════════════════
              SECTION — SHOP
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeader icon="🏪" label="Shop principal" />

          <View style={styles.card}>
            <InfoRow
              label="Nom du shop"
              value={setupConfig.shop?.name ?? '—'}
              icon="🏬"
            />
            <Divider />
            <InfoRow
              label="Identifiant"
              value={setupConfig.shopId ? `#${setupConfig.shopId}` : '—'}
              icon="🔑"
              mono
            />
            {setupConfig.shop?.description ? (
              <>
                <Divider />
                <InfoRow
                  label="Description"
                  value={setupConfig.shop.description}
                  icon="📝"
                />
              </>
            ) : null}

            {/* Badge "non modifiable" */}
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedIcon}>🔒</Text>
              <Text style={styles.lockedText}>
                Le shop ne peut pas être modifié après la configuration initiale.
              </Text>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════════════
              SECTION — DEVISE
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeader icon="💱" label="Devise principale" />

          <View style={styles.card}>
            {/* Devise actuelle */}
            <View style={styles.currencyRow}>
              <View style={styles.currencySymbolBox}>
                <Text style={styles.currencySymbolBig}>
                  {selectedCurrency?.symbol ?? '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.currencyNameBig}>
                  {selectedCurrency?.name ?? '—'}
                </Text>
                <Text style={styles.currencyMeta}>
                  {selectedCurrency?.iso_code ?? '—'}
                  {selectedCurrency?.country ? `  ·  ${selectedCurrency.country}` : ''}
                </Text>
              </View>
              {savingCurrency ? (
                <ActivityIndicator color="#6366F1" />
              ) : (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={openCurrencyModal}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.editBtnText}>Modifier</Text>
                  }
                </TouchableOpacity>
              )}
            </View>

            <Divider />
            <InfoRow
              label="Taux de change"
              value={selectedCurrency?.exchange_rate
                ? `1 USD = ${selectedCurrency.exchange_rate} ${selectedCurrency.iso_code}`
                : '—'
              }
              icon="📈"
            />
          </View>

          {/* ══════════════════════════════════════════════════════════════
              SECTION — META
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeader icon="ℹ️" label="Informations de configuration" />

          <View style={styles.card}>
            <InfoRow
              label="Configuré le"
              value={setupAt}
              icon="📅"
            />
            <Divider />
            <InfoRow
              label="Configuré par (ID)"
              value={setupConfig.setupById ? `#${setupConfig.setupById}` : '—'}
              icon="👤"
              mono
            />
          </View>

          {/* ══════════════════════════════════════════════════════════════
              SECTION — CLÉS STORAGE (debug)
          ══════════════════════════════════════════════════════════════ */}
          <SectionHeader icon="💾" label="Variables de stockage" />

          <View style={styles.card}>
            {[
              { key: 'APP:SETUP_COMPLETE', value: 'true'                                    },
              { key: 'APP:SHOP_ID',        value: setupConfig.shopId      ?? '—'            },
              { key: 'APP:SHOP',           value: setupConfig.shop?.name  ?? '—'            },
              { key: 'APP:CURRENCY',       value: selectedCurrency?.iso_code ?? '—'         },
              { key: 'APP:SETUP_AT',       value: setupConfig.setupAt ? String(setupConfig.setupAt) : '—' },
              { key: 'APP:SETUP_BY_ID',    value: setupConfig.setupById  ? String(setupConfig.setupById) : '—' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.key}>
                <View style={styles.storageRow}>
                  <Text style={styles.storageKey}>{item.key}</Text>
                  <Text style={styles.storageValue} numberOfLines={1}>{item.value}</Text>
                </View>
                {i < arr.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* ── Modal sélection devise ──────────────────────────────────────────── */}
      <CurrencyModal
        visible={currencyModalOpen}
        currencies={availableCurrencies}
        selected={selectedCurrency}
        onSelect={handleCurrencySelect}
        onClose={() => setCurrencyModalOpen(false)}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Sous-composants
// ═══════════════════════════════════════════════════════════════════════════════

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

// ── Ligne d'information ────────────────────────────────────────────────────

function InfoRow({ label, value, icon, mono = false }: {
  label: string; value: string; icon: string; mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── Séparateur ─────────────────────────────────────────────────────────────

function Divider() {
  return <View style={styles.divider} />;
}

// ── Modal devise ───────────────────────────────────────────────────────────

function CurrencyModal({ visible, currencies, selected, onSelect, onClose }: {
  visible: boolean;
  currencies: Currencies[];
  selected: Currencies | null;
  onSelect: (c: Currencies) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modal.overlay}>
        <View style={modal.sheet}>

          {/* Handle */}
          <View style={modal.handle} />

          <Text style={modal.title}>Choisir une devise</Text>
          <Text style={modal.subtitle}>
            La devise sera appliquée à toute l'application.
          </Text>

          <FlatList
            data={currencies}
            keyExtractor={c => c.iso_code}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={modal.separator} />}
            renderItem={({ item }) => {
              const isActive = selected?.iso_code === item.iso_code;
              return (
                <TouchableOpacity
                  style={[modal.item, isActive && modal.itemActive]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={[modal.symbolBox, isActive && modal.symbolBoxActive]}>
                    <Text style={[modal.symbol, isActive && modal.symbolActive]}>
                      {item.symbol}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[modal.itemName, isActive && modal.itemNameActive]}>
                      {item.name}
                    </Text>
                    <Text style={modal.itemMeta}>
                      {item.iso_code}  ·  {item.country}
                    </Text>
                  </View>
                  {isActive && <Text style={modal.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelText}>Annuler</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe   : { flex: 1, backgroundColor: '#F8FAFC' },
  scroll : { padding: 16, paddingBottom: 40 },

  // Page header
  pageHeader   : { marginBottom: 24 },
  pageTitle    : { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  pageSubtitle : { fontSize: 13, color: '#94A3B8', marginTop: 4 },

  // Section header
  sectionHeader : { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 20 },
  sectionIcon   : { fontSize: 16 },
  sectionLabel  : { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Card
  card : {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Info row
  infoRow       : { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  infoIcon      : { fontSize: 18, marginTop: 1 },
  infoLabel     : { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue     : { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  infoValueMono : { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: '#6366F1' },

  // Divider
  divider : { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: -16, marginLeft: 46 },

  // Locked badge
  lockedBadge : {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, margin: 12,
    borderWidth: 1, borderColor: '#FDE047',
  },
  lockedIcon : { fontSize: 14 },
  lockedText : { flex: 1, fontSize: 12, color: '#854D0E', lineHeight: 16 },

  // Currency row
  currencyRow      : { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  currencySymbolBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  currencySymbolBig : { fontSize: 20, fontWeight: '800', color: '#6366F1' },
  currencyNameBig   : { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  currencyMeta      : { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  editBtn           : {
    backgroundColor: '#6366F1', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  editBtnText : { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Storage rows
  storageRow   : { paddingVertical: 10, gap: 2 },
  storageKey   : { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: '#94A3B8' },
  storageValue : { fontSize: 13, fontWeight: '600', color: '#334155' },
});

const modal = StyleSheet.create({
  overlay    : { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet      : {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 34, maxHeight: '80%',
  },
  handle     : { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  title      : { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  subtitle   : { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
  separator  : { height: 1, backgroundColor: '#F1F5F9' },

  item           : { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 12, paddingHorizontal: 4 },
  itemActive     : { backgroundColor: '#EEF2FF' },
  symbolBox      : { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  symbolBoxActive: { backgroundColor: '#E0E7FF' },
  symbol         : { fontSize: 18, fontWeight: '800', color: '#64748B' },
  symbolActive   : { color: '#6366F1' },
  itemName       : { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  itemNameActive : { color: '#4F46E5' },
  itemMeta       : { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  check          : { fontSize: 18, color: '#6366F1', fontWeight: '700' },

  cancelBtn  : { marginTop: 12, padding: 16, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14 },
  cancelText : { fontSize: 15, fontWeight: '700', color: '#64748B' },
});