import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeColors } from "@/theme";
import { ThemedView } from "@/components/ThemedView";
import ProductList from "@/components/modules/products/ProductList";
import CategoriesList from "@/components/modules/categories/CategoriesList";
import HomeSlider from "@/components/HomeSlider";
import ProductFeatured from "@/components/modules/products/ProductFeatured";
import Header from "@/components/Header";
import { FlatList } from "react-native";
import { LoadingProvider } from "@/context/LoadingContext";
import LoadingOverlay from "@/components/forms/LoadingOverlay";
import { ProductProvider, useProducts } from "@/context/ProductContext";
import { useAuth } from "@/context/AuthContext";
import { useAppSetup } from "@/context/AppSetupContext";

//  export const resetStorage = async () => {
//   await AsyncStorage.clear();
//   console.log('Storage reset: all data cleared.');
//   };

const HomeScreen = () => {
//  resetStorage(); // 🔥 Supprimer ou commenter après test
  const colors = useThemeColors();

  // t
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [globalLoading, setGlobalLoading] = useState(false);
  const { hasPermission } = useAuth();
  const { setupConfig } = useAppSetup();


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTrigger(prev => prev + 1); // 🔁 Incrémente pour signaler un refresh

    // Simule une requête API ou un rechargement
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);
  
  // Méthodes pour contrôler l'overlay de chargement global
  const showGlobalLoading = useCallback(() => {
    setGlobalLoading(true);
  }, []);

  const hideGlobalLoading = useCallback(() => {
    setGlobalLoading(false);
  }, []);

  const shopId: string = setupConfig.shopId || '';

  return (
    <LoadingProvider>
      <SafeAreaView style={{ backgroundColor: colors.background.primary, flex: 1 }}>
        <ThemedView>
          <Header />
          {/* <CategoriesList /> */}
          <ProductProvider initialLimit={6}>
            <FlatList
              data={[1]} // dummy item
              keyExtractor={() => "home-section"}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={() => (

                 /*   <View>
                      <ProductFeatured 
                    refreshTrigger={refreshTrigger}
                    onLoadStart={showGlobalLoading}
                    onLoadEnd={hideGlobalLoading}
                  /> 
                </View>
                */

                <View>
                  {
                    hasPermission(shopId, 'view_any_core::product') ? (
                      <ProductList
                        refreshTrigger={refreshTrigger}
                        globalRefreshing={refreshing}
                        // onLoadStart={showGlobalLoading}
                        // onLoadEnd={hideGlobalLoading}
                      />
                    ) : (
                      <Text
                        style={{
                          color: colors.text.primary,
                          textAlign: 'center',
                          marginTop: 20,
                        }}
                      >
                        You don't have permission to view products.
                      </Text>
                    )
                }
                </View>
              )}
              ListHeaderComponent={() => (
                <View>
                   {/* <HomeSlider style={{ marginLeft: 18 }} />  */}
                </View>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 190 }} // ajuste selon la tab bar
            />
          </ProductProvider>
          
          {/* Overlay de chargement global */}
          {/* <LoadingOverlay visible={globalLoading} /> */}
          
        </ThemedView>
      </SafeAreaView>
    </LoadingProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 18,
  }
});

export default HomeScreen;