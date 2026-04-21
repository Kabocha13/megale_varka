import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface LinePoint {
  label: string;          // x-axis label (short)
  value: number | null;   // null = missing data
}

interface Props {
  data: LinePoint[];
  minY: number;
  maxY: number;
  height?: number;
  color?: string;
  formatY?: (v: number) => string;
  gridLines?: number;       // number of horizontal reference lines
}

// Rotated-view line segment — avoids adding react-native-svg as a dependency.
function Segment({
  x1, y1, x2, y2, color, thickness = 2,
}: { x1: number; y1: number; x2: number; y2: number; color: string; thickness?: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) { return null; }
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: x1,
        top: y1 - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        transform: [{ translateX: 0 }, { rotate: `${angle}deg` }],
        transformOrigin: '0% 50%',
        borderRadius: thickness,
      }}
    />
  );
}

const CHART_LEFT = 32;    // reserved for y-axis labels
const CHART_RIGHT = 8;
const CHART_TOP = 8;
const CHART_BOTTOM = 22;  // reserved for x-axis labels

export default function LineChart({
  data,
  minY,
  maxY,
  height = 160,
  color = '#304E78',
  formatY,
  gridLines = 3,
}: Props) {
  const [width, setWidth] = React.useState(0);

  const { points, grid } = useMemo(() => {
    if (width === 0 || data.length === 0) { return { points: [], grid: [] }; }
    const plotW = width - CHART_LEFT - CHART_RIGHT;
    const plotH = height - CHART_TOP - CHART_BOTTOM;
    const range = maxY - minY || 1;
    const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

    const pts = data.map((p, i) => {
      if (p.value === null) { return null; }
      const x = CHART_LEFT + stepX * i;
      const y = CHART_TOP + plotH - ((p.value - minY) / range) * plotH;
      return { x, y, value: p.value };
    });

    const gridValues: { y: number; label: string }[] = [];
    for (let i = 0; i <= gridLines; i++) {
      const ratio = i / gridLines;
      const v = minY + (maxY - minY) * (1 - ratio);
      const y = CHART_TOP + plotH * ratio;
      gridValues.push({ y, label: formatY ? formatY(v) : String(Math.round(v * 10) / 10) });
    }
    return { points: pts, grid: gridValues };
  }, [data, width, height, minY, maxY, formatY, gridLines]);

  // Build segments for consecutive non-null points
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) {
      segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  return (
    <View
      style={{ height }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {/* Grid lines + y labels */}
      {grid.map((g, i) => (
        <React.Fragment key={`g-${i}`}>
          <View
            style={[
              styles.gridLine,
              { top: g.y, left: CHART_LEFT, right: CHART_RIGHT },
            ]}
          />
          <Text style={[styles.yLabel, { top: g.y - 7 }]}>{g.label}</Text>
        </React.Fragment>
      ))}

      {/* Segments */}
      {segments.map((s, i) => (
        <Segment key={`s-${i}`} {...s} color={color} />
      ))}

      {/* Dots */}
      {points.map((p, i) =>
        p ? (
          <View
            key={`d-${i}`}
            style={[styles.dot, { left: p.x - 4, top: p.y - 4, backgroundColor: color }]}
          />
        ) : null,
      )}

      {/* X labels */}
      {data.map((d, i) => {
        if (width === 0) { return null; }
        const plotW = width - CHART_LEFT - CHART_RIGHT;
        const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
        const x = CHART_LEFT + stepX * i;
        // Show every other label when many points to avoid overlap
        const showEvery = data.length > 10 ? Math.ceil(data.length / 7) : 1;
        if (i % showEvery !== 0 && i !== data.length - 1) { return null; }
        return (
          <Text
            key={`x-${i}`}
            style={[styles.xLabel, { left: x - 18, width: 36, top: height - 16 }]}
          >
            {d.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gridLine: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E3DCD4',
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: 28,
    fontSize: 9,
    color: '#A8BDD4',
    textAlign: 'right',
  },
  xLabel: {
    position: 'absolute',
    fontSize: 9,
    color: '#A8BDD4',
    textAlign: 'center',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
