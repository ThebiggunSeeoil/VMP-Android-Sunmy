import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';

interface Props {
  title?: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onBiometric?: () => void;
  showBiometric?: boolean;
  shake?: boolean;
  disabled?: boolean;
  attemptsLeft?: number;
}

const PIN_LENGTH = 4;

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'del'],
];

export const PasscodeKeypad: React.FC<Props> = ({
  title,
  subtitle,
  onComplete,
  onBiometric,
  showBiometric = false,
  shake = false,
  disabled = false,
  attemptsLeft,
}) => {
  const pinRef = useRef('');
  const [pinLength, setPinLength] = useState(0);
  const isCompletingRef = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(Array.from({ length: PIN_LENGTH }, () => new Animated.Value(0))).current;

  // Shake animation on wrong PIN
  useEffect(() => {
    if (shake) {
      Vibration.vibrate([0, 80, 60, 80]);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
      pinRef.current = '';
      setPinLength(0);
      isCompletingRef.current = false;
      dotAnims.forEach(a => a.setValue(0));
    }
  }, [shake]);

  // Dot fill animation
  const animateDot = (index: number, fill: boolean) => {
    if (index >= 0 && index < PIN_LENGTH) {
      Animated.spring(dotAnims[index], {
        toValue: fill ? 1 : 0,
        useNativeDriver: true,
        speed: 45,
        bounciness: 6,
      }).start();
    }
  };

  const handleKey = (key: string) => {
    if (disabled || key === 'bio' || isCompletingRef.current) return;

    if (key === 'del') {
      if (pinRef.current.length === 0) return;
      const prevLen = pinRef.current.length;
      pinRef.current = pinRef.current.slice(0, -1);
      setPinLength(pinRef.current.length);
      animateDot(prevLen - 1, false);
      return;
    }

    if (pinRef.current.length >= PIN_LENGTH) return;

    // Synchronously append key to ref without stale state closure
    pinRef.current = pinRef.current + key;
    const currentLen = pinRef.current.length;
    setPinLength(currentLen);
    animateDot(currentLen - 1, true);

    if (currentLen === PIN_LENGTH) {
      isCompletingRef.current = true;
      const completedPin = pinRef.current;
      setTimeout(() => {
        onComplete(completedPin);
        pinRef.current = '';
        setPinLength(0);
        isCompletingRef.current = false;
        dotAnims.forEach(a => a.setValue(0));
      }, 140);
    }
  };

  const lockedOut = attemptsLeft !== undefined && attemptsLeft <= 0;

  return (
    <View style={styles.wrapper}>
      {/* Subtitle */}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* Attempts Banner */}
      {attemptsLeft !== undefined && attemptsLeft < 5 && attemptsLeft > 0 && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>⚠️  เหลือโอกาสอีก {attemptsLeft} ครั้ง</Text>
        </View>
      )}
      {lockedOut && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>🔒  บัญชีถูกล็อก — สแกน QR เพื่อ Reset</Text>
        </View>
      )}

      {/* PIN Dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const scale = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
          const bg = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: ['transparent', '#1D4ED8'],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                shake && styles.dotError,
                { transform: [{ scale }], backgroundColor: bg as any },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {ROWS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key) => {
              // Bio button
              if (key === 'bio') {
                return showBiometric ? (
                  <TouchableOpacity
                    key="bio"
                    style={styles.keySpecial}
                    onPress={onBiometric}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.keyBioIcon}>👆</Text>
                  </TouchableOpacity>
                ) : (
                  <View key="bio-empty" style={styles.keyInvisible} />
                );
              }
              // Delete button
              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key="del"
                    style={styles.keySpecial}
                    onPress={() => handleKey('del')}
                    activeOpacity={0.65}
                    disabled={disabled}
                  >
                    <Text style={styles.keyDelText}>⌫</Text>
                  </TouchableOpacity>
                );
              }
              // Number button
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.key, disabled && styles.keyDisabled]}
                  onPress={() => handleKey(key)}
                  activeOpacity={0.6}
                  disabled={disabled}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const KEY_SIZE = 72;
const KEY_GAP = 14;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  warnBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warnText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  lockedText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 32,
    marginTop: 6,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  dotError: {
    borderColor: '#EF4444',
  },
  keypad: {
    gap: KEY_GAP,
    alignItems: 'center',
  },
  keyRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  keyText: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  keySpecial: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyInvisible: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  keyBioIcon: {
    fontSize: 26,
  },
  keyDelText: {
    fontSize: 22,
    color: '#64748B',
  },
  keyDisabled: {
    opacity: 0.35,
  },
});
