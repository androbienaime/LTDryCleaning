// components/payment/PaymentPanel.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSetup } from '@/context/AppSetupContext';
import type { PaymentMethodType, OrderPaymentPayload, OrderFinancialSummary } from '@/src/@types/models';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  subtotal : number;
  onChange : (payload: OrderPaymentPayload, summary: OrderFinancialSummary) => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PaymentPanel
// ═══════════════════════════════════════════════════════════════════════════════

export default function PaymentPanel({ subtotal, onChange }: Props) {
  const { setupConfig } = useAppSetup();
  const symbol          = setupConfig.currency?.symbol ?? 'HTG';

  const [method,         setMethod]         = useState<PaymentMethodType>('cash');
  const [discountRaw,    setDiscountRaw]     = useState('');
  const [advanceEnabled, setAdvanceEnabled]  = useState(false);
  const [advanceRaw,     setAdvanceRaw]      = useState('');

  // ── Calculs ────────────────────────────────────────────────────────────────
  const discount   = clamp(Number(discountRaw) || 0, 0, subtotal);
  const totalNet   = subtotal - discount;
  const amountPaid = advanceEnabled
    ? clamp(Number(advanceRaw) || 0, 0, totalNet)
    : 0;
  const balance    = totalNet - amountPaid;

  // Statut du paiement :
  // - amountPaid === 0          → pas de paiement, balance = totalNet
  // - 0 < amountPaid < totalNet → avance partielle, has_advance = true
  // - amountPaid === totalNet   → soldé, balance = 0
  const isFullyPaid  = amountPaid > 0 && amountPaid >= totalNet;
  const isPartial    = amountPaid > 0 && amountPaid < totalNet;
  const isUnpaid     = amountPaid === 0;

  // ── Propagation ────────────────────────────────────────────────────────────
  useEffect(() => {
    onChange(
      { payment_method: method, amount_paid: amountPaid, discount },
      { subtotal, discount, total_net: totalNet, amount_paid: amountPaid, balance },
    );
  }, [method, amountPaid, discount, subtotal]);

  const handleDiscountChange = (v: string) => setDiscountRaw(v.replace(/[^0-9]/g, ''));
  const handleAdvanceChange  = (v: string) => setAdvanceRaw(v.replace(/[^0-9]/g, ''));
  const handleAdvanceToggle  = (val: boolean) => {
    setAdvanceEnabled(val);
    if (!val) setAdvanceRaw('');
  };

  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} ${symbol}`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.wrapper}>

      {/* ── Titre ──────────────────────────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <Ionicons name="card-outline" size={18} color="#6366F1" />
        <Text style={s.sectionTitle}>Paiement</Text>
      </View>

      {/* ── Méthode ────────────────────────────────────────────────────────── */}
      <Text style={s.label}>Méthode de paiement</Text>
      <View style={s.methodRow}>
        {(['cash', 'card'] as PaymentMethodType[]).map(m => {
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
                size={20}
                color={active ? '#fff' : '#64748B'}
              />
              <Text style={[s.methodText, active && s.methodTextActive]}>
                {m === 'cash' ? 'Espèces' : 'Carte'}
              </Text>
              {active && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color="#fff"
                  style={s.methodCheck}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Réduction ──────────────────────────────────────────────────────── */}
      <Text style={s.label}>Réduction (montant fixe)</Text>
      <View style={s.inputRow}>
        <View style={s.inputIcon}>
          <Ionicons name="pricetag-outline" size={16} color="#6366F1" />
        </View>
        <TextInput
          style={s.input}
          value={discountRaw}
          onChangeText={handleDiscountChange}
          placeholder="0"
          placeholderTextColor="#CBD5E1"
          keyboardType="numeric"
        />
        <Text style={s.inputSuffix}>{symbol}</Text>
      </View>

      {/* ── Avance ─────────────────────────────────────────────────────────── */}
      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Payer maintenant</Text>
          <Text style={s.sublabel}>
            {isUnpaid
              ? `Balance = ${fmt(totalNet)}`
              : isPartial
                ? `Avance — balance restante : ${fmt(balance)}`
                : '✓ Entièrement payé'}
          </Text>
        </View>
        <Switch
          value={advanceEnabled}
          onValueChange={handleAdvanceToggle}
          trackColor={{ false: '#E2E8F0', true: '#A5B4FC' }}
          thumbColor={advanceEnabled ? '#6366F1' : '#94A3B8'}
        />
      </View>

      {advanceEnabled && (
        <View style={s.inputRow}>
          <View style={s.inputIcon}>
            <Ionicons name="wallet-outline" size={16} color="#059669" />
          </View>
          <TextInput
            style={s.input}
            value={advanceRaw}
            onChangeText={handleAdvanceChange}
            placeholder="0"
            placeholderTextColor="#CBD5E1"
            keyboardType="numeric"
            autoFocus
          />
          <Text style={s.inputSuffix}>{symbol}</Text>
        </View>
      )}

      {/* ── Résumé ─────────────────────────────────────────────────────────── */}
      <View style={s.summary}>

        <Row label="Sous-total" value={fmt(subtotal)} />

        {discount > 0 && (
          <Row label="Réduction" value={`− ${fmt(discount)}`} color="#EF4444" />
        )}

        <View style={s.divider} />
        <Row label="Total net" value={fmt(totalNet)} bold />

        {isPartial && (
          <Row label="Payé maintenant" value={`${fmt(amountPaid)}`} color="#059669" />
        )}

        {isFullyPaid && (
          <Row label="Payé" value={fmt(amountPaid)} color="#059669" />
        )}

        {/* Balance — toujours affichée */}
        <View style={[
          s.balanceBox,
          isFullyPaid && s.balanceBoxPaid,
          isUnpaid    && s.balanceBoxUnpaid,
        ]}>
          <View>
            <Text style={[s.balanceLabel, isFullyPaid && s.balanceLabelPaid]}>
              {isFullyPaid ? '✓  Entièrement payé' : isPartial ? 'Balance restante' : 'À payer'}
            </Text>
            {isPartial && (
              <Text style={s.balanceSub}>Une avance sera enregistrée</Text>
            )}
          </View>
          <Text style={[s.balanceValue, isFullyPaid && s.balanceValuePaid]}>
            {fmt(balance)}
          </Text>
        </View>

      </View>

    </View>
  );
}

// ── Ligne de résumé ────────────────────────────────────────────────────────

function Row({ label, value, bold, color }: {
  label: string; value: string; bold?: boolean; color?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, bold && s.rowValueBold, color ? { color } : null]}>
        {value}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  wrapper       : { gap: 10 },
  sectionHeader : { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sectionTitle  : { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  label         : { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  sublabel      : { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Méthode
  methodRow       : { flexDirection: 'row', gap: 10 },
  methodBtn       : {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  methodBtnActive  : { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  methodText       : { fontSize: 14, fontWeight: '700', color: '#64748B' },
  methodTextActive : { color: '#fff' },
  methodCheck      : { position: 'absolute', top: 6, right: 8 },

  // Input
  inputRow   : {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  inputIcon  : {
    width: 44, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EEF2FF', paddingVertical: 14,
  },
  input      : {
    flex: 1, paddingHorizontal: 12, paddingVertical: 14,
    fontSize: 15, color: '#1E293B', fontWeight: '600',
  },
  inputSuffix : { paddingRight: 14, fontSize: 13, fontWeight: '700', color: '#94A3B8' },

  // Toggle
  toggleRow : {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },

  // Résumé
  summary : {
    backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 16, gap: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  divider   : { height: 1, backgroundColor: '#E2E8F0' },
  row       : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel  : { fontSize: 13, color: '#64748B' },
  rowValue  : { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  rowValueBold : { fontWeight: '700', fontSize: 14, color: '#0F172A' },

  // Balance box
  balanceBox       : {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
  },
  balanceBoxPaid   : { backgroundColor: '#DCFCE7' },
  balanceBoxUnpaid : { backgroundColor: '#FFF7ED' },
  balanceLabel     : { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  balanceLabelPaid : { color: '#16A34A' },
  balanceSub       : { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  balanceValue     : { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  balanceValuePaid : { color: '#16A34A' },
});