import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function HealthMaintenanceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Maintenance</Text>
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

export default HealthMaintenanceScreen;
