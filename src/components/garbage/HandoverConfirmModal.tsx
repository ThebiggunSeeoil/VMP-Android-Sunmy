import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';

export interface HandoverConfirmModalProps {
  visible: boolean;
  targetHouseNumber: string;
  selectedCount: number;
  totalBags: number;
  totalCards: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const HandoverConfirmModal: React.FC<HandoverConfirmModalProps> = ({
  visible,
  targetHouseNumber,
  selectedCount,
  totalBags,
  totalCards,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeRow}>
                <Text style={styles.systemBadge}>VMP</Text>
                <Text style={styles.headerSub}>SMART TERMINAL</Text>
              </View>
              <Text style={styles.headerTitle}>📦 ยืนยันการส่งมอบบริการ</Text>
            </View>
            <View style={styles.housePill}>
              <Text style={styles.housePillText}>🏠 {targetHouseNumber || '-'}</Text>
            </View>
          </View>

          {/* Content Body */}
          <View style={styles.body}>
            {/* Highlight Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryIconCircle}>
                  <Text style={styles.summaryIcon}>📦</Text>
                </View>
                <View style={styles.summaryTextGroup}>
                  <Text style={styles.summaryLabel}>จำนวนที่เลือกส่งมอบ</Text>
                  <Text style={styles.summaryValue}>{selectedCount} รายการ</Text>
                </View>
              </View>

              {/* Breakdown Pills */}
              <View style={styles.pillContainer}>
                {totalBags > 0 && (
                  <View style={styles.bagPill}>
                    <Text style={styles.pillIcon}>🗑️</Text>
                    <Text style={styles.bagPillText}>
                      ถุงขยะ <Text style={styles.pillBold}>{totalBags}</Text> ห่อ
                    </Text>
                  </View>
                )}
                {totalCards > 0 && (
                  <View style={styles.cardPill}>
                    <Text style={styles.pillIcon}>💳</Text>
                    <Text style={styles.cardPillText}>
                      คีย์การ์ด <Text style={styles.pillBold}>{totalCards}</Text> อัน
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Instruction Notice */}
            <View style={styles.noticeBox}>
              <Text style={styles.noticeIcon}>ℹ️</Text>
              <Text style={styles.noticeText}>
                กรุณาจัดเตรียมสิ่งของให้ลูกบ้านให้เรียบร้อย แล้วกด{' '}
                <Text style={styles.noticeBold}>"ถ่ายรูปส่งมอบ"</Text>{' '}
                เพื่อบันทึกภาพผู้รับเป็นหลักฐานในระบบ
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnIcon}>📷</Text>
                <Text style={styles.confirmBtnText}>
                  ถ่ายรูปส่งมอบ ({selectedCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flex: 1,
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
  housePill: {
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  housePillText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  summaryIcon: {
    fontSize: 22,
  },
  summaryTextGroup: {
    flex: 1,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  cardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pillIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  bagPillText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
  },
  cardPillText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  pillBold: {
    fontWeight: '900',
    fontSize: 14,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  noticeIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  noticeBold: {
    fontWeight: '900',
    color: '#78350F',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#047857',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  confirmBtnIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 6,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
