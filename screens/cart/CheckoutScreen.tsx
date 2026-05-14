// screens/CheckoutScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, Modal, ActivityIndicator, StyleSheet,
  Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeColors, useThemeTypography } from '@/theme';
import { useCheckout, CheckoutStep } from '@/hooks/useCheckout';
import { useCart } from '@/context/CartContext';
import type { Customer } from '@/src/@types/models';

type Props = { navigation: NativeStackNavigationProp<any> };

// ─── Composant CustomerItem ───────────────────────────────────────────────────

const CustomerItem = ({
  customer,
  selected,
  onSelect,
}: {
  customer: Customer;
  selected: boolean;
  onSelect: () => void;
}) => {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={[
        styles.customerItem,
        selected && { borderColor: colors.button.primary, borderWidth: 2, backgroundColor: colors.button.primary + '11' },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={[styles.customerAvatar, { backgroundColor: colors.button.primary + '22' }]}>
        <Text style={[styles.customerAvatarText, { color: colors.button.primary }]}>
          {customer.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.customerName}>{customer.name}</Text>
        <Text style={styles.customerPhone}>{customer.phone}</Text>
        {customer.email && <Text style={styles.customerEmail}>{customer.email}</Text>}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.button.primary} />}
      {customer.savedToContacts && (
        <Ionicons name="person-circle-outline" size={18} color="#64748B" style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );
};

// ─── Écran principal ──────────────────────────────────────────────────────────

const CheckoutScreen = ({ navigation }: Props) => {
  const colors     = useThemeColors();
  const typography = useThemeTypography();
  const { cartItems, totalAmount } = useCart();

  const {
    step, setStep,
    customers, filteredContacts, contactsLoading,
    selectedCustomer, selectCustomer,
    newCustomer, setNewCustomerField, saveNewCustomer,
    searchContacts, contactSearch,
    deliveryDate, setDeliveryDate,
    deliveryTime, setDeliveryTime,
    note, setNote,
    isPlacing, placeOrder,
    canProceed, errors,
  } = useCheckout();

  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [saveToPhone,         setSaveToPhone]         = useState(true);
  const [showDatePicker,      setShowDatePicker]      = useState(false);
  const [showTimePicker,      setShowTimePicker]      = useState(false);
  const [activeTab,           setActiveTab]           = useState<'saved' | 'contacts'>('saved');

  // ── Formater la date ─────────────────────────────────────────────────────────

  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // ── Sauvegarder le nouveau customer ─────────────────────────────────────────

  const handleSaveCustomer = async () => {
    const saved = await saveNewCustomer(saveToPhone);
    if (saved) setShowNewCustomerForm(false);
  };

  // ── Passer la commande ───────────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    const result = await placeOrder();
    
    if (result.success) {
      navigation.replace('OrderConfirmation', {
        orderId:   result.orderId,
        isOffline: result.isOffline,
        message:   result.message,
        customer:  selectedCustomer,
        total:     totalAmount,
        deliveryDate: deliveryDate.toISOString(),
      });
    } else {
      Alert.alert('Erreur', result.message);
    }
  };

  // ── Rendu step "customer" ────────────────────────────────────────────────────

  const renderCustomerStep = () => (
    <View style={{ flex: 1 }}>

      {/* Onglets Sauvegardés / Contacts */}
      <View style={styles.tabs}>
        {(['saved', 'contacts'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.button.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: colors.button.primary, fontWeight: '600' }]}>
              {tab === 'saved' ? 'Clients sauvegardés' : 'Contacts téléphone'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          value={contactSearch}
          onChangeText={searchContacts}
        />
      </View>

      {/* Liste */}
      {activeTab === 'saved' ? (
        customers.length === 0 ? (
          <Text style={styles.emptyText}>Aucun client sauvegardé</Text>
        ) : (
          <FlatList
            data={customers.filter(
              (c) =>
                !contactSearch ||
                c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                c.phone.includes(contactSearch)
            )}
            keyExtractor={(c) => c.id ?? c.phone}
            renderItem={({ item }) => (
              <CustomerItem
                customer={item}
                selected={selectedCustomer?.id === item.id}
                onSelect={() => selectCustomer(item)}
              />
            )}
            style={{ flex: 1 }}
          />
        )
      ) : contactsLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.button.primary} />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(c) => c.id ?? c.phone}
          renderItem={({ item }) => (
            <CustomerItem
              customer={item}
              selected={selectedCustomer?.id === item.id}
              onSelect={() => selectCustomer(item)}
            />
          )}
          style={{ flex: 1 }}
        />
      )}

      {/* Bouton ajouter un nouveau */}
      <TouchableOpacity
        style={[styles.addCustomerBtn, { borderColor: colors.button.primary }]}
        onPress={() => setShowNewCustomerForm(true)}
      >
        <Ionicons name="person-add-outline" size={18} color={colors.button.primary} />
        <Text style={[styles.addCustomerText, { color: colors.button.primary }]}>
          Nouveau client
        </Text>
      </TouchableOpacity>

      {/* Modal nouveau customer */}
      <Modal visible={showNewCustomerForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Nouveau client</Text>

            {[
              { field: 'name',    label: 'Nom *',       keyboard: 'default' },
              { field: 'phone',   label: 'Téléphone *', keyboard: 'phone-pad' },
              { field: 'email',   label: 'Email',       keyboard: 'email-address' },
              { field: 'address', label: 'Adresse',     keyboard: 'default' },
            ].map(({ field, label, keyboard }) => (
              <View key={field} style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={[styles.input, errors[field] && styles.inputError]}
                  value={(newCustomer as any)[field] ?? ''}
                  onChangeText={(v) => setNewCustomerField(field as any, v)}
                  keyboardType={keyboard as any}
                  autoCapitalize={field === 'email' ? 'none' : 'words'}
                />
                {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
              </View>
            ))}

            {/* Sauvegarder dans les contacts */}
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setSaveToPhone(!saveToPhone)}
            >
              <Ionicons
                name={saveToPhone ? 'checkbox' : 'square-outline'}
                size={22}
                color={colors.button.primary}
              />
              <Text style={styles.checkLabel}>Enregistrer dans les contacts téléphone</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
                onPress={() => setShowNewCustomerForm(false)}
              >
                <Text style={{ color: '#64748B' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.button.primary }]}
                onPress={handleSaveCustomer}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );

  // ── Rendu step "date" ────────────────────────────────────────────────────────

  const renderDateStep = () => (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>

      {/* Client sélectionné (résumé) */}
      {selectedCustomer && (
        <View style={styles.selectedCard}>
          <Ionicons name="person-circle-outline" size={32} color={colors.button.primary} />
          <View>
            <Text style={styles.selectedName}>{selectedCustomer.name}</Text>
            <Text style={styles.selectedPhone}>{selectedCustomer.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => setStep('customer')} style={{ marginLeft: 'auto' }}>
            <Text style={{ color: colors.button.primary, fontSize: 13 }}>Changer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Date de livraison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date de livraison</Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.button.primary} />
          <Text style={styles.dateBtnText}>{formatDate(deliveryDate)}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={deliveryDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setDeliveryDate(date);
            }}
          />
        )}
      </View>

      {/* Heure de livraison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Heure de livraison</Text>
        <View style={styles.timeSlots}>
          {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.timeSlot,
                deliveryTime === t && { backgroundColor: colors.button.primary, borderColor: colors.button.primary },
              ]}
              onPress={() => setDeliveryTime(t)}
            >
              <Text style={[styles.timeSlotText, deliveryTime === t && { color: '#fff' }]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Note */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Note (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Instructions de livraison..."
          multiline
          numberOfLines={3}
        />
      </View>
    </ScrollView>
  );

  // ── Rendu step "summary" ─────────────────────────────────────────────────────

  const renderSummaryStep = () => (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>

      {/* Client */}
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryBlockTitle}>Client</Text>
        <Text style={styles.summaryValue}>{selectedCustomer?.name}</Text>
        <Text style={styles.summarySubValue}>{selectedCustomer?.phone}</Text>
        {selectedCustomer?.address && (
          <Text style={styles.summarySubValue}>{selectedCustomer.address}</Text>
        )}
      </View>

      {/* Livraison */}
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryBlockTitle}>Livraison</Text>
        <Text style={styles.summaryValue}>{formatDate(deliveryDate)} à {deliveryTime}</Text>
        {note && <Text style={styles.summarySubValue}>Note : {note}</Text>}
      </View>

      {/* Articles */}
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryBlockTitle}>Articles ({cartItems.length})</Text>
        {cartItems.map((item) => (
          <View key={item.id} style={styles.summaryItem}>
            <Text style={styles.summaryItemName} numberOfLines={1}>{item.product.name}</Text>
            <Text style={styles.summaryItemQty}>x{item.quantity}</Text>
            <Text style={styles.summaryItemPrice}>
              {((item.product.discount_price ?? item.product.price) * item.quantity).toLocaleString()}
            </Text>
          </View>
        ))}
        <View style={styles.summaryTotal}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalAmount}>{totalAmount.toLocaleString()}</Text>
        </View>
      </View>
    </ScrollView>
  );

  // ── Navigation entre steps ───────────────────────────────────────────────────

  const steps: CheckoutStep[] = ['customer', 'date', 'summary'];
  const stepIndex = steps.indexOf(step);

  const handleNext = () => {
    if (step === 'customer' && !selectedCustomer) {
      Alert.alert('Client requis', 'Veuillez sélectionner ou créer un client.');
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1]);
    }
  };

  const stepLabels = ['Client', 'Livraison', 'Résumé'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => stepIndex > 0 ? setStep(steps[stepIndex - 1]) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commande</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Stepper */}
      <View style={styles.stepper}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <View style={styles.stepperItem}>
              <View style={[
                styles.stepperDot,
                i <= stepIndex && { backgroundColor: '#4F46E5' },
              ]}>
                {i < stepIndex
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={styles.stepperDotText}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepperLabel, i === stepIndex && { color: '#4F46E5', fontWeight: '600' }]}>
                {stepLabels[i]}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepperLine, i < stepIndex && { backgroundColor: '#4F46E5' }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Contenu */}
      <View style={{ flex: 1 }}>
        {step === 'customer' && renderCustomerStep()}
        {step === 'date'     && renderDateStep()}
        {step === 'summary'  && renderSummaryStep()}
      </View>

      {/* Bouton action */}
      <View style={styles.footer}>
        {step !== 'summary' ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#4F46E5' }]}
            onPress={handleNext}
          >
            <Text style={styles.actionBtnText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isPlacing ? '#94A3B8' : '#4F46E5' }]}
            onPress={handlePlaceOrder}
            disabled={isPlacing}
          >
            {isPlacing
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Confirmer la commande</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle:    { fontSize: 17, fontWeight: '700', color: '#1E293B' },

  // Stepper
  stepper:        { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  stepperItem:    { alignItems: 'center', gap: 4 },
  stepperDot:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  stepperDotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepperLabel:   { fontSize: 11, color: '#94A3B8' },
  stepperLine:    { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 4, marginBottom: 18 },

  // Tabs
  tabs:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText:        { fontSize: 13, color: '#94A3B8' },

  // Search
  searchBar:      { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 10, height: 40, gap: 8 },
  searchInput:    { flex: 1, fontSize: 14, color: '#1E293B' },

  // Customer item
  customerItem:   { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 12, marginBottom: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', gap: 12 },
  customerAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  customerAvatarText: { fontSize: 18, fontWeight: '700' },
  customerName:   { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  customerPhone:  { fontSize: 13, color: '#64748B' },
  customerEmail:  { fontSize: 12, color: '#94A3B8' },

  emptyText:      { textAlign: 'center', color: '#94A3B8', marginTop: 32 },

  addCustomerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' },
  addCustomerText: { fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  modalTitle:     { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  fieldWrapper:   { gap: 4 },
  fieldLabel:     { fontSize: 12, fontWeight: '600', color: '#64748B' },
  input:          { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B' },
  inputError:     { borderColor: '#EF4444' },
  noteInput:      { height: 80, textAlignVertical: 'top' },
  errorText:      { color: '#EF4444', fontSize: 12 },
  checkRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkLabel:     { fontSize: 13, color: '#475569', flex: 1 },
  modalActions:   { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn:       { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },

  // Date step
  section:        { gap: 10 },
  sectionTitle:   { fontSize: 14, fontWeight: '600', color: '#475569' },
  dateBtn:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  dateBtnText:    { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  timeSlots:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeSlot:       { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0' },
  timeSlotText:   { fontSize: 14, color: '#475569' },

  // Selected card
  selectedCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  selectedName:   { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  selectedPhone:  { fontSize: 13, color: '#64748B' },

  // Summary
  summaryBlock:        { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, gap: 6 },
  summaryBlockTitle:   { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  summaryValue:        { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  summarySubValue:     { fontSize: 13, color: '#64748B' },
  summaryItem:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryItemName:     { flex: 1, fontSize: 13, color: '#475569' },
  summaryItemQty:      { fontSize: 13, color: '#94A3B8' },
  summaryItemPrice:    { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  summaryTotal:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  summaryTotalLabel:   { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  summaryTotalAmount:  { fontSize: 16, fontWeight: '700', color: '#4F46E5' },

  // Footer
  footer:         { padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14 },
  actionBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default CheckoutScreen;