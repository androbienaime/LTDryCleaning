// types/navigations.ts

import { NavigatorScreenParams } from '@react-navigation/native';
import { Product } from './models';

// Paramètres pour les écrans d'authentification
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Paramètres pour la pile de navigation Shop
export type ShopStackParamList = {
  Home: undefined;
  Category: {
    categoryId: string;
    title: string;
  };
  ProductDetails: {
    product : Product;
  };
  Search: {
    query?: string;
  };
};

// Paramètres pour la pile de navigation Cart
export type CartStackParamList = {
  Cart: undefined;
  Checkout: {
    fromCart?: boolean;
  };
  OrderConfirmation: {
    orderId: string;
  };
  OrderHistory: undefined;
};

// Paramètres pour la pile de navigation Profile
export type ProfileStackParamList = {
  Profile: undefined;
  OrderHistory: undefined;
  AccountManagement: undefined;
  OrderDetails: {
    orderId: string;
  };
  EditProfile: undefined;
  AddressBook: undefined;
  AddAddress: undefined;
  EditAddress: {
    addressId: string;
  };
  PaymentMethods: undefined;
  Settings: undefined;
};

// Paramètres pour les onglets principaux
export type MainTabParamList = {
  Shop: NavigatorScreenParams<ShopStackParamList>;
  Categories: undefined;
  Chat: undefined;
  CartStack: NavigatorScreenParams<CartStackParamList>;
  ProfileStack: NavigatorScreenParams<ProfileStackParamList>;
};

// Paramètres pour la racine de navigation
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  ProductModal: {
    productId: string;
  };
};

// Type d'utilité pour accéder aux paramètres de route dans les composants
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}