import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type Props = { color: string; size: number };

export function HomeIcon({ color, size }: Props) {
  return <MaterialIcons name="home" color={color} size={size} />;
}

export function WorkIcon({ color, size }: Props) {
  return <MaterialIcons name="work" color={color} size={size} />;
}

export function ChatIcon({ color, size }: Props) {
  return <MaterialIcons name="forum" color={color} size={size} />;
}

export function SettingsIcon({ color, size }: Props) {
  return <MaterialIcons name="settings" color={color} size={size} />;
}
