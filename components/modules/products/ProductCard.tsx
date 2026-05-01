import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View, Image } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ShopStackParamList } from "@/src/@types/navigation";

import { Product } from "@/src/@types/models";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { typography, useThemeColors, useThemeTypography } from "@/theme";

type Props = {
  item: Product;
  index: number;
};

const width = Dimensions.get("window").width - 40;

const ProductCard = ({ item, index }: Props) => {
  const colors = useThemeColors();
  const typography = useThemeTypography();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();

  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

  const handleProductDetails = () =>{
    navigation.navigate("ProductDetails", {product: item});
  }

  const sources = [
    item.coverImageLocal,
    item.coverImage,
    "https://placehold.co/600x400"
  ].filter(Boolean);

  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <Pressable onPress={handleProductDetails}>
      <Animated.View
        style={[styles.container, { backgroundColor: colors.background.white}]}
        entering={FadeInDown.delay(300 + index * 100).duration(500)}
      >
        {/* Product Image */}
       <Image
          source={{ uri: sources[currentIndex] }}
          style={styles.productImg}
          onError={() => {
            if (currentIndex < sources.length - 1) {
              setCurrentIndex(currentIndex + 1);
            }
          }}
        />

        {/* Profile in corner */}
        <Pressable style={styles.profileContainer}>
          <ThemedView style={styles.profile}>
            <Image source={require('@/assets/images/10.jpg')} style={styles.imgProfile} />
            <Pressable onPress={() => console.log('Close pressed')} style={styles.closeBtn}>
              <Ionicons name="add-sharp" size={14} color={colors.button.secondary} />
            </Pressable>
          </ThemedView>
        </Pressable>

        {/* Like icon */}
        <Pressable style={styles.bookmark}>
          <Ionicons name="heart-outline" size={22} color={colors.button.primary} />
        </Pressable>

        {/* Product Info */}
        <ThemedView style={{ padding: 5, backgroundColor: "#fff" }}>
          <View style={styles.productInfo}>
            <Text style={[styles.price, { color: colors.text.primary }]}>${item.price}</Text>
            <View style={styles.ratingWrapper}>
              <Ionicons name="star" size={20} color={"#D4AF34"} />
              <Text style={[styles.rating, { color: colors.text.secondary }]}>4.7</Text>
            </View>
          </View>
          <ThemedView style={styles.productFooter} >
            <ThemedText numberOfLines={2} ellipsizeMode="tail" style={[styles.title, { color: colors.text.primary }]}>{item.name}</ThemedText>
            <View style={styles.cartWrapper}>
              <Ionicons name="cart" size={20} color={colors.button.primary} />
            </View>
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
        width: width / 2,
        height: 284,
        marginHorizontal: 10,
        borderRadius: 14,
        overflow: "hidden",
    },
    productImg: {
        width: "100%",
        height: 185,
        borderTopEndRadius: 14,
        borderTopLeftRadius: 14,
        marginBottom: 10,
    },
    profileContainer: {
        position: "absolute",
        top: 0,
        right: 0,
        zIndex: 10,
    },
    profile: {
        width: 40,
        height: 40,
        borderRadius: 14,
        position: "relative",
        borderColor: colors.button.secondary,
        borderWidth:2
    },
    imgProfile: {
        width: "100%",
        height: "100%",
        borderRadius: 25
    },
    closeBtn: {
        position: 'absolute',
        bottom: -10, // fait dépasser en dessous
        left: '50%',
        marginLeft: -9, // moitié de la taille (18 / 2)
        backgroundColor: colors.button.primary,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
        zIndex: 130,
    },
    
    bookmark: {
        position: "absolute",
        right: 5,
        top: 68,
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        padding: 5,
        borderRadius: 30,
        zIndex: 5,
    },
    title: {
        ...typography.h6
    },
    productInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    productFooter:{
      position: "relative",
      height: 50,
      backgroundColor: colors.background.white
    },
    price: {
       ...typography.h4,
    },
    ratingWrapper: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    rating: {
        fontSize: 14,
    },
    cartWrapper: {
        position: "absolute",
        bottom: 3,
        right: 3,
        flexDirection: "row",
        alignSelf: "flex-end",
    },
});
