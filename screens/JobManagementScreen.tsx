import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

function JobManagementScreen() {
  const { email } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>就活管理</Text>
      <Text style={styles.email}>{email}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 14,
    color: '#555555',
    marginTop: 8,
  },
});

export default JobManagementScreen;
