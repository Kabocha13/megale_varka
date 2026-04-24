import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface StackSegment {
  label: string;
  value: number;
  color: string;
  iconName?: MaterialIconName;
}

interface Props {
  data: StackSegment[];
  height?: number;
}

export default function StackedBar({ data, height = 22 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <Text style={styles.empty}>データがありません</Text>;
  }

  return (
    <View>
      <View style={[styles.bar, { height }]}>
        {data.map(seg => {
          if (seg.value === 0) { return null; }
          const pct = (seg.value / total) * 100;
          return (
            <View
              key={seg.label}
              style={[
                styles.segment,
                { flex: pct, backgroundColor: seg.color },
              ]}
            >
              {pct >= 10 && (
                seg.iconName && (
                  <MaterialIcons name={seg.iconName} size={14} color="#FFFFFF" />
                )
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {data.map(seg => (
          <View key={`l-${seg.label}`} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: seg.color }]} />
            {seg.iconName && (
              <MaterialIcons name={seg.iconName} size={12} color="#555555" />
            )}
            <Text style={styles.legendText}>
              {seg.label}
              {total > 0 ? ` ${Math.round((seg.value / total) * 100)}%` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    color: '#555555',
  },
  empty: {
    fontSize: 12,
    color: '#A8BDD4',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
