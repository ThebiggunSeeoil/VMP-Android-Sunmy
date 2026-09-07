import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KeypadModal } from './KeypadModal';
import { vmsApi } from '../../api/vmsApi';
import { useAppStore } from '../../state/useAppStore';

interface TransactionEditModalProps {
  visible: boolean;
  transaction: any;
  houseNumbers?: string[];
  onClose: () => void;
  onSuccess: (updatedData: any) => void;
}

export const TransactionEditModal: React.FC<TransactionEditModalProps> = ({
  visible,
  transaction,
  houseNumbers = [],
  onClose,
  onSuccess,
}) => {
  const { guard } = useAppStore();
  const [selectedHouse, setSelectedHouse] = useState<string>('');
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && transaction) {
      setSelectedHouse(transaction.number_house || '');
      setSaving(false);
      setPreviewImage(null);
    }
  }, [visible, transaction]);

  if (!transaction) return null;

  const currentHouse = (transaction.number_house || '').trim();
  const isChanged = selectedHouse.trim() !== '' && selectedHouse.trim() !== currentHouse;

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const datePart = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} ${timePart} น.`;
    } catch {
      return isoStr;
    }
  };

  const handleSave = async () => {
    const finalHouse = selectedHouse.trim();
    if (!finalHouse) {
      Alert.alert('กรุณาระบุบ้านเลขที่', 'กรุณากดเลือกบ้านเลขที่ก่อนทำการบันทึก');
      return;
    }

    setSaving(true);
    try {
      const targetId = transaction.transaction_id || transaction.id;
      const res = await vmsApi.updateTransactionHouseNumber(targetId, {
        number_house: finalHouse,
        userId: guard?.userId,
        remark: 'ปรับปรุงบ้านเลขที่ผ่านหน้าหลัก Sunmi App',
        edit_source: 'sunmi_app_manual_edit',
      });

      setSaving(false);
      if (res.status) {
        onSuccess({
          ...transaction,
          number_house: finalHouse,
          ...(res.data || {}),
        });
      } else {
        Alert.alert('บันทึกไม่สำเร็จ', res.message || 'ไม่สามารถปรับปรุงบ้านเลขที่ได้');
      }
    } catch (e: any) {
      setSaving(false);
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Backend ได้');
    }
  };

  const isCheckedOut = transaction.is_checked_out || Boolean(transaction.checkout_datetime);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBadge}>
                <Text style={styles.headerIconEmoji}>📝</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>ปรับปรุงข้อมูลผู้ติดต่อ</Text>
                <Text style={styles.headerSub}>แก้ไขเฉพาะข้อมูลบ้านเลขที่</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Status & Code Bar */}
            <View style={styles.codeStatusBar}>
              <View style={styles.codeCol}>
                <Text style={styles.codeLabel}>รหัสอ้างอิง</Text>
                <Text style={styles.codeValue}>{transaction.raw_code || transaction.id?.slice(0, 10) || '-'}</Text>
              </View>
              <View style={[styles.statusBadge, isCheckedOut ? styles.statusBadgeOut : styles.statusBadgeIn]}>
                <Text style={[styles.statusBadgeText, isCheckedOut ? styles.statusBadgeTextOut : styles.statusBadgeTextIn]}>
                  {isCheckedOut ? '✅ ออกแล้ว (Check-Out)' : '🔵 อยู่ในโครงการ (In)'}
                </Text>
              </View>
            </View>

            {/* Editable House Number Section */}
            <View style={styles.editSectionCard}>
              <View style={styles.editHeaderRow}>
                <Text style={styles.editSectionTitle}>🏠 ข้อมูลบ้านเลขที่ (ปรับปรุง)</Text>
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>แก้ไขได้เฉพาะฟิลด์นี้</Text>
                </View>
              </View>

              {/* Current House Box */}
              <View style={styles.houseCompareRow}>
                <View style={styles.houseBoxOld}>
                  <Text style={styles.houseBoxLabel}>บ้านเลขที่เดิม</Text>
                  <Text style={[styles.houseBoxValue, !currentHouse && styles.houseBoxValueEmpty]}>
                    {currentHouse ? `🏠 ${currentHouse}` : '⚠️ ยังไม่ระบุ'}
                  </Text>
                </View>

                <Text style={styles.houseArrow}>➔</Text>

                <View style={[styles.houseBoxNew, isChanged && styles.houseBoxNewActive]}>
                  <Text style={styles.houseBoxLabel}>บ้านเลขที่ใหม่</Text>
                  <Text style={[styles.houseBoxValue, !selectedHouse && styles.houseBoxValuePlaceholder]}>
                    {selectedHouse ? `🏠 ${selectedHouse}` : 'ยังไม่ได้เลือก'}
                  </Text>
                </View>
              </View>

              {/* Tap to change house button */}
              <TouchableOpacity
                style={styles.selectHouseBtn}
                onPress={() => setShowKeypad(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.selectHouseBtnIcon}>⌨️</Text>
                <Text style={styles.selectHouseBtnText}>เลือกบ้านเลขที่</Text>
                <Text style={styles.selectHouseBtnArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Information Card (Read-Only Preview) */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <Text style={styles.infoSectionTitle}>รายละเอียดผู้ติดต่อ (พรีวิว)</Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>🚗 ทะเบียนรถ:</Text>
                  <Text style={styles.infoValueHighlight}>{transaction.car_number || '-'}</Text>
                </View>

                {Boolean(transaction.vehicle || transaction.color_vehicle) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>🚙 ยานพาหนะ:</Text>
                    <Text style={styles.infoValue}>
                      {[transaction.vehicle, transaction.color_vehicle].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>👤 ชื่อผู้ติดต่อ:</Text>
                  <Text style={styles.infoValue}>{transaction.name || '-'}</Text>
                </View>

                {Boolean(transaction.id_number) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>🪪 เลขบัตร ปชช.:</Text>
                    <Text style={styles.infoValue}>{transaction.id_number}</Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📋 เหตุผลการเข้า:</Text>
                  <Text style={styles.infoValueBold}>{transaction.reason_name || '-'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>⏰ เวลาเข้า:</Text>
                  <Text style={styles.infoValue}>{formatDateTime(transaction.checkin_datetime)}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>⏱️ เวลาออก:</Text>
                  <Text style={styles.infoValue}>{formatDateTime(transaction.checkout_datetime)}</Text>
                </View>
              </View>

              {/* Photo Thumbnails */}
              {(Boolean(transaction.picture_id_card) || Boolean(transaction.picture_car_number)) && (
                <View style={styles.photoContainer}>
                  <Text style={styles.photoHeaderLabel}>รูปถ่ายที่บันทึก:</Text>
                  <View style={styles.photoRow}>
                    {Boolean(transaction.picture_id_card) && (
                      <TouchableOpacity
                        style={styles.photoThumbWrapper}
                        onPress={() => setPreviewImage(transaction.picture_id_card)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: transaction.picture_id_card }} style={styles.photoThumb} />
                        <Text style={styles.photoThumbLabel}>บัตร ปชช.</Text>
                      </TouchableOpacity>
                    )}

                    {Boolean(transaction.picture_car_number) && (
                      <TouchableOpacity
                        style={styles.photoThumbWrapper}
                        onPress={() => setPreviewImage(transaction.picture_car_number)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: transaction.picture_car_number }} style={styles.photoThumb} />
                        <Text style={styles.photoThumbLabel}>ป้ายทะเบียน</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Edit History Section (if any past logs) */}
            {Array.isArray(transaction.edit_history) && transaction.edit_history.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>📜 ประวัติการปรับปรุงย้อนหลัง ({transaction.edit_history.length})</Text>
                {transaction.edit_history.map((log: any, idx: number) => (
                  <View key={log.id || idx} style={styles.historyRow}>
                    <Text style={styles.historyBullet}>•</Text>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyMainText}>
                        เปลี่ยนจาก <Text style={styles.historyOldText}>{log.old_number_house || '-'}</Text> ➔{' '}
                        <Text style={styles.historyNewText}>{log.new_number_house}</Text>
                      </Text>
                      <Text style={styles.historySubText}>
                        โดย {log.edited_by || 'รปภ.'} เมื่อ {log.created || '-'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.saveBtn, (!selectedHouse.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!selectedHouse.trim() || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.saveBtnIcon}>💾</Text>
                  <Text style={styles.saveBtnText}>ยืนยันบันทึกการปรับปรุง</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Keypad Modal (Enforce: canSubmitEmpty=false, hideUnknownHouse=true) */}
      <KeypadModal
        visible={showKeypad}
        title="ระบุบ้านเลขที่ (ปรับปรุงรายการ)"
        initialValue={selectedHouse}
        houseNumbers={houseNumbers}
        canSubmitEmpty={false}
        hideUnknownHouse={true}
        onConfirm={(val) => {
          if (val && val.trim()) {
            setSelectedHouse(val.trim());
          }
          setShowKeypad(false);
        }}
        onCancel={() => setShowKeypad(false)}
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={styles.imageOverlay}>
            <TouchableOpacity style={styles.imageCloseBtn} onPress={() => setPreviewImage(null)}>
              <Text style={styles.imageCloseText}>✕ ปิดรูป</Text>
            </TouchableOpacity>
            <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerIconEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  scrollBody: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  codeStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeCol: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1D4ED8',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeIn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusBadgeOut: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeTextIn: {
    color: '#1D4ED8',
  },
  statusBadgeTextOut: {
    color: '#059669',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.3,
  },
  infoGrid: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  infoValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  infoValueHighlight: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  photoContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  photoHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoThumbWrapper: {
    alignItems: 'center',
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoThumbLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 3,
  },
  editSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  editHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  editBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  houseCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 6,
  },
  houseBoxOld: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  houseBoxNew: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    alignItems: 'center',
  },
  houseBoxNewActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  houseBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  houseBoxValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  houseBoxValueEmpty: {
    color: '#D97706',
    fontSize: 12,
  },
  houseBoxValuePlaceholder: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  houseArrow: {
    fontSize: 16,
    fontWeight: '900',
    color: '#94A3B8',
  },
  selectHouseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  selectHouseBtnIcon: {
    fontSize: 18,
  },
  selectHouseBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  selectHouseBtnArrow: {
    fontSize: 18,
    fontWeight: '900',
    color: '#93C5FD',
    marginLeft: 2,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  historyBullet: {
    fontSize: 14,
    color: '#1D4ED8',
    marginRight: 6,
    lineHeight: 18,
  },
  historyContent: {
    flex: 1,
  },
  historyMainText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyOldText: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  historyNewText: {
    color: '#059669',
    fontWeight: '900',
  },
  historySubText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  footerActions: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnIcon: {
    fontSize: 16,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10,
  },
  imageCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
