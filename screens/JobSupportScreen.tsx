import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function JobSupportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Job Support</Text>
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

export default JobSupportScreen;
