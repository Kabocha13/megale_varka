import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type TabName = 'Tab1' | 'Tab2' | 'Tab3' | 'Tab4';

const TABS: { name: TabName; label: string }[] = [
  { name: 'Tab1', label: 'Tab 1' },
  { name: 'Tab2', label: 'Tab 2' },
  { name: 'Tab3', label: 'Tab 3' },
  { name: 'Tab4', label: 'Tab 4' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabName>('Tab1');

  return (
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
