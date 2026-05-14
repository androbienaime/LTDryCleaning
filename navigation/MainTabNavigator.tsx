// navigation/MainTabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { getFocusedRouteNameFromRoute, RouteProp } from '@react-navigation/native';

import { MainTabParamList } from '../src/@types/navigation';
import ShopStackNavigator from './ShopNavigator';
import CartStackNavigator from './CartNavigator';
import ProfileStackNavigator from './ProfileNavigator';
import CategoriesScreen from '@/screens/shop/CategoryScreen';
// import ChatScreen from '@/screens/chat/ChatScreen';

import { useThemeColors } from '@/theme';
import useCart from '@/hooks/useCart';

const MainTab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  const colors = useThemeColors();
  const {itemCount } = useCart();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = 'home';

          switch (route.name) {
            case 'Categories':
              iconName = 'grid';
              break;
            case 'CartStack':
              iconName = 'shopping-cart';
              break;
            case 'Chat':
              iconName = 'message-circle';
              break;
            case 'ProfileStack':
              iconName = 'user';
              break;
          }

          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.button.primary,
        tabBarInactiveTintColor: colors.button.gray,
        headerShown: false,
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 1,
          borderTopColor: colors.border.default,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <MainTab.Screen
        name="Shop"
        component={ShopStackNavigator}
        options={({ route }) => {
          // disable global tabBar for ProductDetails
          const routeName = getFocusedRouteNameFromRoute(route as RouteProp<any>) ?? '';
          const tabHiddenRoutes = ['ProductDetails'];

          const isTabBarVisible = !tabHiddenRoutes.includes(routeName);

          return {
            title: 'Accueil',
            tabBarStyle: isTabBarVisible
              ? {
                  elevation: 0,
                  borderTopWidth: 1,
                  borderTopColor: colors.border.default,
                }
              : { display: 'none' },
          };
        }}
      />
      <MainTab.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Catégories' }} />
      {/* <MainTab.Screen name="Chat" component={ChatScreen} options={{ title: 'Leki' }} /> */}
      <MainTab.Screen
        name="CartStack" 
        component={CartStackNavigator} 
        options={{ 
          title: 'Panier', 
          headerShown: false, 
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.button.primary,
            color: 'white',
          }
        }} 
        />
      <MainTab.Screen name="ProfileStack" component={ProfileStackNavigator} options={{ title: 'Profil' }} />
    </MainTab.Navigator>
  );
};

export default MainTabNavigator;
