import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface Props {
  onDone: () => void;
  durationMs?: number; // total visible time before fade-out starts
}

// Palette — matches the app icon exactly.
const C = {
  sky:       '#F2EBE4',
  sun:       '#C77D7D',
  sunHalo:   '#F2DCC9',
  sunRay:    '#D9905F',
  hull:      '#304E78',
  sail:      '#E8A073',
  seaTop:    '#A8BDD4',
  seaBottom: '#7FA8D0',
  reflection:'#D9A093',
  text:      '#304E78',
  textMuted: '#8A5A1E',
};

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

export default function SplashScreen({ onDone, durationMs = 1500 }: Props) {
  // Fade controllers
  const fade = useRef(new Animated.Value(0)).current;   // whole scene fade-in
  const textFade = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(12)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  // Loop animations
  const bob = useRef(new Animated.Value(0)).current;     // ship vertical bob
  const drift = useRef(new Animated.Value(0)).current;   // ship slight sway
  const waveShift = useRef(new Animated.Value(0)).current;
  const sunPulse = useRef(new Animated.Value(0)).current;
  const rayRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // --- Intro timeline ---
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.parallel([
      Animated.timing(textFade, {
        toValue: 1,
        duration: 500,
        delay: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textSlide, {
        toValue: 0,
        duration: 500,
        delay: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // --- Continuous loops ---
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const waveLoop = Animated.loop(
      Animated.timing(waveShift, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const sunLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sunPulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const rayLoop = Animated.loop(
      Animated.timing(rayRotate, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    bobLoop.start(); driftLoop.start(); waveLoop.start(); sunLoop.start(); rayLoop.start();

    // --- Exit fade-out, then hand back ---
    const exitDelay = Math.max(0, durationMs - 320);
    const exit = setTimeout(() => {
      Animated.timing(exitFade, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onDone());
    }, exitDelay);

    return () => {
      clearTimeout(exit);
      bobLoop.stop(); driftLoop.stop(); waveLoop.stop(); sunLoop.stop(); rayLoop.stop();
    };
  }, [bob, drift, waveShift, sunPulse, rayRotate, fade, textFade, textSlide, exitFade, durationMs, onDone]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const waveX = waveShift.interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_W] });
  const sunScale = sunPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rayDeg = rayRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // 8 rays around the sun
  const rays = Array.from({ length: 8 }, (_, i) => i);

  return (
    <Animated.View style={[styles.root, { opacity: exitFade }]} pointerEvents="none">
      <Animated.View style={[styles.inner, { opacity: fade }]}>
        {/* Sun block */}
        <View style={styles.sunWrap}>
          <Animated.View style={[styles.rayLayer, { transform: [{ rotate: rayDeg }] }]}>
            {rays.map(i => (
              <View
                key={i}
                style={[
                  styles.ray,
                  { transform: [{ rotate: `${i * 45}deg` }, { translateY: -72 }] },
                ]}
              />
            ))}
          </Animated.View>
          <Animated.View style={[styles.sunHalo, { transform: [{ scale: sunScale }] }]} />
          <View style={styles.sun} />
        </View>

        {/* Sea with looping wave bands */}
        <View style={styles.seaWrap}>
          <Animated.View
            style={[
              styles.waveStrip,
              styles.waveTop,
              { transform: [{ translateX: waveX }] },
            ]}
          />
          <Animated.View
            style={[
              styles.waveStrip,
              styles.waveBottom,
              {
                transform: [
                  {
                    translateX: waveShift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, SCREEN_W],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.reflection1} />
          <View style={styles.reflection2} />
        </View>

        {/* Ship — bobs on the sea */}
        <Animated.View
          style={[
            styles.shipWrap,
            { transform: [{ translateY: bobY }, { translateX: driftX }] },
          ]}
        >
          {/* Sail */}
          <View style={styles.sail} />
          {/* Mast */}
          <View style={styles.mast} />
          {/* Hull */}
          <View style={styles.hull} />
        </Animated.View>

        {/* Text block */}
        <Animated.View
          style={[
            styles.textBlock,
            { opacity: textFade, transform: [{ translateY: textSlide }] },
          ]}
        >
          <Text style={styles.title}>megálē várka</Text>
          <Text style={styles.credit}>Powered by React Native</Text>
          <Text style={styles.credit}>Created by IssaShimoda</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

// --- Geometry constants ---
const SHIP_WIDTH = 180;
const SUN_SIZE = 120;
const SUN_HALO = 150;
const SEA_HEIGHT = 110;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.sky,
    zIndex: 1000,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: SCREEN_H * 0.13,
  },

  // Sun
  sunWrap: {
    width: SUN_HALO + 60,
    height: SUN_HALO + 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -20,
  },
  rayLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 6,
    height: 18,
    borderRadius: 3,
    backgroundColor: C.sunRay,
  },
  sunHalo: {
    position: 'absolute',
    width: SUN_HALO,
    height: SUN_HALO,
    borderRadius: SUN_HALO / 2,
    backgroundColor: C.sunHalo,
  },
  sun: {
    position: 'absolute',
    width: SUN_SIZE,
    height: SUN_SIZE,
    borderRadius: SUN_SIZE / 2,
    backgroundColor: C.sun,
  },

  // Sea — two layered strips with reflections
  seaWrap: {
    position: 'absolute',
    left: 0, right: 0,
    bottom: 0,
    height: SEA_HEIGHT,
    overflow: 'hidden',
  },
  waveStrip: {
    position: 'absolute',
    left: -SCREEN_W,
    width: SCREEN_W * 3,
    height: SEA_HEIGHT / 2,
  },
  waveTop: {
    top: 0,
    backgroundColor: C.seaTop,
  },
  waveBottom: {
    bottom: 0,
    backgroundColor: C.seaBottom,
  },
  reflection1: {
    position: 'absolute',
    top: 6,
    left: '35%',
    width: 80,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.reflection,
    opacity: 0.7,
  },
  reflection2: {
    position: 'absolute',
    top: SEA_HEIGHT / 2 + 8,
    left: '30%',
    width: 90,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.reflection,
    opacity: 0.5,
  },

  // Ship — hull + mast + sail
  shipWrap: {
    position: 'absolute',
    bottom: SEA_HEIGHT - 28,
    alignItems: 'center',
    width: SHIP_WIDTH,
  },
  hull: {
    width: SHIP_WIDTH,
    height: 36,
    backgroundColor: C.hull,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  mast: {
    position: 'absolute',
    bottom: 30,
    width: 4,
    height: 72,
    backgroundColor: C.hull,
    borderRadius: 2,
  },
  sail: {
    position: 'absolute',
    bottom: 34,
    left: SHIP_WIDTH / 2 + 2,
    width: 36,
    height: 64,
    backgroundColor: C.sail,
    borderTopRightRadius: 36,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },

  // Text block
  textBlock: {
    position: 'absolute',
    bottom: SEA_HEIGHT + 110,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    marginBottom: 10,
  },
  credit: {
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1.5,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    marginTop: 2,
  },
});
