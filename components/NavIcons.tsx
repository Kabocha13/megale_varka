import React from 'react';
import { Text, View } from 'react-native';

const EMOJIS: Record<string, string> = {
  home: '🏠',
  job_management: '💼',
  consultation: '💬',
  settings: '⚙️',
};

type Props = {
  name: string;
  active: boolean;
  activeColor: string;
};

export function NavTabIcon({ name, active, activeColor }: Props) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 24, opacity: active ? 1 : 0.35 }}>
        {EMOJIS[name]}
      </Text>
      <View style={{
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: active ? activeColor : 'transparent',
        marginTop: 3,
      }} />
    </View>
  );
}
