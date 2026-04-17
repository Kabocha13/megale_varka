import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { logout } = useAuth();

  const handleLogoutPress = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert('エラー', 'ログアウトに失敗しました。もう一度お試しください。');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>設定</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2EBE4',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#304E78',
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#304E78',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#F2EBE4',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
