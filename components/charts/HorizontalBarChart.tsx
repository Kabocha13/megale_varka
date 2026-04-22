import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface HBarItem {
  label: string;
  value: number;
  valueLabel?: string;
}

interface Props {
  data: HBarItem[];
  color?: string;
  maxValue?: number; // defaults to max of data
}

export default function HorizontalBarChart({
  data,
  color = '#304E78',
  maxValue,
}: Props) {
  const max = Math.max(1, maxValue ?? data.reduce((m, d) => Math.max(m, d.value), 0));

  if (data.length === 0) {
    return <Text style={styles.empty}>データがありません</Text>;
  }

  return (
    <View style={styles.container}>
      {data.map(item => {
        const pct = (item.value / max) * 100;
        return (
          <View key={item.label} style={styles.row}>
            <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.value}>{item.valueLabel ?? item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 92,
    fontSize: 11,
    color: '#333333',
  },
  track: {
    flex: 1,
    height: 12,
    backgroundColor: '#F0EBE4',
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
  },
  value: {
    width: 58,
    fontSize: 11,
    color: '#555555',
    textAlign: 'right',
  },
  empty: {
    fontSize: 12,
    color: '#A8BDD4',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
