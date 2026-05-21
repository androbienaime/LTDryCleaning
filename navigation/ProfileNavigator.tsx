// navigation/ProfileNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../src/@types/navigation';
import ProfileScreen from '../screens/profile/ProfileScreen';
import OrderHistoryScreen from '../screens/profile/OrderHistoryScreen';
import AccountManagementScreen from '../screens/profile/AccountManagementScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import SystemSettingsScreen from '@/screens/config/Systemsettingsscreen';
// import OrderDetailsScreen from '../screens/profile/OrderDetailsScreen';
// import EditProfileScreen from '../screens/profile/EditProfileScreen';
// import AddressBookScreen from '../screens/profile/AddressBookScreen';
// import AddAddressScreen from '../screens/profile/AddAddressScreen';
// import EditAddressScreen from '../screens/profile/EditAddressScreen';
// import PaymentMethodsScreen from '../screens/profile/PaymentMethodsScreen';
// import SettingsScreen from '../screens/profile/SettingsScreen';

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileStackNavigator: React.FC = () => {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        headerBackVisible: false,
      }}
    >
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon Profil' }} />
      <ProfileStack.Screen name="AccountManagement" component={AccountManagementScreen} options={{ title: 'Gestion des comptes' }} />
      <ProfileStack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ headerBackVisible: true }} />
      <ProfileStack.Screen name="Settings" component={SystemSettingsScreen} options={{ headerBackVisible: true }} />

      {/* <ProfileStack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
        options={{ title: 'Détails de la commande' }} 
      />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Modifier le profil' }} />
      <ProfileStack.Screen name="AddressBook" component={AddressBookScreen} options={{ title: 'Carnet d\'adresses' }} />
      <ProfileStack.Screen name="AddAddress" component={AddAddressScreen} options={{ title: 'Ajouter une adresse' }} />
      <ProfileStack.Screen 
        name="EditAddress" 
        component={EditAddressScreen} 
        options={{ title: 'Modifier l\'adresse' }} 
      />
      <ProfileStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: 'Moyens de paiement' }} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Paramètres' }} /> */}
    </ProfileStack.Navigator>
  );
};

export default ProfileStackNavigator;