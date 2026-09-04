import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { useAppStore } from '../../state/useAppStore';

export interface GeneratedPassResultData {
  passId: string;
  passRecordId?: string;
  guardhouseName: string;
  validHours?: number | string;
  validUntil?: string;
  checkoutRequired?: boolean;
  allowLateCheckout?: boolean;
  printSuccess?: boolean;
  printSkipped?: boolean;
  printDetail?: string;
}

interface GeneratedPassResultModalProps {
  visible: boolean;
  data: GeneratedPassResultData | null;
  onCheckInOnly: () => void;
  onCheckInAndOpenGate: () => void;
  onRetryPrint?: () => void;
  onFinish: () => void;
}

export const GeneratedPassResultModal: React.FC<GeneratedPassResultModalProps> = ({
  visible,
  data,
  onCheckInOnly,
  onCheckInAndOpenGate,
  onRetryPrint,
  onFinish,
}) => {
  const enableGateControl = useAppStore((s) => s.enableGateControl);

  if (!data) return null;

  const isWarning = !data.printSuccess && !data.printSkipped;
  const printStatusText = data.printSuccess
    ? 'พิมพ์สำเร็จ'
    : data.printSkipped
    ? 'ข้ามการพิมพ์'
    : 'พิมพ์ไม่สำเร็จ';

  const printDetailText =
    data.printDetail ||
    (data.printSuccess
      ? 'พิมพ์สลิปผ่าน Sunmi 58mm สำเร็จ'
      : data.printSkipped
      ? 'ไม่ได้สั่งพิมพ์บัตรผ่าน'
      : 'ยังเชื่อมห้อง Printer Room ไม่สำเร็จ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Status Icon */}
          <View style={[styles.iconCircle, isWarning ? styles.iconWarning : styles.iconSuccess]}>
            <Text style={styles.iconEmoji}>{isWarning ? '⚠️' : '✅'}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>สร้างรายการสำเร็จ</Text>

          {/* Details Body */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.bodyContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.row}>
              <Text style={styles.label}>สถานะ:</Text>
              <Text style={[styles.value, styles.valueBold]}>สร้างรายการสำเร็จ</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>พิมพ์:</Text>
              <Text style={[styles.value, isWarning ? styles.textWarning : styles.textSuccess]}>
                {printStatusText}
              </Text>
            </View>

            <View style={styles.rowColumn}>
              <Text style={styles.label}>รายละเอียด:</Text>
              <Text style={[styles.value, styles.subDetailText]}>{printDetailText}</Text>
            </View>

            {/* If print failed and retry callback exists, show quick retry banner */}
            {isWarning && onRetryPrint && (
              <TouchableOpacity
                style={styles.retryBannerBtn}
                onPress={onRetryPrint}
                activeOpacity={0.85}
              >
                <Text style={styles.retryBannerText}>🖨️ เปลี่ยนกระดาษแล้ว — กดเพื่อพิมพ์ซ้ำ</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>ป้อม:</Text>
              <Text style={styles.value}>{data.guardhouseName || '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>รหัส Pass:</Text>
              <Text style={[styles.value, styles.passIdText]} numberOfLines={1} ellipsizeMode="middle">
                {data.passId || '-'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>อายุใช้งาน:</Text>
              <Text style={styles.value}>
                {data.validHours ? `${data.validHours} ชั่วโมง` : '24 ชั่วโมง'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>ใช้ได้ถึง:</Text>
              <Text style={styles.value}>{data.validUntil || '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>บังคับเช็คเอาท์:</Text>
              <Text style={styles.value}>{data.checkoutRequired ? 'ใช่' : 'ไม่บังคับ'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>ออกหลังหมดเวลา:</Text>
              <Text style={styles.value}>{data.allowLateCheckout ? 'อนุญาต' : 'ไม่อนุญาต'}</Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {enableGateControl ? (
              <>
                {/* Primary Hero Button: ลงเวลาเข้า + เปิดไม้กั้น */}
                <TouchableOpacity
                  style={[styles.btn, styles.btnHeroGreen]}
                  activeOpacity={0.85}
                  onPress={onCheckInAndOpenGate}
                >
                  <Text style={styles.btnHeroGreenText}>🚪 ลงเวลาเข้า + เปิดไม้กั้น</Text>
                </TouchableOpacity>

                {/* Secondary Button: ลงเวลาเข้าเท่านั้น */}
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondaryBlue]}
                  activeOpacity={0.85}
                  onPress={onCheckInOnly}
                >
                  <Text style={styles.btnSecondaryBlueText}>⏱️ ลงเวลาเข้าเท่านั้น</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Promoted Hero Button: ลงเวลาเข้าเท่านั้น */}
                <TouchableOpacity
                  style={[styles.btn, styles.btnHeroGreen]}
                  activeOpacity={0.85}
                  onPress={onCheckInOnly}
                >
                  <Text style={styles.btnHeroGreenText}>⏱️ ลงเวลาเข้าเท่านั้น</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Tertiary Button: จบรายการ */}
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              activeOpacity={0.85}
              onPress={onFinish}
            >
              <Text style={styles.btnGhostText}>✕ จบรายการ</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWarning: {
    backgroundColor: '#FEF3C7',
  },
  iconSuccess: {
    backgroundColor: '#DCFCE7',
  },
  iconEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollArea: {
    width: '100%',
    maxHeight: 250,
  },
  bodyContainer: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowColumn: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 6,
  },
  value: {
    fontSize: 15,
    color: '#374151',
    flexShrink: 1,
  },
  valueBold: {
    fontWeight: '600',
    color: '#111827',
  },
  textSuccess: {
    fontWeight: '700',
    color: '#16A34A',
  },
  textWarning: {
    fontWeight: '700',
    color: '#D97706',
  },
  subDetailText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  passIdText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#4B5563',
  },
  actionsContainer: {
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  btn: {
    width: '100%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnHeroGreen: {
    height: 56,
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnHeroGreenText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnSecondaryBlue: {
    height: 48,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  btnSecondaryBlueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  btnGhost: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  retryBannerBtn: {
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
});
