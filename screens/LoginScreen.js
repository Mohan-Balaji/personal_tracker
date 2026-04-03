import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Automatically route based on this admin email
const ADMIN_EMAIL = "bmohanbalaji1976@gmail.com";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');

  const handleLogin = () => {
    if (!email) return;
    
    // Check if the entered Google email is the admin
    if (email.toLowerCase().trim() === ADMIN_EMAIL) {
      navigation.replace('AdminRoot', { email: email.toLowerCase().trim() });
    } else {
      navigation.replace('ParentRoot', { email: email.toLowerCase().trim() });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundCircle} />
      <View style={styles.backgroundCircleSmall} />
      
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Sentinel</Text>
          <Text style={styles.subtitle}>Daily Timeline Tracker</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.cardTitle}>Sign in to continue</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter your Google Email"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TouchableOpacity 
            style={styles.googleButton}
            activeOpacity={0.8}
            onPress={handleLogin}
          >
            <View style={styles.btnContent}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.buttonText}>Continue with Google</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.infoText}>
            Access is automatically determined. The Admin dashboard activates for {ADMIN_EMAIL}.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  backgroundCircle: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: '#1E293B',
    opacity: 0.5,
  },
  backgroundCircleSmall: {
    position: 'absolute',
    bottom: -100,
    left: -50,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#3B82F6',
    opacity: 0.1,
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  loginCard: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 10,
  },
  buttonText: {
    color: '#333333',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  }
});
