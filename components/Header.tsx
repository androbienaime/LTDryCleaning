import React, { useMemo } from "react";
import { ThemedView } from "./ThemedView";
import { StyleSheet, TouchableOpacity, ViewStyle, View, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typography, useThemeColors } from "@/theme";
import SearchProductComponent from "./modules/products/SearchProductComponent";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { CartStackParamList, RootStackParamList } from "@/src/@types/navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import useCart from "@/hooks/useCart";

type Props = {
  backgroundColor?: string;
  inputBackground?: string;
  previousButton?: boolean;
  style?: ViewStyle;
  rightComponent?: React.ReactNode;
  hideSearchBar?: boolean;
  hideFilterIcon?: boolean;
  hideWishlistIcon?: boolean;
  hideCartIcon?: boolean;
  title?: string;
};

const Header = ({
  backgroundColor = "",
  inputBackground = "",
  previousButton = false,
  style,
  rightComponent,
  hideSearchBar = false,
  hideFilterIcon = false,
  hideWishlistIcon = false,
  hideCartIcon = true,
  title = "",
  ...otherProps
}: Props) => {
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const navigations = useNavigation<NavigationProp<RootStackParamList>>();

  const {itemCount} = useCart();

  const styles = useMemo(
    () => createStyles(colors, typography, backgroundColor),
    [colors, typography, backgroundColor]
  );

 const handleCart = () => {
  navigations.navigate("Main", {
    screen: "CartStack",   // ✅ nom du tab dans MainTabParamList
    params: {
      screen: "Cart"       // ✅ nom de l'écran dans CartStackParamList
    }
  });
};

  return (
    <ThemedView style={[styles.header, style]} {...otherProps}>
      <View style={styles.leftSection}>
        {previousButton && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={colors.button.primary} />
          </TouchableOpacity>
        )}
        
        {title ? (
          <Text style={styles.titleText}>{title}</Text>
        ) : null}
      </View>

      {!hideSearchBar && (
        <ThemedView style={styles.searchWrapper}>
          <SearchProductComponent backgroundColor={inputBackground} />
        </ThemedView>
      )}

      <View style={styles.rightSection}>
        {rightComponent ? (
          rightComponent
        ) : (
          <>
            {!hideFilterIcon && (
              <TouchableOpacity style={styles.iconButtons} onPress={() => console.log("Filter")}>
                <Ionicons name="filter-outline" size={28} color={colors.button.primary} />
              </TouchableOpacity>
            )}

              {!hideCartIcon && (
              <TouchableOpacity style={styles.iconButtons} onPress={handleCart}>
                <View>
                  <Ionicons name="cart-outline" size={28} color={colors.button.primary} />
                  {itemCount > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {itemCount > 99 ? '99+' : itemCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {!hideWishlistIcon && (
              <TouchableOpacity style={styles.iconButtons} onPress={() => console.log("Wishlist")}>
                <Ionicons name="heart-outline" size={28} color={colors.button.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ThemedView>
  );
};

const createStyles = (colors: any, typography: any, backgroundColor: string) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: backgroundColor,
      justifyContent: "space-between"
      // ...Platform.select({
      //   ios: {
      //     shadowColor: '#000',
      //     shadowOffset: { width: 0, height: 2 },
      //     shadowOpacity: 0.1,
      //     shadowRadius: 3,
      //   },
      //   android: {
      //     elevation: 4,
      //   },
      // }),
      // borderBottomWidth: 1,
      // borderBottomColor: colors.border?.light || '#EEEEEE',
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    searchWrapper: {
      flex: 1,
      marginHorizontal: 10,
      backgroundColor: backgroundColor,
    },
    iconButtons: {
      marginLeft: 8,
      padding: 4,
    },
    backButton: {
      padding: 4,
      marginRight: 4,
    },
    titleText: {
      ...typography.h3, 
      color: colors.text?.primary || '#000000',
      fontWeight: '600',
    },
    badgeContainer: {
      position: 'absolute',
      top: -5,
      right: -8,
      backgroundColor: colors.error?.primary || 'red',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    }
  });

export default Header;