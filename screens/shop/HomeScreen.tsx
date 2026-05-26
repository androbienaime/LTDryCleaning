// screens/HomeScreen.tsx
import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/theme";
import { ThemedView } from "@/components/ThemedView";
import ProductList from "@/components/modules/products/ProductList";
import CategoriesList from "@/components/modules/categories/CategoriesList";
import HomeSlider from "@/components/HomeSlider";
import ProductFeatured from "@/components/modules/products/ProductFeatured";
import Header from "@/components/Header";
import { LoadingProvider } from "@/context/LoadingContext";
import LoadingOverlay from "@/components/forms/LoadingOverlay";
import { ProductProvider, useProducts } from "@/context/ProductContext";
import { useAuth } from "@/context/AuthContext";
import { useAppSetup } from "@/context/AppSetupContext";

// ─── HomeContent ──────────────────────────────────────────────────────────────
// Séparé de HomeScreen pour pouvoir accéder à useProducts() qui vit dans
// ProductProvider. C'est lui qui possède l'unique FlatList scrollable.

const HomeContent = () => {
  const colors = useThemeColors();

  // ✅ refreshing et handleRefresh viennent DIRECTEMENT de ProductContext.
  // Plus de setTimeout fake — le spinner reste jusqu'à la fin du vrai fetch.
  const { refreshing, handleRefresh } = useProducts();

  const { hasPermission } = useAuth();
  const { setupConfig }   = useAppSetup();
  const shopId            = setupConfig.shopId ?? '';

  const [globalLoading,   setGlobalLoading]   = useState(false);
  // refreshTrigger sert uniquement à signaler à ProductFeatured de se recharger
  const [refreshTrigger,  setRefreshTrigger]  = useState(0);

  const showGlobalLoading = useCallback(() => setGlobalLoading(true),  []);
  const hideGlobalLoading = useCallback(() => setGlobalLoading(false), []);

  // ✅ onRefresh : appelle handleRefresh() (vrai reload) + incrémente trigger
  const onRefresh = useCallback(() => {
    handleRefresh();
    setRefreshTrigger((prev) => prev + 1);
  }, [handleRefresh]);

  return (
    <>
      <FlatList
        data={[1]}                         // dummy — le vrai contenu est dans renderItem
        keyExtractor={() => 'home-section'}
        // ── Pull-to-refresh ─────────────────────────────────────────────────
        // refreshing vient de ProductContext : spinner actif pendant le vrai fetch
        refreshing={refreshing}
        onRefresh={onRefresh}
        // ── Slider au-dessus du contenu ─────────────────────────────────────
        ListHeaderComponent={() => (
          <View>
            {/* <HomeSlider style={{ marginLeft: 18 }} /> */}
          </View>
        )}
        renderItem={() => (
          <View>
            {/* <ProductFeatured
              refreshTrigger={refreshTrigger}
              onLoadStart={showGlobalLoading}
              onLoadEnd={hideGlobalLoading}
            /> */}
            {hasPermission(shopId, 'view_any_core::product') ? (
              <ProductList
                refreshTrigger={refreshTrigger}
                globalRefreshing={refreshing}
                onLoadStart={showGlobalLoading}
                onLoadEnd={hideGlobalLoading}
              />
            ) : (
              <Text style={[styles.noPermission, { color: colors.text.primary }]}>
                You don't have permission to view products.
              </Text>
            )}
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 190 }}
      />
      {/* <LoadingOverlay visible={globalLoading} /> */}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HomeScreen
// ═══════════════════════════════════════════════════════════════════════════════

const HomeScreen = () => {
  const colors = useThemeColors();

  return (
    <LoadingProvider>
      <SafeAreaView style={{ backgroundColor: colors.background.primary, flex: 1 }}>
        <ThemedView style={{ flex: 1 }}>

          {/* ── FIXE — ne scroll pas ──────────────────────────────────────── */}
          <Header />
          {/* <CategoriesList /> */}

          {/* ── SCROLLABLE — ProductProvider doit envelopper HomeContent
               pour que celui-ci puisse accéder à useProducts() ────────────── */}
          <ProductProvider initialLimit={6}>
            <HomeContent />
          </ProductProvider>

        </ThemedView>
      </SafeAreaView>
    </LoadingProvider>
  );
};

const styles = StyleSheet.create({
  noPermission: {
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 18,
  },
});

export default HomeScreen;