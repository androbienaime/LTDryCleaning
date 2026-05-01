import React, { useState } from 'react';
import { AppRegistry, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProductProvider } from './context/ProductContext';
import RootNavigator from './navigation/RootNavigator';
import MultiAccountProvider, { useMultiAccount } from './context/MultiAccountContext';
import PinEntryScreen from './screens/PinEntryScreen';
import LoginScreen from './screens/auth/LoginScreen'; // ← import direct
import OfflineProvider from './context/OfflineContext';

enableScreens();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#007AFF',
    background: '#F9F9F9',
    card: '#FFFFFF',
    text: '#000000',
    border: '#E0E0E0',
    notification: '#FF3B30',
  },
};

const linking = {
  prefixes: ['myecommerce://', 'https://myecommerce.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Shop: {
            screens: {
              Home: 'home',
              Category: 'category/:categoryId',
              ProductDetails: 'product/:productId',
              Search: 'search',
            },
          },
          Cart: {
            screens: {
              Cart: 'cart',
              Checkout: 'checkout',
              OrderConfirmation: 'order/:orderId',
            },
          },
          Profile: {
            screens: {
              Profile: 'profile',
              OrderHistory: 'orders',
              OrderDetails: 'order/:orderId',
              EditProfile: 'profile/edit',
              AddressBook: 'addresses',
              AddAddress: 'address/add',
              EditAddress: 'address/:addressId',
              PaymentMethods: 'payments',
              Settings: 'settings',
              AccountManagement: 'accountmanagement',
              AddAccount: 'users/add',
            },
          },
        },
      },
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
        },
      },
      ProductModal: 'modal/product/:productId',
    },
  },
};

// ─── Styles partagés ──────────────────────────────────────────────────────────

const gateStyles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});

// ─── AppGate ──────────────────────────────────────────────────────────────────
//
//  Système à 3 états hermétiques :
//
//  'pin'      → PinEntryScreen affiché, RIEN d'autre n'est monté
//  'password' → LoginScreen affiché en direct (hors NavigationContainer),
//               RIEN d'autre n'est monté → 0 risque d'accès aux autres écrans
//  'unlocked' → NavigationContainer + RootNavigator montés normalement
//
//  Le NavigationContainer (et donc toute la navigation) n'est JAMAIS monté
//  tant que l'utilisateur n'est pas authentifié. Il est physiquement
//  impossible d'accéder à un autre écran.

const AppGate = () => {
  const { isLoading, accounts } = useMultiAccount();

  // 'pin' | 'password' | 'unlocked'
  const [gateState, setGateState] = useState('pin');

  // ── Chargement initial ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={gateStyles.loader}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // ── Premier lancement : aucun compte → accès direct ───────────────────────
  if (accounts.length === 0 || gateState === 'unlocked') {
    return (
      <NavigationContainer linking={linking} theme={MyTheme}>
        <RootNavigator />
      </NavigationContainer>
    );
  }

  // ── État PIN ──────────────────────────────────────────────────────────────
  // NavigationContainer PAS monté → impossible d'accéder à quoi que ce soit
  if (gateState === 'pin') {
    return (
      <PinEntryScreen
        // PIN correct → accès immédiat et total à l'app
        onSuccess={() => setGateState('unlocked')}
        // Préfère le mot de passe → bascule vers Login isolé
        onUsePassword={() => setGateState('password')}
      />
    );
  }

  // ── État PASSWORD ─────────────────────────────────────────────────────────
  // LoginScreen rendu DIRECTEMENT, hors NavigationContainer.
  // L'utilisateur ne voit QUE cet écran.
  // Retour arrière → retour au PIN (jamais vers l'app).
  if (gateState === 'password') {    
    return (
      <LoginScreen
        // Connexion réussie → déverrouillage total
        onLoginSuccess={() => setGateState('unlocked')}
        // Retour → retour au PIN, jamais vers l'app
        onBack={() => setGateState('pin')}
        // Désactive la navigation interne de LoginScreen
        // car on est hors NavigationContainer ici
        // standalone
      />
    );
  }

  return null;
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <MultiAccountProvider>
        <AuthProvider>
          <OfflineProvider>
            <ProductProvider>
              <CartProvider>
                {/*
                  AppGate gère lui-même le NavigationContainer.
                  Il ne le monte QUE quand gateState === 'unlocked'.
                */}
                <AppGate />
              </CartProvider>
            </ProductProvider>
          </OfflineProvider>
        </AuthProvider>
      </MultiAccountProvider>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('main', () => App);