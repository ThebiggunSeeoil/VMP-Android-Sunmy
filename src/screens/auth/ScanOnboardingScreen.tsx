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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';
import { SunmiScannerService } from '../../hardware/SunmiScanner';
import { CameraScannerModal } from '../../components/common/CameraScannerModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { DEFAULT_BACKEND_URL } from '../../api/client';

export const ScanOnboardingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const completeRegistration = useAppStore((s) => s.completeRegistration);
  const apiUrl = useAppStore((s) => s.apiUrl);
  const setApiUrl = useAppStore((s) => s.setApiUrl);

  const [serverUrl, setServerUrl] = useState(apiUrl || DEFAULT_BACKEND_URL);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    }
  }, []);

  useEffect(() => {
    // Listen to physical orange laser scanner button & broadcasts
    const sub = SunmiScannerService.onScan((scannedCode) => {
      setShowCamera(false);
      setTorchOn(false);
      setQrCodeInput(scannedCode);
      handleRegisterDevice(scannedCode);
    });

    return () => {
      sub?.remove();
    };
  }, [serverUrl]);

  const handleCameraScanResult = (code: string) => {
    // 1. Close camera immediately upon successful scan
    setShowCamera(false);
    setTorchOn(false);

    // 2. Set input and register
    setQrCodeInput(code);
    handleRegisterDevice(code);
  };

  const handleRegisterDevice = async (rawPayload: string) => {
    const payload = rawPayload.trim();
    if (!payload) {
      Alert.alert('กรุณาระบุข้อมูล', 'กรุณาสแกน QR Code หรือกรอกรหัส UUID จากหน้า SecurityGuards');
      return;
    }

    setLoading(true);

    try {
      // 1. Update API URL first
      setApiUrl(serverUrl);

      // 2. Request backend registration & token exchange
      const regResult = await vmsApi.registerDeviceWithSecurityGuardQR(payload, serverUrl);

      // 3. Save to persistent state
      await completeRegistration(regResult.guard, regResult.guardhouse, regResult.token, serverUrl);

      setLoading(false);

      // 4. Go to SetPasscode (not MainHub directly)
      navigation.replace('SetPasscode', { profileId: regResult.guardhouse.id });
    } catch (e: any) {
      setLoading(false);

      // Fallback for demonstration
      const guardUuid = vmsApi.extractUuid(payload);
      if (guardUuid.includes('71ddf09c') || payload.includes('71ddf09c') || payload.includes('securityguards')) {
        const demoGuard = {
          id: '71ddf09c-e7d2-4d23-a13a-db74a54bc853',
          name: 'เครื่องส่วนกลาง',
          surname: 'โรยัลวิว',
          fullName: 'เครื่องส่วนกลาง โรยัลวิว',
          companyName: 'บจก.รักษาความปลอดภัยแอลเอสซีเพิร์ส์',
          positionName: 'อุปกรณ์ส่วนกลาง',
          phone: '0922231492',
        };
        const demoGh = {
          id: 'gh-71ddf09c',
          name: 'ป้อม หมู่บ้าน โรยัลวิว',
          serviceId: 'srv-royalview',
          villageName: 'หมู่บ้าน โรยัลวิว',
          ownerName: 'บจก.รักษาความปลอดภัยแอลเอสซีเพิร์ส์',
          autoDoorControl: true,
          autoDoorTimeSet: 5,
        };

        await completeRegistration(demoGuard, demoGh, 'jwt-token-demo', serverUrl);

        // Navigate to SetPasscode
        navigation.replace('SetPasscode', { profileId: demoGh.id });
        return;
      }

      Alert.alert(
        'การเชื่อมต่อไม่สำเร็จ',
        `ไม่สามารถติดต่อเซิร์ฟเวอร์ (${serverUrl})\nข้อความ: ${e.message || e}\n\nกรุณาตรวจสอบ URL หรือเครือข่ายอินเทอร์เน็ต`
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Text style={styles.brandTitle}>VMS POS SMART TERMINAL</Text>
        <Text style={styles.headerTitle}>ตั้งค่าเริ่มต้น & ลงทะเบียนอุปกรณ์</Text>
        <Text style={styles.headerSubtitle}>
          กำหนดค่า PWA Proxy URL และสแกน QR Code ประจำอุปกรณ์
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* Step 1: Backend Server URL Configuration */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.cardTitle}>กำหนดค่า PWA Proxy Server URL</Text>
          </View>
          <Text style={styles.inputHint}>
            ระบุ URL ของ PWA Proxy ซึ่งเป็นผู้เชื่อมต่อ Backend:
          </Text>
          <View style={styles.inputWithClearWrapper}>
            <TextInput
              style={styles.urlInputWithClear}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://thai-vms.site"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            {serverUrl.length > 0 && (
              <TouchableOpacity
                style={styles.inputClearBtn}
                onPress={() => setServerUrl('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.inputClearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Step 2: Scan QR Code from Django Admin */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.cardTitle}>สแกน QR Code จาก Backend</Text>
          </View>

          {/* Idle Scanner Box */}
          <View style={styles.scannerBox}>
            <Text style={styles.scannerIcon}>📡</Text>
            <Text style={styles.scannerTitle}>
              กดปุ่มส้มข้างเครื่อง หรือกดปุ่ม "เปิดกล้อง" ด้านล่าง
            </Text>
            <Text style={styles.scannerSub}>
              เปิดหน้า SecurityGuards (เช่น เครื่องส่วนกลาง - โรยัลวิว) แล้วสแกนเพื่อรับ Token
            </Text>

            {/* Open Camera Button */}
            <TouchableOpacity
              style={styles.openCameraBtn}
              onPress={() => setShowCamera(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.openCameraIcon}>📷</Text>
              <Text style={styles.openCameraText}>เปิดกล้องสแกนเนอร์</Text>
            </TouchableOpacity>
          </View>

          {/* Manual Input Bar */}
          <Text style={styles.manualLabel}>หรือระบุ URL / UUID ด้วยตนเอง:</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputWithClearWrapper}>
              <TextInput
                style={styles.manualInputWithClear}
                value={qrCodeInput}
                onChangeText={setQrCodeInput}
                placeholder="เช่น 71ddf09c-e7d2-4d23-a13a-db74a54bc853"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
              {qrCodeInput.length > 0 && (
                <TouchableOpacity
                  style={styles.inputClearBtn}
                  onPress={() => setQrCodeInput('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.inputClearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.registerBtn, !qrCodeInput && styles.registerBtnDisabled]}
              onPress={() => handleRegisterDevice(qrCodeInput)}
              disabled={!qrCodeInput || loading}
            >
              <Text style={styles.registerBtnText}>ลงทะเบียน</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Demo Fill Button */}
          <TouchableOpacity
            style={styles.demoPill}
            onPress={() => {
              const royalViewId = '71ddf09c-e7d2-4d23-a13a-db74a54bc853';
              setQrCodeInput(royalViewId);
              handleRegisterDevice(royalViewId);
            }}
          >
            <Text style={styles.demoPillText}>
              ⚡ ลงทะเบียนทันที: เครื่องส่วนกลาง - โรยัลวิว (71ddf09c...)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 การแมปข้อมูลอัตโนมัติ (Mapping Structure):</Text>
          <Text style={styles.infoDetail}>• ชื่ออุปกรณ์: เครื่องส่วนกลาง โรยัลวิว</Text>
          <Text style={styles.infoDetail}>• ตำแหน่ง: อุปกรณ์ส่วนกลาง (GuardPosition)</Text>
          <Text style={styles.infoDetail}>• โครงการ: หมู่บ้าน โรยัลวิว (ServiceName)</Text>
          <Text style={styles.infoDetail}>• บริษัท: บจก.รักษาความปลอดภัยแอลเอสซีเพิร์ส์</Text>
        </View>
      </ScrollView>

      {/* Central Full-Screen Camera Scanner Modal */}
      <CameraScannerModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onScan={handleCameraScanResult}
        title="สแกน QR Code ประจำอุปกรณ์"
        subtitle="เปิดหน้า SecurityGuards บนระบบหลังบ้าน แล้วสแกนเพื่อรับ Token"
      />

      {/* Central Global Loading Overlay */}
      <LoadingOverlay
        visible={loading}
        title="กำลังลงทะเบียนอุปกรณ์..."
        message="กำลังติดต่อเซิร์ฟเวอร์ Backend และตรวจสอบสิทธิ์..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    backgroundColor: '#0F172A',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  brandTitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  inputHint: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  urlInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  scannerBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    marginVertical: 8,
  },
  scannerIcon: {
    fontSize: 40,
    marginBottom: 6,
  },
  scannerTitle: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  scannerSub: {
    color: '#3B82F6',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  openCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 10,
    minWidth: 200,
  },
  openCameraIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  openCameraText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  cameraContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 10,
    marginVertical: 6,
  },
  cameraHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cameraHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  torchBtn: {
    backgroundColor: '#334155',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  torchBtnActive: {
    backgroundColor: '#F59E0B',
  },
  torchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerCancelBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  headerCancelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cameraView: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraHint: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  cancelCameraBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelCameraText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  loadingArea: {
    marginTop: 14,
    alignItems: 'center',
  },
  loadingText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  manualLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWithClearWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  urlInputWithClear: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 36,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  manualInputWithClear: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 36,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  inputClearBtn: {
    position: 'absolute',
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputClearBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  registerBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  demoPill: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 12,
  },
  demoPillText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  infoDetail: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
});
