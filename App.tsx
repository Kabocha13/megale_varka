import React, { useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import HealthCareScreen from './screens/HealthCareScreen';
import HealthMaintenanceScreen from './screens/HealthMaintenanceScreen';
import JobManagementScreen from './screens/JobManagementScreen';
import JobSupportScreen from './screens/JobSupportScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

type TabName = 'health_care' | 'health_maintenance' | 'job_management' | 'job_support';
type AuthScreen = 'login' | 'register' | 'forgot_password';

const TABS: { name: TabName; label: string }[] = [
  { name: 'health_care', label: '健康管理' },
  { name: 'health_maintenance', label: '健康改善' },
  { name: 'job_management', label: '就活管理' },
  { name: 'job_support', label: '就活サポート' },
];

function renderScreen(tab: TabName) {
  switch (tab) {
    case 'health_care':
      return <HealthCareScreen />;
    case 'health_maintenance':
      return <HealthMaintenanceScreen />;
    case 'job_management':
      return <JobManagementScreen />;
    case 'job_support':
      return <JobSupportScreen />;
  }
}

function DemoBanner() {
  return (
    <View style={demoBannerStyles.banner}>
      <Text style={demoBannerStyles.text}>デモモード</Text>
    </View>
  );
}

const demoBannerStyles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 4,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

function AppContent() {
  const { isAuthenticated, isLoading, isDemo, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabName>('health_care');
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={styles.loading} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {isDemo && <DemoBanner />}
        {authScreen === 'login' ? (
          <LoginScreen
            onNavigateToRegister={() => setAuthScreen('register')}
            onNavigateToForgotPassword={() => setAuthScreen('forgot_password')}
          />
        ) : authScreen === 'register' ? (
          <RegisterScreen onNavigateToLogin={() => setAuthScreen('login')} />
        ) : (
          <ForgotPasswordScreen onNavigateToLogin={() => setAuthScreen('login')} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {isDemo && <DemoBanner />}
      <View style={styles.content}>
        {renderScreen(activeTab)}
      </View>
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.name)}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.name && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.tabItem} onPress={logout}>
          <Text style={styles.tabLabel}>ログアウト</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999',
  },
  tabLabelActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
});

export default App;
