import React, { useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type TabName = 'health_care' | 'health_maintenance' | 'job_management' | 'job_support';

const TABS: { name: TabName; label: string }[] = [
  { name: 'health_care', label: 'Health Care' },
  { name: 'health_maintenance', label: 'Health Maintenance' },
  { name: 'job_management', label: 'Job Management' },
  { name: 'job_support', label: 'Job Support' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabName>('health_care');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.content} />
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
        </View>
      </SafeAreaView>
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
