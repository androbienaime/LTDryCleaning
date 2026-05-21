import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ProfileStackParamList } from "@/src/@types/navigation";
import { useAppSetup } from "@/context/AppSetupContext";
import { useAuth } from "@/context/AuthContext";

type Props = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  color: [string, string, ...string[]];
  onPress?: () => void;
};

const Card = ({ icon, title, subtitle, color, onPress }: Props) => {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <LinearGradient colors={color} style={styles.card}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { setupConfig } = useAppSetup();
  const { isSuperAdmin } = useAuth();


  const handleAccountManagement = () => {
    navigation.navigate("AccountManagement");
  };

  const handleSystemSettings = () => {
      navigation.navigate('Settings')
  };

  const handleOrderHistory = () => {
      navigation.navigate('OrderHistory')
  };
  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >

      {/* Cards */}
      { isSuperAdmin(setupConfig.shopId ?? '') ? (
        <Card
          onPress={handleSystemSettings}
          title="PARAMÈTRES SYSTÈME GLOBALES"
          color={["#00c6ff", "#0072ff"]}
          icon={<Ionicons name="settings" size={28} color="#fff" />}
        />
      ) : (
        <></>
      )}

      <Card
        onPress = {handleAccountManagement}
        title="Gérer les Utilisateurs"
        subtitle="Nouveaux Rôles Disponibles"
        color={["#4facfe", "#00f2fe"]}
        icon={<MaterialIcons name="vpn-key" size={28} color="#fff" />}
      />

      <Card
        title="ORDER HISTORY & ANALYTICS"
        color={["#00c6ff", "#0072ff"]}
        icon={<Ionicons name="settings" size={28} color="#fff" />}
        onPress={handleOrderHistory}
      />

      <Card
        title="Rapports & Audit"
        color={["#a18cd1", "#fbc2eb"]}
        icon={<Ionicons name="document-text" size={28} color="#fff" />}
      />

      <Card
        title="Configuration des Imprimantes"
        color={["#667eea", "#764ba2"]}
        icon={<Ionicons name="print" size={28} color="#fff" />}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    // justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  gear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    color: "#e0e0e0",
    fontSize: 12,
    marginTop: 4,
  },
});



export default ProfileScreen;
