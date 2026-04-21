import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatIcon, HomeIcon, SettingsIcon, WorkIcon } from './components/NavIcons';
import { AuthProvider, useAuth } from './context/AuthContext';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HealthCareScreen from './screens/HealthCareScreen';
import JobManagementScreen from './screens/JobManagementScreen';
import JobSupportScreen from './screens/JobSupportScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import SettingsScreen from './screens/SettingsScreen';
import { requestHealthKitPermissions } from './services/healthService';
import { requestNotificationPermission } from './services/notifications';

type TabName = 'health_care' | 'job_management' | 'job_support' | 'settings';
type AuthScreen = 'login' | 'register' | 'forgot_password';

const ICON_SIZE = 28;
const COLOR_ACTIVE = '#304E78';
const COLOR_INACTIVE = '#A8BDD4';

function TabIcon({ name, active }: { name: TabName; active: boolean }) {
  const color = active ? COLOR_ACTIVE : COLOR_INACTIVE;
  switch (name) {
    case 'health_care':    return <HomeIcon color={color} size={ICON_SIZE} />;
    case 'job_management': return <WorkIcon color={color} size={ICON_SIZE} />;
    case 'job_support':    return <ChatIcon color={color} size={ICON_SIZE} />;
    case 'settings':       return <SettingsIcon color={color} size={ICON_SIZE} />;
    default:               return null;
  }
}

const TABS: TabName[] = ['health_care', 'job_management', 'job_support', 'settings'];

function renderScreen(tab: TabName) {
  switch (tab) {
    case 'health_care':    return <HealthCareScreen />;
    case 'job_management': return <JobManagementScreen />;
    case 'job_support':    return <JobSupportScreen />;
    case 'settings':       return <SettingsScreen />;
    default:              return null;
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
  const { isAuthenticated, isLoading, isDemo } = useAuth();
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
            key={tab}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={
              tab === 'health_care'
                ? 'ホーム'
                : tab === 'job_management'
                ? '求人管理'
                : tab === 'job_support'
                ? '就職支援'
                : '設定'
            }
            accessibilityState={{ selected: activeTab === tab }}
          >
            <TabIcon name={tab} active={activeTab === tab} />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function App() {
  useEffect(() => {
    // Request permissions sequentially so dialogs don't stack
    (async () => {
      await requestNotificationPermission().catch(() => {});
      await requestHealthKitPermissions().catch(() => {});
    })();
  }, []);

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
    backgroundColor: '#F2EBE4',
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
    borderTopColor: '#D9D0C8',
    backgroundColor: '#F2EBE4',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
});

export default App;
