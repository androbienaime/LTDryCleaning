// screens/setup/SetupScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, StatusBar,
  KeyboardAvoidingView, Platform, Image, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shop, Currencies, AccountUser, AuthAccountResponse } from '@/src/@types/models';
import { authService } from '@/src/api/services/auth.service';
import { currencyService } from '@/src/api/services/currency.services';
import { extractIsSuperAdmin, extractPermissions } from '@/utils/jwt';
import { useAppSetup } from '@/context/AppSetupContext';
import { useMultiAccount } from '@/context/MultiAccountContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

type StepState = {
  // Résultats step 1
  authResponse : AuthAccountResponse | null;
  user         : AccountUser | null;
  token        : string;
  // Résultats step 2
  selectedShop : Shop | null;
  // Résultats step 3
  currencies        : Currencies[];
  selectedCurrency  : Currencies | null;
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  onSetupComplete: () => void;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Authentification',
  'Shop',
  'Devise',
  'Confirmation',
];

// ═══════════════════════════════════════════════════════════════════════════════
//  SetupScreen
// ═══════════════════════════════════════════════════════════════════════════════

export default function SetupScreen({ onSetupComplete }: Props) {
  const { completeSetup } = useAppSetup();
  const { addAccount }    = useMultiAccount();

  const [step,      setStep]      = useState<Step>(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Champs Step 1 ──────────────────────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // ── Données accumulées ─────────────────────────────────────────────────────
  const [state, setState] = useState<StepState>({
    authResponse     : null,
    user             : null,
    token            : '',
    selectedShop     : null,
    currencies       : [],
    selectedCurrency : null,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearError = () => setError(null);

  const patch = (partial: Partial<StepState>) =>
    setState(prev => ({ ...prev, ...partial }));

  // ── STEP 1 : Authentification super-admin ──────────────────────────────────

  const handleSuperAdminLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    clearError();
    try {
      const authResponse = await authService.login({ email: email.trim(), password });
      const { token, user } = authResponse;

      // ✅ Vérification du claim is_super_admin dans le JWT
      const isSuperAdmin = extractIsSuperAdmin(token);
      if (!isSuperAdmin) {
        setError("Accès refusé : seul un super-administrateur peut configurer l'application.");
        return;
      }

      // Hydrate les permissions dans l'objet user
      const permissions = extractPermissions(token);
      const userWithPerms: AccountUser = { ...user, permissions };

      patch({ authResponse, user: userWithPerms, token });
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2 : Sélection du shop ─────────────────────────────────────────────

  const handleShopSelect = async (shop: Shop) => {
    setLoading(true);
    clearError();
    try {
      const currencies = await currencyService.list();
      patch({ selectedShop: shop, currencies });
      setStep(3);
    } catch {
      setError('Impossible de charger les devises.');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3 : Sélection de la devise ───────────────────────────────────────

  const handleCurrencySelect = (currency: Currencies) => {
    patch({ selectedCurrency: currency });
  };

  const handleCurrencyConfirm = () => {
    if (!state.selectedCurrency) {
      setError('Veuillez sélectionner une devise.');
      return;
    }
    clearError();
    setStep(4);
  };

  // ── STEP 4 : Finalisation ─────────────────────────────────────────────────

  const handleFinish = async () => {
    const { user, token, authResponse, selectedShop, selectedCurrency } = state;
    if (!user || !selectedShop || !selectedCurrency || !authResponse) return;

    setLoading(true);
    clearError();
    try {
      // 1. Sauvegarde la config de l'app
      await completeSetup({
        shopId    : selectedShop.id,
        shop      : selectedShop,
        currency  : selectedCurrency,
        setupAt   : Date.now(),
        setupById : user.id,
      });

      // 2. Enregistre le super-admin comme compte actif
      await addAccount({
        user         : user,
        token        : authResponse.token,
        refreshToken : authResponse.refresh_token,
        pin          : undefined,
      });

      // 3. Transition vers l'app principale
      onSetupComplete();
    } catch (e: any) {
      setError("Erreur lors de la sauvegarde de la configuration.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >

          {/* ── Header ───────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Configuration initiale</Text>
            <StepIndicator current={step} total={4} labels={STEP_LABELS} />
          </View>

          {/* ── Contenu ───────────────────────────────────────────────────── */}
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Bannière d'erreur */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            {/* ── Step 1 ─────────────────────────────────────────────────── */}
            {step === 1 && (
              <StepCard
                icon="🔐"
                title="Authentification super-admin"
                description="Pour configurer l'application, connectez-vous avec un compte super-administrateur."
              >
                <SetupInput
                  label="Adresse email"
                  placeholder="admin@example.com"
                  value={email}
                  onChangeText={v => { setEmail(v); clearError(); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <SetupInput
                  label="Mot de passe"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={v => { setPassword(v); clearError(); }}
                  secureTextEntry
                />
                <SetupButton
                  label="Vérifier et continuer →"
                  onPress={handleSuperAdminLogin}
                  loading={loading}
                />
              </StepCard>
            )}

            {/* ── Step 2 ─────────────────────────────────────────────────── */}
            {step === 2 && (
              <StepCard
                icon="🏪"
                title="Sélectionnez le shop principal"
                description="Ce shop sera utilisé comme référence pour tous les comptes qui se connecteront à l'application."
              >
                {(state.user?.shop ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>
                    Aucun shop associé à ce compte.{'\n'}
                    Associez d'abord ce compte à un shop depuis le panel d'administration.
                  </Text>
                ) : (
                  (state.user?.shop ?? []).map(shop => (
                    <TouchableOpacity
                      key={shop.id}
                      style={[
                        styles.shopCard,
                        state.selectedShop?.id === shop.id && styles.shopCardActive,
                      ]}
                      onPress={() => handleShopSelect(shop)}
                      disabled={loading}
                    >
                      {shop.profile ? (
                        <Image source={{ uri: shop.profile }} style={styles.shopLogo} />
                      ) : (
                        <View style={styles.shopLogoPlaceholder}>
                          <Text style={styles.shopLogoInitial}>
                            {shop.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shopName}>{shop.name}</Text>
                        {shop.description ? (
                          <Text style={styles.shopDesc} numberOfLines={1}>
                            {shop.description}
                          </Text>
                        ) : null}
                      </View>
                      {loading && state.selectedShop?.id === shop.id && (
                        <ActivityIndicator size="small" color="#6366F1" />
                      )}
                      {state.selectedShop?.id !== shop.id && (
                        <Text style={styles.shopArrow}>›</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}

                <BackButton onPress={() => { clearError(); setStep(1); }} />
              </StepCard>
            )}

            {/* ── Step 3 ─────────────────────────────────────────────────── */}
            {step === 3 && (
              <StepCard
                icon="💱"
                title="Devise principale"
                description="Choisissez la devise utilisée par défaut dans l'application."
              >
                <View style={styles.currencyGrid}>
                  {state.currencies.map(c => {
                    const isSelected = state.selectedCurrency?.iso_code === c.iso_code;
                    return (
                      <TouchableOpacity
                        key={c.iso_code}
                        style={[styles.currencyCard, isSelected && styles.currencyCardActive]}
                        onPress={() => { handleCurrencySelect(c); clearError(); }}
                      >
                        <Text style={[styles.currencySymbol, isSelected && styles.textActive]}>
                          {c.symbol}
                        </Text>
                        <Text style={[styles.currencyCode, isSelected && styles.textActive]}>
                          {c.iso_code}
                        </Text>
                        <Text style={[styles.currencyName, isSelected && styles.textActiveSubtle]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <SetupButton
                  label="Confirmer →"
                  onPress={handleCurrencyConfirm}
                  disabled={!state.selectedCurrency}
                />
                <BackButton onPress={() => { clearError(); setStep(2); }} />
              </StepCard>
            )}

            {/* ── Step 4 ─────────────────────────────────────────────────── */}
            {step === 4 && (
              <StepCard
                icon="✅"
                title="Récapitulatif"
                description="Vérifiez les informations avant de finaliser la configuration."
              >
                <SummaryRow label="Super-admin" value={state.user?.email ?? '—'} />
                <SummaryRow label="Shop"        value={state.selectedShop?.name ?? '—'} />
                <SummaryRow label="Shop ID"     value={state.selectedShop?.id   ?? '—'} />
                <SummaryRow
                  label="Devise"
                  value={
                    state.selectedCurrency
                      ? `${state.selectedCurrency.name} (${state.selectedCurrency.symbol} ${state.selectedCurrency.iso_code})`
                      : '—'
                  }
                />

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Ces paramètres seront stockés localement. Seuls les comptes
                    associés au shop <Text style={{ fontWeight: '700' }}>{state.selectedShop?.name}</Text>{' '}
                    pourront se connecter à l'application.
                  </Text>
                </View>

                <SetupButton
                  label={loading ? '' : '🚀  Démarrer l\'application'}
                  onPress={handleFinish}
                  loading={loading}
                  variant="success"
                />
                <BackButton onPress={() => { clearError(); setStep(3); }} />
              </StepCard>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Sous-composants
// ═══════════════════════════════════════════════════════════════════════════════

// ── Indicateur de progression ──────────────────────────────────────────────

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isDone    = n < current;
        const isCurrent = n === current;
        return (
          <React.Fragment key={n}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                isDone    && styles.stepDotDone,
                isCurrent && styles.stepDotCurrent,
              ]}>
                <Text style={[
                  styles.stepDotText,
                  (isDone || isCurrent) && styles.stepDotTextActive,
                ]}>
                  {isDone ? '✓' : n}
                </Text>
              </View>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive]}>
                {labels[i]}
              </Text>
            </View>
            {n < total && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Card de step ───────────────────────────────────────────────────────────

function StepCard({ icon, title, description, children }: {
  icon: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{description}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ── Champ de saisie ────────────────────────────────────────────────────────

function SetupInput(props: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        placeholderTextColor="#94A3B8"
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        secureTextEntry={props.secureTextEntry}
        autoCorrect={false}
      />
    </View>
  );
}

// ── Bouton principal ────────────────────────────────────────────────────────

function SetupButton({ label, onPress, loading = false, disabled = false, variant = 'primary' }: {
  label: string; onPress: () => void;
  loading?: boolean; disabled?: boolean; variant?: 'primary' | 'success';
}) {
  const bg = variant === 'success' ? '#059669' : '#6366F1';
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.btnText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ── Bouton retour ──────────────────────────────────────────────────────────

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress}>
      <Text style={styles.backText}>← Retour</Text>
    </TouchableOpacity>
  );
}

// ── Ligne de résumé ────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe : { flex: 1, backgroundColor: '#0F172A' },

  // Header
  header       : { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerTitle  : { fontSize: 22, fontWeight: '700', color: '#F1F5F9', marginBottom: 16, textAlign: 'center' },

  // Step indicator
  stepIndicator : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepItem      : { alignItems: 'center', width: 72 },
  stepDot       : {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotDone    : { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  stepDotCurrent : { backgroundColor: '#0F172A', borderColor: '#6366F1', borderWidth: 2.5 },
  stepDotText    : { fontSize: 11, fontWeight: '700', color: '#64748B' },
  stepDotTextActive : { color: '#F1F5F9' },
  stepLabel      : { fontSize: 9, color: '#64748B', marginTop: 4, textAlign: 'center' },
  stepLabelActive: { color: '#A5B4FC', fontWeight: '600' },
  stepLine       : { flex: 1, height: 2, backgroundColor: '#334155', marginBottom: 16 },
  stepLineDone   : { backgroundColor: '#6366F1' },

  // Content
  content : { padding: 16, paddingBottom: 40 },

  // Error
  errorBanner : {
    backgroundColor: '#FEF2F2', borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  errorText : { color: '#B91C1C', fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // Card
  card     : { backgroundColor: '#1E293B', borderRadius: 20, padding: 24, marginBottom: 12 },
  cardIcon : { fontSize: 36, textAlign: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#F1F5F9', textAlign: 'center', marginBottom: 6 },
  cardDesc : { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  cardBody : { gap: 12 },

  // Input
  inputWrapper : { marginBottom: 4 },
  inputLabel   : { fontSize: 13, fontWeight: '600', color: '#CBD5E1', marginBottom: 6 },
  input        : {
    backgroundColor: '#0F172A', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#F1F5F9',
    borderWidth: 1, borderColor: '#334155',
  },

  // Button
  btn         : { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled : { opacity: 0.5 },
  btnText     : { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Back
  backBtn  : { alignItems: 'center', paddingVertical: 14 },
  backText : { color: '#6366F1', fontWeight: '600', fontSize: 14 },

  // Shop cards
  shopCard : {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0F172A', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#334155',
  },
  shopCardActive : { borderColor: '#6366F1', backgroundColor: '#1E1B4B' },
  shopLogo       : { width: 44, height: 44, borderRadius: 10 },
  shopLogoPlaceholder : {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center',
  },
  shopLogoInitial : { fontSize: 18, fontWeight: '700', color: '#fff' },
  shopName        : { fontSize: 15, fontWeight: '700', color: '#F1F5F9' },
  shopDesc        : { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  shopArrow       : { fontSize: 22, color: '#475569' },

  emptyText : { color: '#94A3B8', textAlign: 'center', lineHeight: 22, paddingVertical: 16 },

  // Currency
  currencyGrid : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  currencyCard : {
    width: '30%', backgroundColor: '#0F172A', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#334155',
  },
  currencyCardActive : { borderColor: '#6366F1', backgroundColor: '#1E1B4B' },
  currencySymbol     : { fontSize: 20, fontWeight: '700', color: '#94A3B8' },
  currencyCode       : { fontSize: 13, fontWeight: '700', color: '#CBD5E1', marginTop: 2 },
  currencyName       : { fontSize: 9, color: '#64748B', marginTop: 2, textAlign: 'center' },
  textActive         : { color: '#A5B4FC' },
  textActiveSubtle   : { color: '#818CF8' },

  // Summary
  summaryRow   : {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  summaryLabel : { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  summaryValue : { fontSize: 13, color: '#F1F5F9', fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  // Info box
  infoBox  : {
    backgroundColor: '#172554', borderRadius: 12, padding: 14, marginVertical: 16,
    borderLeftWidth: 3, borderLeftColor: '#3B82F6',
  },
  infoText : { color: '#93C5FD', fontSize: 12, lineHeight: 18 },
});