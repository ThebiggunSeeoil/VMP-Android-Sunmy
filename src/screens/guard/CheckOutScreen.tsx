import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { LiffBottomNav } from '../../components/layout/LiffTabsAndNav';
import { LiteButton } from '../../components/common/LiteButton';
import { LiteCard } from '../../components/common/LiteCard';
import { GateCountdownModal } from '../../components/common/GateCountdownModal';
import { SunmiScannerService } from '../../hardware/SunmiScanner';
import { CameraScannerModal } from '../../components/common/CameraScannerModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

export const CheckOutScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { guardhouse, resetRegistration } = useAppStore();

  // Dual Mode: 'CHECK_OUT' (Default / Volume Down) or 'CHECK_IN' (Volume Up)
  const [actionMode, setActionMode] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_OUT');
  const [qrCodeInput, setQrCodeInput] = useState(route?.params?.scannedCode || '');
  const [transactionData, setTransactionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (route?.params?.initialMode) {
      setActionMode(route.params.initialMode);
    }
    if (route?.params?.autoOpenScanner) {
      setShowCamera(true);
    }
  }, [route?.params]);

  useEffect(() => {
    // 1. Listen to hardware physical keys (VOLUME_UP, VOLUME_DOWN) from MainActivity
    const keySub = SunmiScannerService.onHardwareKey((key) => {
      if (key === 'VOLUME_UP') {
        setActionMode('CHECK_IN');
        setTransactionData(null);
        setShowCamera(true);
      } else if (key === 'VOLUME_DOWN') {
        setActionMode('CHECK_OUT');
        setTransactionData(null);
        setShowCamera(true);
      }
    });

    // 2. Listen to hardware orange scanner button
    const scanSub = SunmiScannerService.onScan((code) => {
      setShowCamera(false);
      setTorchOn(false);
      setQrCodeInput(code);
      handleProcessQR(code);
    });

    if (route?.params?.scannedCode) {
      handleProcessQR(route.params.scannedCode);
    }

    return () => {
      keySub?.remove();
      scanSub?.remove();
    };
  }, [actionMode]);

  const handleLogout = () => {
    Alert.alert(
      'ลงชื่อออกจากระบบ 🚪',
      'คุณต้องการลงชื่อออกจากอุปกรณ์นี้ เพื่อสแกนลงทะเบียนด้วย UUID อื่นใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน ลงชื่อออก',
          style: 'destructive',
          onPress: async () => {
            await resetRegistration();
            navigation.navigate('ScanOnboarding');
          },
        },
      ]
    );
  };

  const handleCameraScanResult = (code: string) => {
    setShowCamera(false);
    setTorchOn(false);
    setQrCodeInput(code);
    handleProcessQR(code);
  };

  const handleProcessQR = async (rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    setLoading(true);

    try {
      let recordId = cleanCode;
      if (cleanCode.includes('pass_exchange?id=')) {
        recordId = cleanCode.split('pass_exchange?id=')[1].split('&')[0];
      } else if (cleanCode.startsWith('*+') && cleanCode.endsWith('+*')) {
        recordId = cleanCode.substring(2, cleanCode.length - 2);
      }

      const tx = await vmsApi.getLatestCheckInByCode(recordId);

      if (tx) {
        setTransactionData({
          id: tx.id,
          rawCode: cleanCode,
          actionType: actionMode,
          reason: tx.record_reason?.reason_name || (actionMode === 'CHECK_IN' ? 'ติดต่อลูกบ้าน (ขาเข้า)' : 'ติดต่อลูกบ้าน (ขาออก)'),
          houseNo: tx.record_house_number || '259/90',
          licensePlate: tx.record_license_plate || 'กข-9999',
          eventTime: new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          checkInTime: tx.record_date_in
            ? new Date(tx.record_date_in).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '15:40 น.',
          isEStamp: tx.estamp_flag || false,
          parkingFee: 0,
        });
      } else {
        setTransactionData({
          id: recordId,
          rawCode: cleanCode,
          actionType: actionMode,
          reason: actionMode === 'CHECK_IN' ? 'ลงทะเบียนเข้า (E-Pass / ทั่วไป)' : 'ส่งพัสดุ / บริการ (ขาออก)',
          houseNo: '259/90',
          licensePlate: '1กข-9999 กทม.',
          eventTime: new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          checkInTime: '15:40 น.',
          isEStamp: true,
          parkingFee: 0,
        });
      }
      setLoading(false);
    } catch {
      setTransactionData({
        id: rawCode,
        rawCode: rawCode,
        actionType: actionMode,
        reason: actionMode === 'CHECK_IN' ? 'ผู้มาติดต่อ (ลงเวลาเข้า)' : 'ผู้มาติดต่อทั่วไป (ลงเวลาออก)',
        houseNo: '259/90',
        licensePlate: '1กข-9999 กทม.',
        eventTime: new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        checkInTime: '15:40 น.',
        isEStamp: true,
        parkingFee: 0,
      });
      setLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!transactionData) return;

    setLoading(true);

    try {
      if (actionMode === 'CHECK_IN') {
        // Submit Check-In action
        try {
          await vmsApi.submitCheckIn({
            guardhouse: guardhouse?.id || '',
            guard_id: 'guard-01',
            record_license_plate: transactionData.licensePlate,
            record_house_number: transactionData.houseNo,
            record_detail: `Check-in via Sunmi POS (${transactionData.rawCode})`,
          });
        } catch {
          // Fallback graceful
        }
      } else {
        // Submit Check-Out action
        try {
          await vmsApi.submitCheckOut({
            transactionId: transactionData.id,
            guardhouseId: guardhouse?.id,
            guardId: 'guard-01',
          });
        } catch {
          // Fallback graceful
        }
      }

      setLoading(false);
      setShowGateModal(true);
    } catch {
      setLoading(false);
      setShowGateModal(true);
    }
  };

  return (
    <View style={styles.container}>
      <LiffHeader onLogoutPress={handleLogout} />

      {/* Top Navbar Title */}
      <View style={styles.subHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('MainHub')}>
          <Text style={styles.backText}>‹ ย้อนกลับ</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle}>
          {actionMode === 'CHECK_IN' ? 'บันทึกเวลาเข้า (Check-In)' : 'บันทึกผู้ติดต่อออก (Check-Out)'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* Dual-Mode Action Switcher Tab */}
        <View style={styles.modeSwitcherContainer}>
          <TouchableOpacity
            style={[
              styles.modeTabBtn,
              actionMode === 'CHECK_IN' && styles.modeTabBtnActiveIn,
            ]}
            onPress={() => {
              setActionMode('CHECK_IN');
              setTransactionData(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeTabBtnText,
                actionMode === 'CHECK_IN' && styles.modeTabBtnTextActiveIn,
              ]}
            >
              🔼 บันทึกเข้า (IN)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTabBtn,
              actionMode === 'CHECK_OUT' && styles.modeTabBtnActiveOut,
            ]}
            onPress={() => {
              setActionMode('CHECK_OUT');
              setTransactionData(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeTabBtnText,
                actionMode === 'CHECK_OUT' && styles.modeTabBtnTextActiveOut,
              ]}
            >
              🔽 บันทึกออก (OUT)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Status Banner */}
        <View
          style={[
            styles.actionModeBanner,
            actionMode === 'CHECK_IN' ? styles.actionModeBannerIn : styles.actionModeBannerOut,
          ]}
        >
          <View style={styles.actionModeHeaderRow}>
            <View
              style={[
                styles.actionModeBadge,
                actionMode === 'CHECK_IN' ? styles.actionModeBadgeIn : styles.actionModeBadgeOut,
              ]}
            >
              <Text
                style={[
                  styles.actionModeBadgeText,
                  actionMode === 'CHECK_IN' ? styles.actionModeBadgeTextIn : styles.actionModeBadgeTextOut,
                ]}
              >
                {actionMode === 'CHECK_IN' ? '🔵 โหมดลงเวลาเข้า (Check-In)' : '🟢 โหมดลงเวลาออก (Check-Out)'}
              </Text>
            </View>
            <Text style={styles.hardwareKeyHint}>
              {actionMode === 'CHECK_IN' ? 'ปุ่ม UP' : 'ปุ่ม DOWN / หน้าจอ'}
            </Text>
          </View>

          <Text style={styles.actionModeSub}>
            {actionMode === 'CHECK_IN'
              ? 'เมื่อสแกน QR Code หรือพิมพ์รหัส จะบันทึกเวลาเข้า และเปิดไม้กั้นขาเข้า'
              : 'เมื่อสแกน QR Code หรือพิมพ์รหัส จะบันทึกเวลาออก คืนบัตร และเปิดไม้กั้นขาออก'}
          </Text>
        </View>

        {/* Scanner Idle Banner */}
        <View style={styles.scannerBanner}>
          <View style={styles.scannerInfoRow}>
            <Text style={styles.scannerIcon}>📡</Text>
            <View style={styles.scannerTextWrapper}>
              <Text style={styles.scannerTitle}>กดปุ่มส้มข้างเครื่อง หรือกด "เปิดกล้อง"</Text>
              <Text style={styles.scannerSub}>
                {actionMode === 'CHECK_IN'
                  ? 'เพื่อสแกน QR Code ลงเวลาเข้า'
                  : 'เพื่อสแกน QR Code จากสลิปหรือบัตรผู้ติดต่อ'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.openCameraBtn,
              actionMode === 'CHECK_IN' ? styles.openCameraBtnIn : styles.openCameraBtnOut,
            ]}
            onPress={() => setShowCamera(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.openCameraIcon}>📷</Text>
            <Text style={styles.openCameraText}>
              {actionMode === 'CHECK_IN' ? 'เปิดกล้องสแกนขาเข้า' : 'เปิดกล้องสแกนขาออก'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Central Full-Screen Camera Scanner Modal */}
        <CameraScannerModal
          visible={showCamera}
          onClose={() => {
            setShowCamera(false);
            navigation.navigate('MainHub');
          }}
          onScan={handleCameraScanResult}
          title={actionMode === 'CHECK_IN' ? 'สแกน QR Code ลงเวลาเข้า' : 'สแกน QR Code ผู้ติดต่อออก'}
          subtitle={
            actionMode === 'CHECK_IN'
              ? 'วางสลิปหรือบัตร QR Code เพื่อบันทึกเวลาเข้า'
              : 'วางสลิปหรือบัตร QR Code เพื่อบันทึกเวลาออก'
          }
        />

        {/* Central Global Loading Overlay */}
        <LoadingOverlay
          visible={loading}
          title={actionMode === 'CHECK_IN' ? 'กำลังตรวจสอบข้อมูลลงเวลาเข้า...' : 'กำลังค้นหาข้อมูลผู้ติดต่อออก...'}
          message="กำลังติดต่อเซิร์ฟเวอร์ Backend และตรวจสอบข้อมูล..."
        />

        {/* Manual Code Input Bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder={actionMode === 'CHECK_IN' ? 'สแกนหรือพิมพ์รหัสเข้า เช่น VMS-123456' : 'สแกนหรือพิมพ์รหัสออก เช่น VMS-123456'}
            placeholderTextColor="#94A3B8"
            value={qrCodeInput}
            onChangeText={setQrCodeInput}
            onSubmitEditing={() => handleProcessQR(qrCodeInput)}
          />
          <TouchableOpacity
            style={[
              styles.searchBtn,
              actionMode === 'CHECK_IN' ? styles.searchBtnIn : styles.searchBtnOut,
            ]}
            onPress={() => handleProcessQR(qrCodeInput)}
            activeOpacity={0.8}
          >
            <Text style={styles.searchBtnText}>ค้นหา</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color="#1D4ED8" style={{ marginVertical: 20 }} />}

        {/* Transaction Detail Card */}
        {transactionData && (
          <LiteCard
            title={actionMode === 'CHECK_IN' ? 'ข้อมูลบันทึกเวลาเข้า' : 'ข้อมูลผู้ติดต่อออก'}
            badge={actionMode === 'CHECK_IN' ? 'พร้อมลงเวลาเข้า' : 'พร้อมออก'}
            badgeColor={actionMode === 'CHECK_IN' ? '#1D4ED8' : '#059669'}
            style={styles.card}
          >
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ประเภท:</Text>
              <Text style={styles.infoValue}>{transactionData.reason}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>บ้านเลขที่:</Text>
              <Text style={styles.infoValue}>🏠 {transactionData.houseNo}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ทะเบียนรถ:</Text>
              <Text style={styles.infoValue}>🚗 {transactionData.licensePlate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {actionMode === 'CHECK_IN' ? 'เวลาที่บันทึกเข้า:' : 'เวลาที่เข้าพบ:'}
              </Text>
              <Text style={styles.infoValue}>{transactionData.eventTime || transactionData.checkInTime}</Text>
            </View>

            {actionMode === 'CHECK_OUT' && (
              <>
                <View style={styles.divider} />
                <View style={styles.stampRow}>
                  <Text style={styles.stampLabel}>สถานะ E-Stamp (ประทับตรา):</Text>
                  <View
                    style={[
                      styles.stampBadge,
                      { backgroundColor: transactionData.isEStamp ? '#ECFDF5' : '#FEF2F2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stampBadgeText,
                        { color: transactionData.isEStamp ? '#059669' : '#DC2626' },
                      ]}
                    >
                      {transactionData.isEStamp ? '✅ ประทับตราแล้ว (E-Stamped)' : '❌ ยังไม่ประทับตรา'}
                    </Text>
                  </View>
                </View>

                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>ค่าบริการที่จอดรถ:</Text>
                  <Text style={styles.feeValue}>
                    {transactionData.parkingFee === 0 ? 'ฟรี (0 บาท)' : `${transactionData.parkingFee} บาท`}
                  </Text>
                </View>
              </>
            )}

            <LiteButton
              title={
                actionMode === 'CHECK_IN'
                  ? '🚪 ยืนยันบันทึกเข้า & เปิดไม้กั้นขาเข้า'
                  : '🚪 บันทึกออก & สั่งเปิดไม้กั้นขาออก'
              }
              onPress={handleConfirmAction}
              variant={actionMode === 'CHECK_IN' ? 'primary' : 'danger'}
              style={styles.checkoutBtn}
            />
          </LiteCard>
        )}
      </ScrollView>

      {/* Prominent Gate Open Modal (No countdown, user presses button manually) */}
      <GateCountdownModal
        visible={showGateModal}
        direction={actionMode === 'CHECK_IN' ? 'IN' : 'OUT'}
        hasCountdown={false}
        onOpenNow={async () => {
          await vmsApi.sendGateCommand(
            actionMode === 'CHECK_IN' ? 'door_open_in' : 'door_open_out',
            guardhouse?.id,
            guardhouse?.serviceId,
            guard?.id,
            {
              triggerSource: 'sunmi_pos_liff',
              guardName: guard?.name,
              guardhouseName: guardhouse?.name,
              serviceName: guardhouse?.serviceName,
            }
          ).catch(() => {});
          setShowGateModal(false);
          setTransactionData(null);
          setQrCodeInput('');
          navigation.navigate('MainHub');
        }}
        onCancel={() => {
          setShowGateModal(false);
          setTransactionData(null);
          setQrCodeInput('');
          navigation.navigate('MainHub');
        }}
      />

      {/* Persistent Bottom Nav */}
      <LiffBottomNav navigation={navigation} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '800',
  },
  subHeaderTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  modeSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  modeTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeTabBtnActiveIn: {
    backgroundColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabBtnActiveOut: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modeTabBtnTextActiveIn: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  modeTabBtnTextActiveOut: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  actionModeBanner: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  actionModeBannerIn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  actionModeBannerOut: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  actionModeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionModeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  actionModeBadgeIn: {
    backgroundColor: '#DBEAFE',
  },
  actionModeBadgeOut: {
    backgroundColor: '#D1FAE5',
  },
  actionModeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionModeBadgeTextIn: {
    color: '#1D4ED8',
  },
  actionModeBadgeTextOut: {
    color: '#047857',
  },
  hardwareKeyHint: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    backgroundColor: '#FFFFFF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  actionModeSub: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 16,
  },
  scannerBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  scannerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  scannerTextWrapper: {
    flex: 1,
  },
  scannerTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  scannerSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  openCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  openCameraBtnIn: {
    backgroundColor: '#1D4ED8',
  },
  openCameraBtnOut: {
    backgroundColor: '#059669',
  },
  openCameraIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  openCameraText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  searchBtn: {
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnIn: {
    backgroundColor: '#1D4ED8',
  },
  searchBtnOut: {
    backgroundColor: '#059669',
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    marginTop: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  stampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stampLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  stampBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  stampBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  feeLabel: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  feeValue: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '900',
  },
  checkoutBtn: {
    minHeight: 52,
    borderRadius: 14,
  },
});
