import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

export interface ScanActionChoiceModalProps {
  visible: boolean;
  scannedCodes: string[];
  onSelectCheckIn: () => void;
  onSelectCheckOut: () => void;
  onRemoveCode?: (index: number) => void;
  onCancel: () => void;
}

function formatDisplayCode(rawCode: string): string {
  let displayCode = (rawCode || '').trim();
  if (displayCode.includes('pass_exchange?id=')) {
    displayCode = displayCode.split('pass_exchange?id=')[1].split('&')[0];
  } else if (displayCode.includes('?pk=')) {
    displayCode = displayCode.split('?pk=')[1].split('&')[0];
  } else if (displayCode.includes('?id=')) {
    displayCode = displayCode.split('?id=')[1].split('&')[0];
  } else if (displayCode.startsWith('*+') && displayCode.endsWith('+*')) {
    displayCode = displayCode.substring(2, displayCode.length - 2);
  }
  return displayCode;
}

export const ScanActionChoiceModal: React.FC<ScanActionChoiceModalProps> = ({
  visible,
  scannedCodes,
  onSelectCheckIn,
  onSelectCheckOut,
  onRemoveCode,
  onCancel,
}) => {
  if (!visible || !scannedCodes || scannedCodes.length === 0) return null;

  const count = scannedCodes.length;
  const isMultiple = count > 1;

  return (
    <View style={styles.overlay}>
      <View style={styles.modalCard}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <Text style={styles.systemBadge}>VMP</Text>
            <Text style={styles.headerSub}>
              {isMultiple ? `📦 BATCH SCAN • รวม ${count} ใบ` : 'SMART TERMINAL'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>
            {isMultiple ? `⚡ สะสมคิวสแกน (${count} ใบ)` : '⚡ ตรวจพบการสแกนบัตรผ่าน'}
          </Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Single Card View */}
          {!isMultiple ? (
            <View style={styles.codeCard}>
              <View style={styles.codeIconCircle}>
                <Text style={styles.codeIcon}>🎫</Text>
              </View>
              <View style={styles.codeDetails}>
                <Text style={styles.codeLabel}>รหัสบัตรที่สแกนได้</Text>
                <Text style={styles.codeValue} numberOfLines={1}>
                  #{formatDisplayCode(scannedCodes[0]) || '-'}
                </Text>
              </View>
            </View>
          ) : (
            /* Multi-Card Queue List View */
            <View style={styles.multiQueueBox}>
              <View style={styles.multiQueueHeader}>
                <Text style={styles.multiQueueTitle}>📋 รายการบัตรที่รอประมวลผล ({count} ใบ):</Text>
              </View>
              <ScrollView style={styles.multiQueueScroll} showsVerticalScrollIndicator={true}>
                {scannedCodes.map((code, idx) => (
                  <View key={`${code}-${idx}`} style={styles.queueItemRow}>
                    <View style={styles.queueItemNumBadge}>
                      <Text style={styles.queueItemNumText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.queueItemCode} numberOfLines={1}>
                      🎫 #{formatDisplayCode(code)}
                    </Text>
                    {onRemoveCode && (
                      <TouchableOpacity
                        style={styles.queueRemoveBtn}
                        onPress={() => onRemoveCode(idx)}
                        focusable={false}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.queueRemoveBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.batchTipText}>
                💡 สามารถยิงสแกนเนอร์เพิ่มได้เรื่อยๆ ก่อนกดเลือกทำรายการ
              </Text>
            </View>
          )}

          <Text style={styles.promptText}>
            {isMultiple ? `เลือกรายการสำหรับทั้ง ${count} ใบ:` : 'เลือกรายการที่ต้องการดำเนินการ:'}
          </Text>

          {/* 2 Big Focus Action Buttons: เข้า / ออก */}
          <View style={styles.actionButtonsRow}>
            {/* ปุ่ม: เข้า (IN) */}
            <TouchableOpacity
              style={styles.checkInBtn}
              onPress={onSelectCheckIn}
              activeOpacity={0.8}
              focusable={false}
            >
              <View style={styles.iconCircle}>
                <Text style={styles.btnIcon}>📥</Text>
              </View>
              <Text style={styles.btnMainTitle}>
                {isMultiple ? `เข้า (${count})` : 'เข้า'}
              </Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>
                  {isMultiple ? `IN • ${count} คัน` : 'IN'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* ปุ่ม: ออก (OUT) */}
            <TouchableOpacity
              style={styles.checkOutBtn}
              onPress={onSelectCheckOut}
              activeOpacity={0.8}
              focusable={false}
            >
              <View style={styles.iconCircle}>
                <Text style={styles.btnIcon}>📤</Text>
              </View>
              <Text style={styles.btnMainTitle}>
                {isMultiple ? `ออก (${count})` : 'ออก'}
              </Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>
                  {isMultiple ? `OUT • ${count} คัน` : 'OUT'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            activeOpacity={0.7}
            focusable={false}
          >
            <Text style={styles.cancelBtnText}>✕ ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  systemBadge: {
    backgroundColor: '#1E293B',
    color: '#38BDF8',
    fontSize: 9.5,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  body: {
    padding: 16,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  codeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  codeIcon: {
    fontSize: 20,
  },
  codeDetails: {
    flex: 1,
  },
  codeLabel: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  codeValue: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 1,
  },
  multiQueueBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  multiQueueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  multiQueueTitle: {
    color: '#1E293B',
    fontSize: 12.5,
    fontWeight: '800',
  },
  multiQueueScroll: {
    maxHeight: 130,
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 5,
  },
  queueItemNumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  queueItemNumText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '900',
  },
  queueItemCode: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '800',
  },
  queueRemoveBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueRemoveBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '900',
  },
  batchTipText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  promptText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  checkInBtn: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#60A5FA',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  checkOutBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#34D399',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  btnIcon: {
    fontSize: 22,
  },
  btnMainTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginVertical: 2,
    textAlign: 'center',
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 999,
    marginTop: 2,
  },
  tagBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
