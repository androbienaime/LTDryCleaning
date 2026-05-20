// screens/AccountsManagerScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  SafeAreaView,
  StatusBar,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { useMultiAccount } from '@/context/MultiAccountContext';
import { SavedAccount } from '@/utils/multiAccountStorage';
import { useAuth } from '@/context/AuthContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PIN_LENGTH = 4;
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

// ─── Sous-composant : Modal de configuration PIN ──────────────────────────────

type PinModalProps = {
  visible: boolean;
  account: SavedAccount | null;
  mode: 'set' | 'remove' | 'verify'; // verify = confirmer avant suppression
  onClose: () => void;
  onConfirm: (pin: string) => void;
};

const PinModal: React.FC<PinModalProps> = ({
  visible,
  account,
  mode,
  onClose,
  onConfirm,
}) => {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [errorMsg, setErrorMsg] = useState('');
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  const reset = () => {
    setPin('');
    setConfirm('');
    setStep('enter');
    setErrorMsg('');
  };

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = (key: string) => {
    if (key === '') return;
    const current = step === 'enter' ? pin : confirm;
    const setter = step === 'enter' ? setPin : setConfirm;

    if (key === '⌫') {
      setter(current.slice(0, -1));
      setErrorMsg('');
      return;
    }

    const next = current + key;
    setter(next);

    if (next.length === PIN_LENGTH) {
      if (mode === 'set') {
        if (step === 'enter') {
          setStep('confirm');
        } else {
          // Comparer les deux saisies
          if (next === pin) {
            onConfirm(pin);
            reset();
          } else {
            setErrorMsg('Les PIN ne correspondent pas. Recommencez.');
            shake();
            setPin('');
            setConfirm('');
            setStep('enter');
          }
        }
      } else {
        // verify / remove
        onConfirm(next);
        reset();
      }
    }
  };

  const title =
    mode === 'set'
      ? step === 'enter'
        ? 'Choisir un PIN'
        : 'Confirmer le PIN'
      : mode === 'remove'
      ? 'Entrer le PIN actuel'
      : 'Confirmer le PIN';

  const currentVal = step === 'enter' ? pin : confirm;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          {/* Handle */}
          <View style={modalStyles.handle} />
      
          <Text style={modalStyles.title}>{title}</Text>
          {account && (
            <View style={[modalStyles.chip, { backgroundColor: account.avatarColor + '22' }]}>
              <View style={[modalStyles.chipDot, { backgroundColor: account.avatarColor }]}>
                <Text style={modalStyles.chipInitial}>
                   {account?.user?.firstname.charAt(0).toUpperCase()} 
                </Text>
              </View>
              <Text style={[modalStyles.chipName, { color: account.avatarColor }]}>
                {account?.user?.firstname}
              </Text>
            </View>
          )}
       
          {/* Dots */}
          <Animated.View
            style={[modalStyles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  modalStyles.dot,
                  i < currentVal.length && modalStyles.dotFilled,
                ]}
              />
            ))}
          </Animated.View>

          {errorMsg ? (
            <Text style={modalStyles.error}>{errorMsg}</Text>
          ) : (
            <Text style={modalStyles.errorPlaceholder}> </Text>
          )}

          {/* Clavier */}
          <View style={modalStyles.keyboard}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={modalStyles.keyRow}>
                {row.map((key, ki) => (
                  <TouchableOpacity
                    key={ki}
                    style={[modalStyles.key, key === '' && modalStyles.keyEmpty]}
                    onPress={() => handleKey(key)}
                    activeOpacity={0.7}
                    disabled={key === ''}
                  >
                    <Text
                      style={[
                        modalStyles.keyText,
                        key === '⌫' && modalStyles.backspaceText,
                      ]}
                    >
                      {key}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => { reset(); onClose(); }}
            style={modalStyles.cancelBtn}
          >
            <Text style={modalStyles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

type Props = {
  onSwitched?: (accountId: string) => void;
  onAddAccount?: () => void; // navigue vers LoginScreen pour ajouter un nouveau compte
};

const AccountsManagerScreen: React.FC<Props> = ({ onSwitched, onAddAccount }) => {
  const {
    accounts,
    activeAccount,
    switchToAccount,
    setAccountPin,
    removeAccountPin,
    removeAccount,
  } = useMultiAccount();

  // Vérifier que onAddAccount est bien fourni avant d'appeler
  const handleAddAccount = () => {
    if (!onAddAccount) {
      Alert.alert('Erreur', 'Navigation non disponible');
      return;
    }
    onAddAccount();
  };
  const [pinModal, setPinModal] = useState<{
    visible: boolean;
    account: SavedAccount | null;
    accountActive: SavedAccount | null;
    mode: 'set' | 'remove' | 'verify';
    actionAfterVerify?: 'delete' | 'removePin';
  }>({ visible: false, account: null, accountActive: null,  mode: 'set' });

  const openPinModal = (
    account: SavedAccount,
    accountActive : SavedAccount,
    mode: 'set' | 'remove' | 'verify',
    actionAfterVerify?: 'delete' | 'removePin'
  ) => {
    setPinModal({ visible: true, account, accountActive, mode, actionAfterVerify });
  };

  const closePinModal = () =>
    setPinModal({ visible: false, account: null, accountActive : null, mode: 'set' });

  const handlePinConfirm = async (pin: string) => {
    const { account, accountActive, mode, actionAfterVerify } = pinModal;
    if (!account) return;
    closePinModal();

    if (mode === 'set') {
      await setAccountPin(account.id, pin);
    } else if (mode === 'remove') {
      await removeAccountPin(account.id);
    } else if (mode === 'verify') {
      // Vérifier puis exécuter l'action
      const { MultiAccountStorage } = await import('@/utils/multiAccountStorage');
      const matched = await MultiAccountStorage.verifyPin(pin);
      if (!matched || matched.id !== accountActive.id) {
        Alert.alert('PIN incorrect', 'Le PIN entré ne correspond pas.');
        return;
      }
      if (actionAfterVerify === 'delete') {
        await removeAccount(account.id);
      } else if (actionAfterVerify === 'removePin') {
        await removeAccountPin(account.id);
      }
    }
  };

  const handleSwitch = async (account: SavedAccount) => {
    if (account.id === activeAccount?.id) return;
    await switchToAccount(account.id);
    onSwitched?.(account.id);
  };

  const handleDeleteAccount = (account: SavedAccount, accountActive: SavedAccount) => {
    const doDelete = () =>
      Alert.alert(
        'Supprimer le compte',
        `Supprimer "${account.user.firstname}" de cet appareil ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => removeAccount(account.id),
          },
        ]
      );

    if (activeAccount?.pinHash) {
      openPinModal(account, accountActive, 'verify', 'delete');
    } else {
      doDelete();
    }
  };

  const handleTogglePin = (account: SavedAccount, accountActive: SavedAccount) => {
    if (account.pinHash) {
      // Proposer de supprimer le PIN
      Alert.alert('PIN actif', 'Que souhaitez-vous faire ?', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier le PIN',
          onPress: () => openPinModal(account, accountActive, 'set'),
        },
        {
          text: 'Supprimer le PIN',
          style: 'destructive',
          onPress: () => openPinModal(account, accountActive, 'verify', 'removePin'),
        },
      ]);
    } else {
      openPinModal(account, accountActive, 'set');
    }
  };

  const sorted = [...accounts].sort((a, b) => {
    if (a.id === activeAccount?.id) return -1;
    if (b.id === activeAccount?.id) return 1;
    return b.lastUsedAt - a.lastUsedAt;
  });

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

    const shopId: string = activeAccount?.user?.shop?.[0]?.id ?? '';
    const { hasPermission } = useAuth();

    const canViewAccounts = hasPermission(
      shopId,
      'view_core::account'
    );

    // const canDeleteAccounts = hasPermission(shopId, 'delete_core::account');

    const visibleAccounts = canViewAccounts
    ? sorted
    : sorted.filter(
        (account) => account.id === activeAccount?.id
    );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Comptes enregistrés</Text>
        <Text style={styles.subtitle}>
          {accounts.length} compte{accounts.length !== 1 ? 's' : ''} sur cet appareil
        </Text>
  

    {visibleAccounts.map((account) => {

      const isActive = account.id === activeAccount?.id;

      return (
        <View
          key={account.id}
          style={[styles.card, isActive && styles.cardActive]}
        >
          {/* Avatar + infos */}
          <TouchableOpacity
            style={styles.cardLeft}
            onPress={() => handleSwitch(account)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: account.avatarColor },
                isActive && styles.avatarActive,
              ]}
            >
              {account.user.account_profile != undefined ? (
                <Image
                  source={{ uri: account.user.account_profile }}
                  style={styles.itemImg}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {account.user.firstname?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              )}
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {account.user.firstname}
                </Text>

                {isActive && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>
                      Actif
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.email} numberOfLines={1}>
                {account.user.email}
              </Text>

              <Text style={styles.meta}>
                Dernière utilisation :{' '}
                {formatDate(account.lastUsedAt)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.cardActions}>

            {/* Bouton PIN */}
            <TouchableOpacity
              style={[
                styles.pinBtn,
                account.pinHash && styles.pinBtnActive,
              ]}
              onPress={() => handleTogglePin(account, activeAccount)}
            >
              <Text style={styles.pinIcon}>
                {account.pinHash ? '🔒' : '🔓'}
              </Text>

              <Text
                style={[
                  styles.pinLabel,
                  account.pinHash &&
                    styles.pinLabelActive,
                ]}
              >
                PIN
              </Text>
            </TouchableOpacity>

            {canViewAccounts ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteAccount(account, activeAccount)}
              >
                <Text style={styles.deleteIcon}>🗑</Text>
              </TouchableOpacity>
            ) : (
              <></>
            )
            
            } 

          </View>
        </View>
      );
    })}


        {/* Ajouter un compte */}
        <TouchableOpacity style={styles.addBtn} onPress={onAddAccount}>
          <Text style={styles.addIcon}>＋</Text>
          <Text style={styles.addText}>Ajouter un compte</Text>
        </TouchableOpacity>

        {/* Légende PIN */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>💡 Comment fonctionne le PIN ?</Text>
          <Text style={styles.legendText}>
            Activez un PIN sur un compte pour pouvoir y accéder rapidement au
            démarrage de l'application, même sans connexion internet. Chaque
            PIN est unique par compte.
          </Text>
        </View>
      </ScrollView>

      {/* Modal PIN */}
      <PinModal
        visible={pinModal.visible}
        account={pinModal.account}
        mode={pinModal.mode}
        onClose={closePinModal}
        onConfirm={handlePinConfirm}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardActive: {
    borderColor: '#6366F1',
    backgroundColor: '#FAFAFE',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActive: {
    borderWidth: 2.5,
    borderColor: '#6366F1',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '700',
  },
  email: { fontSize: 12, color: '#64748B' },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    minWidth: 44,
  },
  pinBtnActive: { backgroundColor: '#EEF2FF' },
  pinIcon: { fontSize: 18 },
  pinLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  pinLabelActive: { color: '#6366F1' },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
  },
  deleteIcon: { fontSize: 18 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addIcon: { fontSize: 22, color: '#6366F1' },
  addText: { fontSize: 15, color: '#6366F1', fontWeight: '600' },
  legend: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 6,
  },
  legendTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  legendText: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  itemImg:{
    height: 50, 
    width: 50,
    // borderColor: "gray",
    borderWidth: 2,
    borderRadius: 30,
    // backgroundColor: "red"
  }
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 24,
  },
  chipDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInitial: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipName: { fontSize: 13, fontWeight: '600' },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  error: { color: '#F87171', fontSize: 12, marginBottom: 8 },
  errorPlaceholder: { minHeight: 20 },
  keyboard: { width: '100%', gap: 10, marginBottom: 16 },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '500', color: '#F1F5F9' },
  backspaceText: { fontSize: 20, color: '#94A3B8' },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
});

export default AccountsManagerScreen;