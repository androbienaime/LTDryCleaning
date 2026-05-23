import { useAppSetup } from "@/context/AppSetupContext";
import { useThemeColors, useThemeTypography } from "@/theme";
import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Text, TouchableOpacity, View } from "react-native";

type Props = {
    totalAmount : number;
    itemCount: number;
    handleCheckout : () => void;
};


const CartSummary = ({totalAmount, itemCount, handleCheckout} : Props) =>{
    const { setupConfig } = useAppSetup();

    const colors = useThemeColors();
    const typography = useThemeTypography();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.summaryContainer, { borderTopColor: colors.border.default }]}>
            <View style={styles.summaryRow}>
                <Text style={[typography.body1, { color: colors.text.secondary }]}>Sous-total ({itemCount} articles)</Text>
                <Text style={[typography.h3]}>{totalAmount.toFixed(2)} {setupConfig.currency?.symbol} </Text>
            </View>
            
            <View style={styles.summaryRow}>
                <Text style={[typography.body1, { color: colors.text.secondary }]}>Livraison</Text>
                <Text style={[typography.h5]}>Calculée à l'étape suivante</Text>
            </View>
            
            <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={[typography.subtitle1]}>Total</Text>
                <Text style={[typography.h3]}>{totalAmount.toFixed(2)} {setupConfig.currency?.symbol} </Text>
            </View>
            
            <TouchableOpacity
                style={[styles.checkoutButton, { backgroundColor: colors.button.primary }]}
                onPress={handleCheckout}
            >
                <Text style={[typography.button, { color: colors.text.inverse }]}>
                Passer commande
                </Text>
            </TouchableOpacity>
        </View>
    )
}

export default CartSummary;

const createStyles = (colors: any) => 
    StyleSheet.create({
      summaryContainer: {
        padding: 16,
        borderTopWidth: 1,
        backgroundColor: "#FFFFFF",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        // marginBottom: 12,
      },
      totalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#EEEEEE",
      },
      checkoutButton: {
        marginTop: 16,
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: "center",
      },
    });