import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface GarbageChoiceViewProps {
  onScanQR: () => void;
  onEnterHouseNumber: () => void;
  onCancel: () => void;
}

export const GarbageChoiceView: React.FC<GarbageChoiceViewProps> = ({
  onScanQR,
  onEnterHouseNumber,
  onCancel,
}) => {
  return (
    <View style={styles.container}>
      {/* Title Header */}
      <View style={styles.titleSection}>
        <Text style={styles.eyebrow}>RESIDENT SERVICE</Text>
        <Text style={styles.mainTitle}>จัดการถุงขยะ / คีย์การ์ด</Text>
        <Text style={styles.subtitle}>เลือกวิธีค้นหารายการของลูกบ้าน</Text>
      </View>

      {/* Buttons Options */}
      <View style={styles.buttonList}>
        {/* Scan QR Option (Primary Gradient Style) */}
        <TouchableOpacity
          style={[styles.choiceBtn, styles.choiceBtnPrimary]}
          onPress={onScanQR}
          activeOpacity={0.85}
        >
          <View style={[styles.iconBox, styles.iconBoxPrimary]}>
            <Text style={styles.iconText}>📷</Text>
          </View>
          <View style={styles.copyBox}>
            <Text style={[styles.btnTitle, styles.btnTitlePrimary]}>สแกน QR Code</Text>
            <Text style={[styles.btnHint, styles.btnHintPrimary]}>อ่าน QR Code จากลูกบ้านเพื่อค้นหารายการ</Text>
          </View>
          <Text style={[styles.arrowIcon, styles.arrowIconPrimary]}>›</Text>
        </TouchableOpacity>

        {/* Enter House Number Option */}
        <TouchableOpacity
          style={[styles.choiceBtn, styles.choiceBtnSecondary]}
          onPress={onEnterHouseNumber}
          activeOpacity={0.85}
        >
          <View style={[styles.iconBox, styles.iconBoxSecondary]}>
            <Text style={styles.iconText}>🔢</Text>
          </View>
          <View style={styles.copyBox}>
            <Text style={[styles.btnTitle, styles.btnTitleSecondary]}>ป้อนบ้านเลขที่</Text>
            <Text style={styles.btnHint}>ค้นหาด้วยเลขบ้านแทนการสแกน</Text>
          </View>
          <Text style={styles.arrowIcon}>›</Text>
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={[styles.choiceBtn, styles.choiceBtnCancel]}
          onPress={onCancel}
          activeOpacity={0.85}
        >
          <View style={[styles.iconBox, styles.iconBoxCancel]}>
            <Text style={styles.iconText}>✕</Text>
          </View>
          <View style={styles.copyBox}>
            <Text style={[styles.btnTitle, styles.btnTitleCancel]}>ยกเลิก</Text>
            <Text style={styles.btnHint}>กลับไปยังเมนูปฏิบัติงาน</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    color: '#6D28D9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mainTitle: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonList: {
    gap: 12,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 76,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  choiceBtnPrimary: {
    backgroundColor: '#6D28D9',
    borderColor: '#5B21B6',
  },
  choiceBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  choiceBtnCancel: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    shadowOpacity: 0,
    elevation: 0,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconBoxPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconBoxSecondary: {
    backgroundColor: '#EDE9FE',
  },
  iconBoxCancel: {
    backgroundColor: '#FEE2E2',
  },
  iconText: {
    fontSize: 22,
  },
  copyBox: {
    flex: 1,
  },
  btnTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  btnTitlePrimary: {
    color: '#FFFFFF',
  },
  btnTitleSecondary: {
    color: '#1E293B',
  },
  btnTitleCancel: {
    color: '#DC2626',
  },
  btnHint: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  btnHintPrimary: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  arrowIcon: {
    fontSize: 26,
    fontWeight: '800',
    color: '#94A3B8',
    marginLeft: 6,
  },
  arrowIconPrimary: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
