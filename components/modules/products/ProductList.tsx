import { ThemedText } from "@/components/ThemedText";
import React, { memo, useCallback, useMemo } from "react";
import { ThemedView } from "@/components/ThemedView";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useThemeColors, useThemeTypography } from "@/theme";
import ProductCard from "./ProductCard";
import Skeleton from "@/components/skeletonPlaceholder";
import { Ionicons } from "@expo/vector-icons";
import { useProducts } from "@/context/ProductContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  refreshTrigger?:   number;
  globalRefreshing?: boolean;
  onLoadStart?:      () => void;
  onLoadEnd?:        () => void;
};

// ─── Sous-composants mémoïsés ─────────────────────────────────────────────────

// Bannière collante en haut : hors ligne ou données en cache
const StatusBanner = memo(
  ({
    apiStatus,
    isFromCache,
    cacheAgeMinutes,
    colors,
  }: {
    apiStatus:       'online' | 'offline' | 'unknown';
    isFromCache:     boolean;
    cacheAgeMinutes: number | null;
    colors:          any;
  }) => {
    if (apiStatus === 'online' && !isFromCache) return null;

    const isOffline = apiStatus === 'offline';

    return (
      <View style={bannerStyles.wrapper}>
        <View
          style={[
            bannerStyles.banner,
            { backgroundColor: isOffline ? '#1C1C1E' : '#2563EB' },
          ]}
        >
          {isOffline && (
            <ActivityIndicator size="small" color="#fff" />
          )}
          <Ionicons
            name={isOffline ? 'cloud-offline-outline' : 'archive-outline'}
            size={14}
            color="#fff"
          />
          <Text style={bannerStyles.text}>
            {isOffline
              ? 'Hors ligne — reconnexion en cours...'
              : cacheAgeMinutes !== null
              ? `Cache · mis à jour il y a ${cacheAgeMinutes} min`
              : 'Données en cache'}
          </Text>
        </View>
      </View>
    );
  }
);

// Footer de la liste (skeleton + bannière offline)
const FooterComponent = memo(
  ({
    hasMore,
    loading,
    apiStatus,
  }: {
    hasMore:   boolean;
    loading:   boolean;
    apiStatus: 'online' | 'offline' | 'unknown';
  }) => {
    if (!hasMore && apiStatus !== 'offline') return null;

    return (
      <View>
        {hasMore && (
          <Skeleton.Products itemCount={2} isHorizontal={false} />
        )}
      </View>
    );
  }
);

// Composant liste vide
const EmptyComponent = memo(() => <></>);

// ─── Composant principal ──────────────────────────────────────────────────────

const ProductList = ({
  refreshTrigger,
  globalRefreshing = false,
  onLoadStart,
  onLoadEnd,
}: Props) => {
  const {
    products,
    loading,
    hasMore,
    refreshing,
    handleRefresh,
    handleLoadMore,
    apiStatus,
    isFromCache,
    cacheAgeMinutes,
  } = useProducts();

  const colors     = useThemeColors();
  const typography = useThemeTypography();
  const styles     = useMemo(() => createStyles(colors, typography), [colors, typography]);

  console.log('[ProductList] produits:', products.length, '| fromCache:', isFromCache, '| status:', apiStatus);

  const COLUMN_WRAPPER_STYLE: ViewStyle = {
    justifyContent: 'space-between',
    marginBottom: 20,
  };

  const handleRefreshWithCallbacks = useCallback(() => {
    if (!globalRefreshing) {
      onLoadStart?.();
      handleRefresh();
      onLoadEnd?.();
    }
  }, [handleRefresh, globalRefreshing, onLoadStart, onLoadEnd]);

  const renderFooter = useCallback(
    () => (
      <FooterComponent
        hasMore={hasMore}
        loading={loading}
        apiStatus={apiStatus}
      />
    ),
    [hasMore, loading, apiStatus]
  );

  const renderEmpty = useCallback(() => {
    if (loading && products.length === 0) return null;
    return <EmptyComponent />;
  }, [loading, products.length]);

  return (
    <ThemedView>
      {/* Bannière de statut (hors ligne / cache) */}
      <StatusBanner
        apiStatus={apiStatus}
        isFromCache={isFromCache}
        cacheAgeMinutes={cacheAgeMinutes}
        colors={colors}
      />

      <View style={styles.titleWrapper}>
        <Text style={styles.title}>For you</Text>
        <Pressable style={styles.titleBtnWrapper}>
          <ThemedText style={styles.titleBtn}>See All</ThemedText>
          <Ionicons name="arrow-forward-outline" />
        </Pressable>
      </View>

      {loading && products.length === 0 ? (
        // Premier chargement → skeleton
        <Skeleton.Products itemCount={4} isHorizontal={false} />
      ) : (
        <FlatList
          numColumns={2}
          data={products}
          columnWrapperStyle={COLUMN_WRAPPER_STYLE}
          keyExtractor={(item) => String(item.slug)}
          renderItem={({ item, index }) => (
            <ProductCard item={item} index={index} />
          )}
          contentContainerStyle={styles.listContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshing={globalRefreshing || refreshing}
          onRefresh={handleRefreshWithCallbacks}
          initialNumToRender={4}
          maxToRenderPerBatch={8}
          windowSize={5}
          scrollEnabled={!globalRefreshing}
        />
      )}
    </ThemedView>
  );
};

// ─── Styles bannière (statiques) ──────────────────────────────────────────────

const bannerStyles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

// ─── Styles principaux ────────────────────────────────────────────────────────

const createStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    titleWrapper: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      marginHorizontal: 18,
    },
    title: {
      ...typography.h4,
      color: colors.text.primary,
    },
    titleBtn: {
      ...typography.h5,
      color: colors.text.primary,
    },
    titleBtnWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    listContainer: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    footerLoader: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 10,
    },
    emptyContainer: {
      padding: 20,
      alignItems: 'center',
    },
    emptyText: {
      ...typography.body1,
      color: colors.text.secondary,
    },
  });

export default ProductList;