import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';

interface GarbageDetailModalProps {
  visible: boolean;
  item: any | null;
  onClose: () => void;
}

export const GarbageDetailModal: React.FC<GarbageDetailModalProps> = ({
  visible,
  item,
  onClose,
}) => {
  if (!visible || !item) return null;

  const isBag = item.bill_type === 'Bag';
  const typeLabel = isBag ? 'ถุงขยะ' : 'คีย์การ์ด';
  const typeCount = isBag ? item.bag_no || 0 : item.card_no || 0;
  const isPaid = Boolean(item.paid_status || item.job_type === 'received');

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'ไม่มีข้อมูล') return '-';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleString('th-TH');
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Hero Header */}
          <View style={styles.heroHeader}>
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrowText}>RESIDENT SERVICE DETAIL</Text>
              <View style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                <Text style={[styles.statusBadgeText, isPaid ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                  {isPaid ? '✅ สำเร็จ' : '⏳ รอนำจ่าย'}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{typeLabel}</Text>
            <View style={styles.housePill}>
              <Text style={styles.housePillText}>🏠 บ้านเลขที่ {item.bag_contorl_house_number_local || '-'}</Text>
            </View>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Stat Summary Cards */}
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>ประเภท</Text>
                <Text style={styles.statValue}>{isBag ? '🗑️ ถุงขยะ' : '💳 คีย์การ์ด'}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>จำนวนรวม</Text>
                <Text style={[styles.statValue, isPaid ? styles.statValuePaid : styles.statValuePending]}>
                  {typeCount} {isBag ? 'ห่อ' : 'อัน'}
                </Text>
              </View>
            </View>

            {/* Info Table */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>รหัสรายการ</Text>
                <Text style={styles.infoValue}>#{item.id}</Text>
              </View>

              {item.invoice_number && item.invoice_number !== 'ไม่มีข้อมูล' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>เลขที่ใบเสร็จ</Text>
                  <Text style={styles.infoValue}>{item.invoice_number}</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>วันที่ชำระเงิน</Text>
                <Text style={styles.infoValue}>{formatDate(item.received_date || item.created)}</Text>
              </View>

              {item.receive_user_displayName && item.receive_user_displayName !== 'ไม่มีข้อมูล' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ผู้ทำรายการ</Text>
                  <Text style={styles.infoValue}>{item.receive_user_displayName}</Text>
                </View>
              )}

              {isPaid && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>วันที่ส่งมอบ</Text>
                    <Text style={[styles.infoValue, styles.highlightValue]}>{formatDate(item.paid_date_get)}</Text>
                  </View>

                  {item.paid_user_displayName && item.paid_user_displayName !== 'ไม่มีข้อมูล' && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>ผู้ส่งมอบ</Text>
                      <Text style={styles.infoValue}>{item.paid_user_displayName}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Paid Photo Preview if available */}
            {item.paid_picture && item.paid_picture !== 'ไม่มีข้อมูล' && item.paid_picture.startsWith('http') && (
              <View style={styles.photoCard}>
                <Text style={styles.photoTitle}>📷 รูปถ่ายหลักฐานการส่งมอบ</Text>
                <Image
                  source={{ uri: item.paid_picture }}
                  style={styles.photoImg}
                  resizeMode="cover"
                />
              </View>
            )}
          </ScrollView>

          {/* Close Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>ปิดหน้าต่าง</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  heroHeader: {
    backgroundColor: '#4C1D95',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  eyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eyebrowText: {
    color: '#DDD6FE',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgePaid: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  statusBadgeTextPaid: {
    color: '#166534',
  },
  statusBadgeTextPending: {
    color: '#92400E',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  housePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  housePillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollBody: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  statValue: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '900',
  },
  statValuePaid: {
    color: '#16A34A',
  },
  statValuePending: {
    color: '#D97706',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
  infoValue: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '800',
    maxWidth: '60%',
    textAlign: 'right',
  },
  highlightValue: {
    color: '#16A34A',
    fontWeight: '900',
  },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  photoTitle: {
    color: '#4C1D95',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  photoImg: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    backgroundColor: '#6D28D9',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
