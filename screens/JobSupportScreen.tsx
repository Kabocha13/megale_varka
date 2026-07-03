import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const C = {
  bg: '#F2EBE4',
  text: '#263238',
};

export default function JobSupportScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>就活サポート</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 20,
  },
  header: {
    marginTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: C.text,
  },
});
