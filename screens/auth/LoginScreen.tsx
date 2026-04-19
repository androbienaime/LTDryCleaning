import CustomAnimated from '@/components/forms/CustomAnimated';
import InputField from '@/components/forms/InputField';
import React, { useState, useRef, useEffect } from 'react';
import { ThemedView } from '../../components/ThemedView';
import {
  View, Text, TouchableOpacity, Image, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, StatusBar,
  TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert,
} from 'react-native';
import ThemedButton from '@/components/ThemedButton';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  // Mode standalone : hors NavigationContainer (AppGate)
  // Quand ces deux callbacks sont fournis, on est en mode standalone.
  onLoginSuccess?: () => void;
  onBack?: () => void;
  // Mode normal : dans NavigationContainer
  navigation?: NativeStackNavigationProp<any>;
  isAddingAccount?: boolean;
};

// ─── Composant ────────────────────────────────────────────────────────────────
// Plus de useNavigation() conditionnel ni de try/catch autour d'un hook.
// La navigation est injectée via prop en mode normal,
// ou gérée via callbacks en mode standalone.

const LoginScreen = ({
  onLoginSuccess,
  onBack,
  navigation,
  isAddingAccount = false,
}: Props) => {

  // Dérivé depuis les props — pas de hook conditionnel
  const isStandalone = !!onBack && !!onLoginSuccess;

  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');


  useEffect(() => {
    if (!isStandalone && navigation) {
      // Mode normal → header avec bouton retour
      navigation.setOptions({
        headerShown: true,
        title: isAddingAccount ? 'Ajouter un compte' : 'Connexion',
        headerBackTitle: 'Retour',
        headerBackVisible: true,
        headerLeft: () => (
          <TouchableOpacity onPress={handleBack} style={{ paddingHorizontal: 10 }}>
            <Text style={{ color: '#1E5A9D', fontSize: 16 }}>←</Text>
          </TouchableOpacity>
        )

      });
    } else {
      // Mode standalone → aucun header (on gère nous-mêmes le retour)
      navigation?.setOptions({ headerShown: false });
    }
  }, [isStandalone, navigation, isAddingAccount]);
  // ── Connexion ──────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Champs requis', "Veuillez remplir l'email et le mot de passe.");
      return;
    }
    clearError();
    await login(email.trim(), password, { saveAccount: true });

    setTimeout(() => {
      if (isStandalone) {
        // console.log('[LoginScreen] standalone → onLoginSuccess()');
        onLoginSuccess!();
      } else if (isAddingAccount) {
        navigation?.goBack();
      }
      // Sinon RootNavigator redirige via AuthContext
    }, 100);
  };

  // ── Retour ─────────────────────────────────────────────────────────────────

  const handleBack = () => {
    console.log('[LoginScreen] handleBack — isStandalone:', isStandalone);
    if (isStandalone) {
      onBack!(); // ← retour au PIN, jamais vers l'app
    } else {
      navigation?.goBack();
    }
  };

  // ── Navigation interne (désactivée en standalone) ──────────────────────────

  const goToForgotPassword = () => navigation?.navigate('Auth', { screen: 'ForgotPassword' });
  const goToRegister       = () => navigation?.navigate('Auth', { screen: 'Register' });
  const handleSocial = (provider: string) => console.log(`Connexion avec ${provider}`);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ThemedView style={styles.safe}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.container}
              keyboardShouldPersistTaps="handled"
            >
              <CustomAnimated>

                {/* Bouton retour vers PIN — uniquement en mode standalone */}
                {isStandalone && (
                  <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                    <Text style={styles.backText}>← Retour au PIN</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.header}>
                  <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
                  <Text style={styles.title}>
                    {isAddingAccount ? 'Ajouter un compte' : 'Connexion'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isAddingAccount ? 'Connectez-vous pour ajouter ce compte' : 'Heureux de vous revoir !'}
                  </Text>
                </View>

                {error ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.form}>
                  <InputField
                    label="Email"
                    placeholder="Email"
                    leftIconName="mail-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(v) => { setEmail(v); clearError(); }}
                  />
                  <InputField
                    isPasswordInput={true}
                    label="Mot de passe"
                    placeholder="Mot de passe"
                    leftIconName="lock-closed-outline"
                    value={password}
                    onChangeText={(v) => { setPassword(v); clearError(); }}
                  />

                  {!isStandalone && (
                    <TouchableOpacity style={styles.forgot} onPress={goToForgotPassword}>
                      <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                    </TouchableOpacity>
                  )}

                  <ThemedButton
                    title={isLoading ? '' : 'Se connecter'}
                    onPress={handleLogin}
                    fullWidth size="medium" variant="primary"
                    disabled={isLoading}
                  />

                  {isLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}

                  {isAddingAccount && !isStandalone && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleBack}>
                      <Text style={styles.cancelText}>Annuler</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!isAddingAccount && !isStandalone && (
                  <>
                    <View style={styles.separator}>
                      <View style={styles.line} />
                      <Text style={styles.or}>ou</Text>
                      <View style={styles.line} />
                    </View>
                    <View style={styles.socialRow}>
                      {['Google', 'Facebook', 'Apple', 'Tiktok'].map((provider) => (
                        <TouchableOpacity
                          key={provider}
                          style={styles.socialButton}
                          onPress={() => handleSocial(provider)}
                        >
                          <Image
                            source={
                              provider === 'Google' ? require('@/assets/images/google.png')
                              : provider === 'Facebook' ? require('@/assets/images/facebook.png')
                              : provider === 'Apple' ? require('@/assets/images/apple.png')
                              : require('@/assets/images/tiktok.png')
                            }
                            style={styles.socialIcon}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.signup}>
                      <Text style={styles.signupText}>Pas encore inscrit ? </Text>
                      <TouchableOpacity onPress={goToRegister}>
                        <Text style={styles.signupLink}>Créer un compte</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

              </CustomAnimated>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </ThemedView>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1},
  container: { padding: 24, justifyContent: 'center', flexGrow: 1, marginTop:40 },
  backBtn: { marginBottom: 8, paddingVertical: 4 },
  backText: { color: '#6366F1', fontWeight: '600', fontSize: 14 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 100, height: 100, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '500' },
  form: { marginBottom: 24 },
  forgot: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { color: '#1E5A9D', fontWeight: '500', fontSize: 14 },
  loadingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  button: {
    backgroundColor: '#1E5A9D',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  separator: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  or: { marginHorizontal: 12, color: '#6B7280', fontWeight: '500' },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  socialButton: {
    width: 70,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  socialIcon: { width: 26, height: 26 },
  signup: { marginTop: 32, flexDirection: 'row', justifyContent: 'center' },
  signupText: { color: '#6B7280', fontSize: 14 },
  signupLink: { color: '#1E5A9D', fontWeight: '600', fontSize: 14 },
});

export default LoginScreen;