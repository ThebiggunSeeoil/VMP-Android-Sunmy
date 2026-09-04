import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  title = 'กำลังติดต่อเซิร์ฟเวอร์...',
  message = 'กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล',
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const rotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      rotateAnim.setValue(0);
      progressAnim.setValue(0);

      // Continuous 360 rotation on Native Driver (GPU/RenderThread)
      rotateLoopRef.current = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 950,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoopRef.current.start();

      // Smooth horizontal bounce for progress bar
      progressLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      progressLoopRef.current.start();
    } else {
      if (rotateLoopRef.current) {
        rotateLoopRef.current.stop();
        rotateLoopRef.current = null;
      }
      if (progressLoopRef.current) {
        progressLoopRef.current.stop();
        progressLoopRef.current = null;
      }
    }

    return () => {
      if (rotateLoopRef.current) {
        rotateLoopRef.current.stop();
        rotateLoopRef.current = null;
      }
      if (progressLoopRef.current) {
        progressLoopRef.current.stop();
        progressLoopRef.current = null;
      }
    };
  }, [visible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressTranslateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 160],
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.spinnerWrapper}>
            <Animated.View
              style={[
                styles.customSpinnerRing,
                { transform: [{ rotate: spin }] },
              ]}
            />
            <Animated.View
              style={[
                styles.spinnerCenterIconWrapper,
                { transform: [{ rotate: spin }] },
              ]}
            >
              <Text style={styles.spinnerEmoji}>⚡</Text>
            </Animated.View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { transform: [{ translateX: progressTranslateX }] },
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  spinnerWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  customSpinnerRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 4,
    borderColor: '#DBEAFE',
    borderTopColor: '#2563EB',
    borderRightColor: '#3B82F6',
  },
  spinnerCenterIconWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerEmoji: {
    fontSize: 14,
  },
  title: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  progressBar: {
    width: 180,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: 80,
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },
});
