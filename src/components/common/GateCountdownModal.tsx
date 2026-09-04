import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';

interface GateCountdownModalProps {
  visible: boolean;
  direction: 'IN' | 'OUT';
  hasCountdown?: boolean;
  seconds?: number;
  onOpenNow: () => void;
  onCancel: () => void;
  onComplete?: () => void;
}

export const GateCountdownModal: React.FC<GateCountdownModalProps> = ({
  visible,
  direction,
  hasCountdown = false,
  seconds = 5,
  onOpenNow,
  onCancel,
  onComplete,
}) => {
  const [countdown, setCountdown] = useState(seconds);

  useEffect(() => {
    if (!visible || !hasCountdown) return;
    setCountdown(seconds);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onComplete) onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, hasCountdown, seconds, onComplete]);

  if (!visible) return null;

  const badgeText =
    direction === 'IN' ? '✓ ลงเวลาเข้าสำเร็จเรียบร้อย' : '✓ บันทึกเวลาออกสำเร็จเรียบร้อย';
  const gateTitle =
    direction === 'IN' ? 'ขั้นตอน: เปิดไม้กั้นขาเข้า' : 'ขั้นตอน: เปิดไม้กั้นขาออก';
  const gateSubText =
    direction === 'IN'
      ? 'แตะปุ่ม "เปิดไม้กั้น" ด้านล่างเพื่อส่งสัญญาณเปิดไม้กั้นให้ผู้ติดต่อเข้าโครงการ'
      : 'แตะปุ่ม "เปิดไม้กั้น" ด้านล่างเพื่อส่งสัญญาณเปิดไม้กั้นให้ผู้ติดต่อออกจากโครงการ';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Step Indicator Badge */}
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeSuccessText}>{badgeText}</Text>
          </View>

          <Text style={styles.title}>{gateTitle}</Text>

          {hasCountdown ? (
            <View style={styles.circle}>
              <Text style={styles.number}>{countdown}</Text>
              <Text style={styles.unit}>วินาที</Text>
            </View>
          ) : (
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🚧</Text>
            </View>
          )}

          <Text style={styles.subText}>
            แตะปุ่ม <Text style={styles.boldText}>"เปิดไม้กั้น"</Text> ด้านล่างเพื่อส่งสัญญาณเปิดไม้กั้นให้ผู้ติดต่อ{direction === 'IN' ? 'เข้าโครงการ' : 'ออกจากโครงการ'}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionColumn}>
            <TouchableOpacity style={styles.bigOpenBtn} onPress={onOpenNow} activeOpacity={0.8}>
              <Text style={styles.bigOpenText}>🚧 เปิดไม้กั้น</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>✕ ไม่เปิดไม้กั้น (เสร็จสิ้น)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  badgeSuccessText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 26,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EFF6FF',
    borderWidth: 4,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 18,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    borderWidth: 3,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 18,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  iconEmoji: {
    fontSize: 42,
  },
  number: {
    color: '#1D4ED8',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 38,
  },
  unit: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  subText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  boldText: {
    color: '#0F172A',
    fontWeight: '900',
  },
  actionColumn: {
    width: '100%',
    gap: 10,
  },
  bigOpenBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#16A34A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bigOpenText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
});
