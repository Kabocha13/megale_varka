import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import HealthManagementScreen from './HealthManagementScreen';

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  sub: '#555555',
};

export default function JobSupportScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>就活サポート</Text>
          <Text style={s.subText}>コンディションとメンタルケア</Text>
        </View>
      </View>

      <View style={s.section}>
        <HealthManagementScreen showOnly="stats" />
      </View>

      <View style={s.section}>
        <HealthManagementScreen showOnly="missions" />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 20 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  headerLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: C.primary },
  subText: { fontSize: 14, color: C.sub, marginBottom: 8 },
  section: { marginBottom: 10 },
});
