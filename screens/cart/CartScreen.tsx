import React, { useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import Header from "@/components/Header";
import { useThemeColors, useThemeTypography } from "@/theme";
import CartItem from "@/components/modules/cart/CartItem";
import { useCart } from "@/context/CartContext";
import { Ionicons } from "@expo/vector-icons";
import CartSummary from "@/components/modules/cart/CartSummary";

type CartScreenProps = { navigation: NativeStackNavigationProp<any> };

const CartScreen = ({ navigation }: CartScreenProps) => {
  const { cartItems, itemCount, totalAmount, loading, clearCart, removeItem } = useCart();
  const colors     = useThemeColors();
  const typography = useThemeTypography();
  const [refreshing,    setRefreshing]    = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  // item.id est maintenant une string ("42__base" ou "42__80")
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useFocusEffect(
    React.useCallback(() => {
      setSelectionMode(false);
      setSelectedItems([]);
      return () => {};
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert("Panier vide", "Ajoutez des produits avant de passer commande.");
      return;
    }
    navigation.navigate("Checkout");
  };

  const handleClearCart = () => {
    if (!cartItems.length) return;
    Alert.alert("Vider le panier", "Êtes-vous sûr de vouloir vider votre panier ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Vider", style: "destructive", onPress: () => { clearCart(); setSelectionMode(false); setSelectedItems([]); } },
    ]);
  };

  const toggleSelectionMode = () => { setSelectionMode(!selectionMode); setSelectedItems([]); };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const selectAllItems = () => {
    // item.id est déjà une string — pas besoin de toString()
    setSelectedItems(
      selectedItems.length === cartItems.length ? [] : cartItems.map(item => item.id)
    );
  };

  const removeSelectedItems = async () => {
    if (!selectedItems.length) return;
    Alert.alert(
      "Supprimer les éléments",
      `Supprimer ${selectedItems.length} élément(s) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            // item.id est une string — on passe directement sans parseInt
            for (const itemId of selectedItems) {
              await removeItem(itemId);
            }
            setSelectedItems([]);
            if (cartItems.length - selectedItems.length <= 0) setSelectionMode(false);
          },
        },
      ]
    );
  };

  const shareCart = () => {
    navigation.navigate("ShareCart", {
      selectedItems: selectionMode ? selectedItems : cartItems.map(item => item.id),
    });
  };

  // Nombre d'articles avec prix personnalisé
  const offerItemCount = cartItems.filter(item => item.offerPrice != null).length;

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cart" size={80} color={colors.text.secondary} />
      <Text style={[styles.emptyTitle, typography.h3]}>Votre panier est vide</Text>
      <Text style={[styles.emptyText, typography.body1, { color: colors.text.secondary }]}>
        Ajoutez des produits pour commencer vos achats
      </Text>
      <TouchableOpacity
        style={[styles.shopButton, { backgroundColor: colors.button.primary }]}
        onPress={() => navigation.navigate("Shop")}
      >
        <Text style={[styles.shopButtonText, typography.h3, { color: colors.text.inverse }]}>
          Découvrir les produits
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.button.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.white }]}>
      <ThemedView style={styles.container}>
        <Header
          previousButton={true}
          hideSearchBar={true}
          hideFilterIcon={true}
          hideWishlistIcon={true}
          title="Panier"
          backgroundColor={colors.background.white}
          inputBackground={colors.background.primary}
          style={styles.header}
          rightComponent={
            cartItems.length > 0 ? (
              <View style={styles.headerActions}>
                {selectionMode ? (
                  <>
                    <TouchableOpacity style={styles.headerButton} onPress={selectAllItems}>
                      <Text style={{ color: colors.text.tertiary }}>
                        {selectedItems.length === cartItems.length ? "Désélectionner tout" : "Tout sélectionner"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.headerButton}
                      onPress={removeSelectedItems}
                      disabled={selectedItems.length === 0}
                    >
                      <Text style={{ color: selectedItems.length > 0 ? colors.text.danger : colors.text.disabled }}>
                        Supprimer ({selectedItems.length})
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.headerButton} onPress={shareCart}>
                      <Ionicons name="share-outline" size={24} color={colors.text.tertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerButton} onPress={toggleSelectionMode}>
                      <Ionicons name="checkbox-outline" size={24} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : null
          }
        />

        {/* Bandeau "X prix personnalisé(s)" */}
        {offerItemCount > 0 && (
          <View style={[styles.offerBanner, { backgroundColor: colors.button.primary + '12', borderColor: colors.button.primary + '40' }]}>
            <Ionicons name="pricetag" size={13} color={colors.button.primary} />
            <Text style={[styles.offerBannerText, { color: colors.button.primary }]}>
              {offerItemCount} prix personnalisé{offerItemCount > 1 ? 's' : ''} appliqué{offerItemCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <FlatList
          data={cartItems}
          // item.id est une string — keyExtractor direct sans toString()
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CartItem
              item={item}
              selectionMode={selectionMode}
              isSelected={selectedItems.includes(item.id)}
              onToggleSelection={() => toggleItemSelection(item.id)}
            />
          )}
          ListEmptyComponent={renderEmptyCart}
          contentContainerStyle={cartItems.length === 0 ? { flex: 1 } : styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />

        {cartItems.length > 0 && (
          <View>
            {selectionMode && (
              <View style={styles.selectionActionsContainer}>
                <TouchableOpacity
                  style={[styles.selectionActionButton, { backgroundColor: colors.button.secondary }]}
                  onPress={toggleSelectionMode}
                >
                  <Text style={{ color: colors.text.tertiary }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectionActionButton, {
                    backgroundColor: selectedItems.length > 0 ? colors.button.error : colors.button.disabled,
                  }]}
                  onPress={removeSelectedItems}
                  disabled={selectedItems.length === 0}
                >
                  <Text style={{ color: colors.text.primary }}>
                    Supprimer ({selectedItems.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <CartSummary totalAmount={totalAmount} itemCount={itemCount} handleCheckout={handleCheckout} />
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container:       { flex: 1, backgroundColor: "#fff" },
    header:          { width: "100%", borderBottomWidth: 2, borderBottomColor: colors.background.primary },
    headerActions:   { flexDirection: "row", alignItems: "center" },
    headerButton:    { marginLeft: 16, padding: 4 },
    loadingContainer:{ flex: 1, justifyContent: "center", alignItems: "center" },
    listContent:     { paddingBottom: 16 },
    offerBanner:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1 },
    offerBannerText: { fontSize: 13, fontWeight: '600' },
    emptyContainer:  { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    emptyTitle:      { fontSize: 22, marginTop: 24, marginBottom: 8 },
    emptyText:       { textAlign: "center", marginBottom: 32 },
    shopButton:      { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    shopButtonText:  { fontSize: 16 },
    selectionActionsContainer: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderTopWidth: 1, borderTopColor: "#EEEEEE" },
    selectionActionButton:     { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 4 },
    summaryContainer:{ padding: 16, borderTopWidth: 1, backgroundColor: "#FFFFFF", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 3 },
    summaryRow:      { flexDirection: "row", justifyContent: "space-between" },
    totalRow:        { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEEEEE" },
    checkoutButton:  { marginTop: 16, paddingVertical: 16, borderRadius: 8, alignItems: "center" },
  });

export default CartScreen;