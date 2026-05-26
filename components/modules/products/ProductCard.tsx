import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ShopStackParamList } from "@/src/@types/navigation";

import { Product } from "@/src/@types/models";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColors, useThemeTypography } from "@/theme";

type Props = {
  item: Product;
  index: number;
};

const width = Dimensions.get("window").width - 40;

const ProductCard = ({ item, index }: Props) => {
  const colors = useThemeColors();
  const typography = useThemeTypography();

  const navigation =
    useNavigation<NativeStackNavigationProp<ShopStackParamList>>();

  const styles = useMemo(
    () => createStyles(colors, typography),
    [colors, typography]
  );

  const handleProductDetails = () => {
    navigation.navigate("ProductDetails", { product: item });
  };

  const sources = [
    item.coverImageLocal,
    item.coverImage,
    "https://placehold.co/600x400",
  ].filter(Boolean);

  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <Pressable onPress={handleProductDetails}>
      <Animated.View
        style={styles.container}
        entering={FadeInDown.delay(300 + index * 100).duration(500)}
      >
        {/* Product Image */}
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: sources[currentIndex] }}
            style={styles.productImg}
            onError={() => {
              if (currentIndex < sources.length - 1) {
                setCurrentIndex(currentIndex + 1);
              }
            }}
          />

          {/* Soft overlay */}
          {/* <View style={styles.overlay} /> */}
        </View>

        {/* Product Info */}
        <ThemedView style={styles.content}>
          <View style={styles.productInfo}>
            <Text style={styles.price}>
              {item.currency.symbol} {Number(item.price).toFixed(2)}
            </Text>

            {/* Modern rectangle badge */}
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
            </View>
          </View>

          <ThemedView style={styles.productFooter}>
            <ThemedText
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.title}
            >
              {item.name}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Animated.View>
    </Pressable>
  );
};

export default ProductCard;

const createStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    container: {
      width: width / 3.1,
      height: 210,
      marginHorizontal: 5,
      borderRadius: 20,
      overflow: "hidden",

      backgroundColor: colors.background.white,

      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.08,
      shadowRadius: 10,

      elevation: 4,
    },

    imageWrapper: {
      position: "relative",
    },

    productImg: {
      width: "100%",
      height: 120,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },

    overlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,

      backgroundColor: "rgba(0,0,0,0.08)",
    },

    content: {
      flex: 1,
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 12,

      backgroundColor: colors.background.white,
    },

    productInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",

      marginBottom: 8,
    },

    price: {
      ...typography.h5,
      color: colors.text.primary,
      fontWeight: "700",
    },

    productFooter: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "space-between",
    },

    title: {
      ...typography.h6,
      color: colors.text.primary,
      lineHeight: 18,
      opacity: 0.85,
    },

    /* Modern rectangle instead of cart */
    badge: {
      width: 34,
      height: 20,
      borderRadius: 8,

      backgroundColor: "rgba(0,0,0,0.05)",

      justifyContent: "center",
      alignItems: "center",
    },

    badgeDot: {
      width: 14,
      height: 4,
      borderRadius: 10,

      backgroundColor: colors.button.primary,
      opacity: 0.7,
    },
  });