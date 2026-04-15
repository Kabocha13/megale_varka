import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function JobManagementScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Job Management</Text>
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
});

export default JobManagementScreen;
