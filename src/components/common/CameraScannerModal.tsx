import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraScannerView } from './CameraScannerView';
import { useAppStore } from '../../state/useAppStore';

interface CameraScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  subtitle?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_FRAME_SIZE = Math.min(SCREEN_WIDTH * 0.75, 260);

// Slower animation = less CPU usage on weak devices
const LASER_DURATION = 2400;

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'สแกน QR Code / บาร์โค้ด',
  subtitle = 'วาง QR Code ให้อยู่ภายในกรอบ',
}) => {
  const { config } = useAppStore();
  const [torchOn, setTorchOn] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      hasScannedRef.current = false;
      // Use native driver for GPU-accelerated transform (avoids JS thread)
      // Slower duration = fewer re-renders per second = less jitter on V2Pro
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: LASER_DURATION,
            useNativeDriver: true, // CRITICAL: keeps animation off JS thread
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: LASER_DURATION,
            useNativeDriver: true,
          }),
        ])
      );
      loopRef.current.start();
    } else {
      // Stop animation when modal hidden to free GPU resources
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      scanLineAnim.setValue(0);
      setTorchOn(false);
    }

    return () => {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, [visible]);

  const handleBarcodeScanned = (code: string) => {
    if (!code || hasScannedRef.current) return;
    hasScannedRef.current = true;
    // Stop animation immediately on scan to free resources
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current = null;
    }
    setTorchOn(false);
    onScan(code);
  };

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_FRAME_SIZE - 3],
  });

  // Lite mode = no animation at all for very low-spec devices
  const showAnimation = !config.isLiteMode;

  return (
    <Modal
      visible={visible}
      animationType="none"        // 'none' instead of 'fade' — saves transition frame budget
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Camera View — Only mount when visible to avoid background processing */}
        {visible && (
          <CameraScannerView
            style={StyleSheet.absoluteFillObject}
            isActive={visible}
            torch={torchOn}
            onScan={handleBarcodeScanned}
          />
        )}

        {/* Lightweight Overlay — solid colors instead of rgba for better perf */}
        <View style={styles.overlayContainer} pointerEvents="box-none">

          {/* Top Header Bar — solid dark instead of rgba */}
          <View style={styles.headerBar}>
            <View style={styles.headerInfo}>
              <View style={styles.badgeRow}>
                <View style={styles.liveDot} />
                <Text style={styles.badgeText}>VMS LIVE SCANNER</Text>
              </View>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.actionBtn, torchOn && styles.actionBtnActive]}
                onPress={() => setTorchOn(!torchOn)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionBtnText}>{torchOn ? '🔦 ไฟเปิด' : '💡 ไฟฉาย'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeRoundBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeRoundBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Center Viewfinder */}
          <View style={styles.centerArea} pointerEvents="none">
            <View style={[styles.scanFrame, { width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE }]}>
              {/* Corner Reticle — simple borders, no shadow */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Laser Line — animated only on normal mode, hidden in lite mode */}
              {showAnimation ? (
                <Animated.View
                  style={[
                    styles.laserLine,
                    { transform: [{ translateY }] },
                  ]}
                />
              ) : (
                // Lite mode: static center line instead of animated (zero CPU)
                <View style={styles.laserLineStatic} />
              )}
            </View>

            <View style={styles.instructionPill}>
              <Text style={styles.instructionText}>
                🟢 กำลังตรวจจับ QR Code / บาร์โค้ด
              </Text>
            </View>
          </View>

          {/* Bottom Cancel Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>✕ ยกเลิก / ปิดกล้อง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    // Solid color instead of rgba — avoids alpha-compositing overhead on API 25
    backgroundColor: '#0F172A',
    paddingTop: 32,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerInfo: {
    flex: 1,
    paddingRight: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  badgeText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#475569',
  },
  actionBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  closeRoundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  closeRoundBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  scanFrame: {
    position: 'relative',
    borderRadius: 16,
    // Transparent background — no complex alpha compositing needed
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',      // Clips the laser line to the frame boundaries
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#3B82F6',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  laserLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#38BDF8',
    // No shadow/elevation — major performance improvement on low-end Android
  },
  laserLineStatic: {
    // Lite mode: static line at center, zero animation cost
    width: '100%',
    height: 2,
    backgroundColor: '#38BDF8',
    position: 'absolute',
    top: '50%',
  },
  instructionPill: {
    // Solid color instead of semi-transparent
    backgroundColor: '#0F172A',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  instructionText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    // Solid color — no alpha compositing
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  cancelBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    // No shadow/elevation on cancel button for performance
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
