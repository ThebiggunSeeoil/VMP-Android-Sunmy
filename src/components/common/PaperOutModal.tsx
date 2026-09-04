import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { VisitorSlipData } from '../../hardware/SunmiPrinter';

export interface PaperOutModalProps {
  visible: boolean;
  slipData?: VisitorSlipData | null;
  isPrinting?: boolean;
  errorMessage?: string;
  onRetryPrint: () => void;
  onSkip: () => void;
}

export const PaperOutModal: React.FC<PaperOutModalProps> = ({
  visible,
  slipData,
  isPrinting = false,
  errorMessage,
  onRetryPrint,
  onSkip,
}) => {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Warning Icon Badge */}
          <View style={styles.iconWrapper}>
            <Text style={styles.iconEmoji}>🖨️</Text>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>!</Text>
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>
            {errorMessage?.includes('ฝา') ? 'ฝาเครื่องพิมพ์เปิดอยู่!' : 'กระดาษพิมพ์หมด!'}
          </Text>
          <Text style={styles.subtitle}>
            {errorMessage || 'ระบบบันทึกรายการสำเร็จแล้ว แต่เครื่องพิมพ์ไม่พร้อมทำงาน'}
          </Text>

          {/* Step-by-Step Instructions */}
          <View style={styles.instructionBox}>
            <Text style={styles.instructionHeader}>
              {errorMessage?.includes('ฝา') ? '📌 วิธีปิดฝาและพิมพ์สลิป:' : '📌 วิธีเปลี่ยนกระดาษและพิมพ์สลิป:'}
            </Text>
            {errorMessage?.includes('ฝา') ? (
              <>
                <Text style={styles.instructionStep}>1. ตรวจสอบว่ามีม้วนกระดาษความร้อนอยู่ภายใน</Text>
                <Text style={styles.instructionStep}>2. ดึงปลายกระดาษพ้นปากช่องเล็กน้อย</Text>
                <Text style={styles.instructionStep}>3. ปิดฝาช่องใส่กระดาษให้สนิทจนได้ยินเสียงคลิก</Text>
                <Text style={styles.instructionStep}>4. กดปุ่ม <Text style={styles.boldText}>"สั่งพิมพ์ซ้ำ"</Text> ด้านล่าง</Text>
              </>
            ) : (
              <>
                <Text style={styles.instructionStep}>1. เปิดฝาช่องใส่กระดาษด้านบนตัวเครื่อง</Text>
                <Text style={styles.instructionStep}>2. ใส่กระดาษความร้อนม้วนใหม่ (ขนาด 58 มม.)</Text>
                <Text style={styles.instructionStep}>3. ดึงปลายกระดาษออกเล็กน้อยแล้วปิดฝาให้สนิท</Text>
                <Text style={styles.instructionStep}>4. กดปุ่ม <Text style={styles.boldText}>"สั่งพิมพ์ซ้ำ"</Text> ด้านล่าง</Text>
              </>
            )}
          </View>

          {/* Visitor Info Summary (if available) */}
          {slipData && (
            <View style={styles.infoSummaryBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>บัตรเลขที่:</Text>
                <Text style={styles.infoValueBold}>{slipData.passId || '-'}</Text>
              </View>
              {slipData.visitorName && slipData.visitorName !== '-' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ผู้ติดต่อ:</Text>
                  <Text style={styles.infoValue}>{slipData.visitorName}</Text>
                </View>
              )}
              {slipData.houseNo && slipData.houseNo !== '-' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>บ้านเลขที่:</Text>
                  <Text style={styles.infoValue}>{slipData.houseNo}</Text>
                </View>
              )}
              {slipData.licensePlate && slipData.licensePlate !== '-' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ทะเบียนรถ:</Text>
                  <Text style={styles.infoValue}>{slipData.licensePlate}</Text>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            {/* Retry Print Button (Primary) */}
            <TouchableOpacity
              style={[styles.btnPrimary, isPrinting && styles.btnDisabled]}
              onPress={onRetryPrint}
              disabled={isPrinting}
              activeOpacity={0.85}
            >
              {isPrinting ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>กำลังส่งพิมพ์สลิป...</Text>
                </View>
              ) : (
                <Text style={styles.btnPrimaryText}>🖨️ ใส่กระดาษแล้ว — สั่งพิมพ์ซ้ำ</Text>
              )}
            </TouchableOpacity>

            {/* Skip Button (Secondary) */}
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={onSkip}
              disabled={isPrinting}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText}>ข้ามการพิมพ์ (ดำเนินการต่อ)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  iconWrapper: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconEmoji: {
    fontSize: 32,
  },
  alertBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  instructionBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  instructionHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  instructionStep: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '900',
    color: '#1D4ED8',
  },
  infoSummaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 8,
    marginBottom: 14,
    gap: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '700',
  },
  infoValueBold: {
    fontSize: 11.5,
    color: '#1D4ED8',
    fontWeight: '900',
  },
  buttonGroup: {
    width: '100%',
    gap: 8,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#1D4ED8',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
