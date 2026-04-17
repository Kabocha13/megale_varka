import React from 'react';
import { View } from 'react-native';

type Props = { color: string; size: number };

export function HomeIcon({ color, size: s }: Props) {
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Roof (triangle via border trick) */}
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: s * 0.46,
        borderRightWidth: s * 0.46,
        borderBottomWidth: s * 0.38,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }} />
      {/* Body */}
      <View style={{
        width: s * 0.62,
        height: s * 0.38,
        backgroundColor: color,
        marginTop: 1,
      }} />
    </View>
  );
}

export function WorkIcon({ color, size: s }: Props) {
  const borderW = Math.max(2, s * 0.08);
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Handle */}
      <View style={{
        width: s * 0.38,
        height: s * 0.16,
        borderTopWidth: borderW,
        borderLeftWidth: borderW,
        borderRightWidth: borderW,
        borderTopColor: color,
        borderLeftColor: color,
        borderRightColor: color,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
      }} />
      {/* Body */}
      <View style={{
        width: s * 0.78,
        height: s * 0.48,
        backgroundColor: color,
        borderRadius: 3,
      }} />
    </View>
  );
}

export function ChatIcon({ color, size: s }: Props) {
  return (
    <View style={{ width: s, height: s, alignItems: 'flex-start', justifyContent: 'center' }}>
      {/* Bubble */}
      <View style={{
        width: s * 0.82,
        height: s * 0.6,
        backgroundColor: color,
        borderRadius: s * 0.12,
        marginLeft: s * 0.06,
      }} />
      {/* Tail (triangle at bottom-left) */}
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.18,
        borderRightWidth: s * 0.18,
        borderTopColor: color,
        borderRightColor: 'transparent',
        marginLeft: s * 0.2,
        marginTop: -1,
      }} />
    </View>
  );
}

export function SettingsIcon({ color, size: s }: Props) {
  const tick = s * 0.12;
  const tickLen = s * 0.14;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Top tick */}
      <View style={{ width: tick, height: tickLen, backgroundColor: color, borderRadius: 2 }} />
      {/* Middle row: left tick, ring+dot, right tick */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: tickLen, height: tick, backgroundColor: color, borderRadius: 2 }} />
        <View style={{
          width: s * 0.46,
          height: s * 0.46,
          borderRadius: s * 0.23,
          borderWidth: s * 0.1,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{
            width: s * 0.14,
            height: s * 0.14,
            borderRadius: s * 0.07,
            backgroundColor: color,
          }} />
        </View>
        <View style={{ width: tickLen, height: tick, backgroundColor: color, borderRadius: 2 }} />
      </View>
      {/* Bottom tick */}
      <View style={{ width: tick, height: tickLen, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}
