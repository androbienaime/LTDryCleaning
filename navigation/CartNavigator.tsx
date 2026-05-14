// navigation/CartNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CartStackParamList } from '../src/@types/navigation';
import CartScreen from '@/screens/cart/CartScreen';
import CheckoutScreen from '@/screens/cart/CheckoutScreen';
import OrderConfirmationScreen from '@/screens/cart/OrderConfirmationScreen';

const CartStack = createNativeStackNavigator<CartStackParamList>();

const CartStackNavigator: React.FC = () => {
  return (
    <CartStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        headerBackVisible: false,
      }}
    >
      <CartStack.Screen name="Cart" component={CartScreen} options={{ title: 'Panier' }} />
      <CartStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Paiement' }} />
      <CartStack.Screen 
        name="OrderConfirmation" 
        component={OrderConfirmationScreen} 
        options={{ title: 'Confirmation de commande' }} 
      />

    </CartStack.Navigator>
  );
};

export default CartStackNavigator;