import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { GuardProfileCard } from '../../components/layout/LiffHeader';
import { SunmiPrinterService } from '../../hardware/SunmiPrinter';
import { SunmiScannerService } from '../../hardware/SunmiScanner';
import { BluetoothSppService, BluetoothConnectionStatus, BluetoothDeviceItem } from '../../hardware/BluetoothSppScanner';
import { BluetoothDeviceModal } from '../../components/common/BluetoothDeviceModal';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi, cacheControl, CacheConfig, checkoutDebugTracker, CheckoutDebugSession } from '../../api/vmsApi';
import { AppUpdateService, UpdateCheckResult } from '../../updates/AppUpdateService';

type BackendPayloads = {
  guardDetail: unknown | null;
  entryReasons: unknown | null;
  requiredFields: unknown | null;
};

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    config,
    setLiteMode,
    showPhotoPreview,
    setShowPhotoPreview,
    visitorPassIssueMethod,
    setVisitorPassIssueMethod,
    innerPrinterPayloadMode,
    setInnerPrinterPayloadMode,
    requireHouseForGate,
    setRequireHouseForGate,
    enableGateControl,
    setEnableGateControl,
    autoCheckIn,
    setAutoCheckIn,
    debugMode,
    setDebugMode,
    printerConnected,
    setPrinterConnected,
    bluetoothScannerMode,
    setBluetoothScannerMode,
    bluetoothScannerDevice,
    setBluetoothScannerDevice,
    apiUrl,
    setApiUrl,
    resetRegistration,
    guard,
    guardhouse,
    profiles,
    activeProfileId,
  } = useAppStore();

  const [debugLogsRefresh, setDebugLogsRefresh] = useState(0);

  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [lastScannedCode, setLastScannedCode] = useState('-');
  const [testingPrint, setTestingPrint] = useState(false);
  const [showBtModal, setShowBtModal] = useState(false);
  const [btStatus, setBtStatus] = useState<BluetoothConnectionStatus>({ connected: false });
  const [loadingBackendPayloads, setLoadingBackendPayloads] = useState(false);
  const [backendPayloadError, setBackendPayloadError] = useState<string | null>(null);
  const [lastBackendSync, setLastBackendSync] = useState<string | null>(null);
  const [updateMetadataUrl, setUpdateMetadataUrl] = useState('');
  const [updateUrlInput, setUpdateUrlInput] = useState('');
  const [updateCheckResult, setUpdateCheckResult] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [backendPayloads, setBackendPayloads] = useState<BackendPayloads>({
    guardDetail: null,
    entryReasons: null,
    requiredFields: null,
  });

  // Cache settings
  const [cacheConfig, setCacheConfigState] = useState<CacheConfig>(cacheControl.getConfig());
  const [cacheStats, setCacheStats] = useState(cacheControl.getStats());
  const [ttlInput, setTtlInput] = useState(String(cacheControl.getConfig().ttlMinutes));

  const refreshCacheStats = () => setCacheStats(cacheControl.getStats());

  // Load persisted cache config from AsyncStorage on mount
  // (fixes race condition where useState initialises before async load)
  useEffect(() => {
    cacheControl.loadFromStorage().then(() => {
      const cfg = cacheControl.getConfig();
      setCacheConfigState(cfg);
      setTtlInput(String(cfg.ttlMinutes));
      refreshCacheStats();
    });

    const interval = setInterval(refreshCacheStats, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    AppUpdateService.getMetadataUrl()
      .then((url) => {
        setUpdateMetadataUrl(url);
        setUpdateUrlInput(url);
      })
      .catch(() => {});
  }, []);

  const handleToggleCache = (val: boolean) => {
    cacheControl.setConfig({ enabled: val });
    setCacheConfigState(cacheControl.getConfig());
    if (!val) cacheControl.clearAll();
    refreshCacheStats();
  };

  const handleSaveTtl = () => {
    const parsed = parseInt(ttlInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 60) {
      Alert.alert('ค่าไม่ถูกต้อง', 'กรอกเวลา Cache ระหว่าง 1 - 60 นาที');
      return;
    }
    cacheControl.setConfig({ ttlMinutes: parsed });
    cacheControl.clearAll(); // clear so next fetch uses new TTL
    setCacheConfigState(cacheControl.getConfig());
    setTtlInput(String(parsed)); // keep input in sync
    refreshCacheStats();
    Alert.alert('บันทึกสำเร็จ', `ตั้งเวลา Cache เป็น ${parsed} นาที\nข้อมูลเก่าถูกล้างแล้ว`);
  };

  const handleClearCache = () => {
    cacheControl.clearAll();
    refreshCacheStats();
    Alert.alert('ล้าง Cache สำเร็จ', 'ข้อมูล Cache ทั้งหมดถูกล้างแล้ว\nครั้งถัดไปจะดึงข้อมูลใหม่จาก Backend');
  };

  const handleSaveUpdateUrl = async () => {
    const savedUrl = await AppUpdateService.setMetadataUrl(updateUrlInput);
    setUpdateMetadataUrl(savedUrl);
    setUpdateUrlInput(savedUrl);
    setUpdateCheckResult(null);
    Alert.alert('บันทึกสำเร็จ', `ตั้งค่าแหล่งอัปเดตเป็น:\n${savedUrl}`);
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await AppUpdateService.checkForUpdate(updateMetadataUrl || updateUrlInput);
      setUpdateCheckResult(result);
      Alert.alert(result.hasUpdate ? 'พบอัปเดตใหม่' : 'ยังไม่มีอัปเดต', result.message);
    } catch (e: any) {
      Alert.alert('เช็กอัปเดตไม่สำเร็จ', e?.message || 'กรุณาตรวจสอบอินเทอร์เน็ตหรือ GitHub Release');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    const remote = updateCheckResult?.remote;
    if (!remote) {
      Alert.alert('ยังไม่มีข้อมูลอัปเดต', 'กรุณากดตรวจสอบอัปเดตก่อน');
      return;
    }

    const canInstall = await AppUpdateService.canInstallUnknownApps();
    if (!canInstall) {
      Alert.alert(
        'ต้องอนุญาตติดตั้ง APK',
        'Android ต้องเปิดสิทธิ์ Install unknown apps ให้ VMP ก่อน จึงจะติดตั้งไฟล์ APK จาก GitHub ได้',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'เปิดการตั้งค่า', onPress: () => AppUpdateService.openUnknownAppsSettings() },
        ]
      );
      return;
    }

    Alert.alert(
      'ติดตั้งอัปเดต VMP',
      `ต้องการดาวน์โหลดและติดตั้งเวอร์ชัน ${remote.versionName} ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ดาวน์โหลด',
          onPress: async () => {
            setInstallingUpdate(true);
            try {
              await AppUpdateService.downloadAndInstall(remote);
              Alert.alert('ดาวน์โหลดสำเร็จ', 'ระบบเปิดหน้าติดตั้ง APK แล้ว กรุณากดยืนยันบนเครื่อง');
            } catch (e: any) {
              Alert.alert('ติดตั้งไม่สำเร็จ', e?.message || 'ดาวน์โหลดหรือเปิดไฟล์ APK ไม่สำเร็จ');
            } finally {
              setInstallingUpdate(false);
            }
          },
        },
      ]
    );
  };

  const loadBackendPayloads = React.useCallback(async (forceRefresh: boolean = false) => {
    if (!guardhouse?.serviceId) {
      setBackendPayloadError('ยังไม่มีข้อมูลโครงการ กรุณาลงทะเบียนอุปกรณ์ก่อน');
      return;
    }

    setLoadingBackendPayloads(true);
    setBackendPayloadError(null);

    const [reasonsResult, fieldsResult, guardResult] = await Promise.allSettled([
      vmsApi.getEntryReasons(guardhouse.serviceId, forceRefresh),
      vmsApi.getRequiredFields(guardhouse.serviceId, forceRefresh),
      guard?.id ? vmsApi.getSecurityGuardDetail(guard.id) : Promise.resolve(null),
    ]);

    const failedRequests = [reasonsResult, fieldsResult, guardResult].filter(
      (result) => result.status === 'rejected'
    );

    setBackendPayloads({
      entryReasons: reasonsResult.status === 'fulfilled' ? reasonsResult.value : null,
      requiredFields: fieldsResult.status === 'fulfilled' ? fieldsResult.value : null,
      guardDetail: guardResult.status === 'fulfilled' ? guardResult.value : null,
    });
    setLastBackendSync(new Date().toLocaleString('th-TH'));
    setBackendPayloadError(
      failedRequests.length > 0
        ? `ดึงข้อมูลไม่สำเร็จ ${failedRequests.length} รายการ โปรดตรวจสอบเครือข่ายหรือสิทธิ์การเข้าถึง`
        : null
    );
    setLoadingBackendPayloads(false);
    refreshCacheStats();
  }, [guard?.id, guardhouse?.serviceId]);

  useEffect(() => {
    // Listen for live scan tests
    const sub = SunmiScannerService.onScan((code) => {
      setLastScannedCode(code);
      Alert.alert('สแกนสำเร็จ (Scanner OK)', `ตรวจพบโค้ด: ${code}`);
    });

    // Check SPP Bluetooth status and listen to changes
    BluetoothSppService.isConnected().then(setBtStatus);
    const btSub = BluetoothSppService.onStatusChange((status) => {
      setBtStatus(status);
    });

    // Auto connect to saved SPP device if configured
    if (bluetoothScannerMode === 'SPP' && bluetoothScannerDevice?.address) {
      BluetoothSppService.isConnected().then((res) => {
        if (!res.connected && bluetoothScannerDevice.address) {
          BluetoothSppService.connect(bluetoothScannerDevice.address).catch(() => {});
        }
      });
    }

    return () => {
      sub?.remove();
      btSub?.remove();
    };
  }, [bluetoothScannerMode, bluetoothScannerDevice?.address]);

  useEffect(() => {
    loadBackendPayloads();
  }, [loadBackendPayloads]);

  const requiredFields =
    backendPayloads.requiredFields && typeof backendPayloads.requiredFields === 'object'
      ? (backendPayloads.requiredFields as Record<string, unknown>)
      : {};
  const entryReasons = Array.isArray(backendPayloads.entryReasons)
    ? (backendPayloads.entryReasons as Array<Record<string, unknown>>)
    : [];
  const requiredFieldItems = [
    { key: 'reason_entry', label: 'เหตุผลการเข้า-ออก', icon: '📝' },
    { key: 'number_house', label: 'บ้านที่ติดต่อ', icon: '🏠' },
    { key: 'name', label: 'ชื่อผู้ติดต่อ', icon: '👤' },
    { key: 'id_number', label: 'เลขบัตรประชาชน', icon: '🪪' },
    { key: 'gender', label: 'เพศ', icon: '⚧️' },
    { key: 'vehicle', label: 'ทะเบียน / ประเภทรถ', icon: '🚗' },
    { key: 'color_vehicle', label: 'สีรถ', icon: '🎨' },
    { key: 'picture_id_card', label: 'รูปบัตรประชาชน', icon: '📷' },
    { key: 'picture_car_number', label: 'รูปทะเบียนรถ', icon: '📸' },
  ];

  const handleLockScreen = () => {
    const currentProfile = profiles.find(p => p.profileId === activeProfileId) || profiles[0];
    navigation.replace('PasscodeLogin', { profileId: currentProfile?.profileId });
  };

  const handleSwitchProfile = () => {
    navigation.replace('SelectProfile');
  };

  const handleLogout = () => {
    Alert.alert(
      'ลงชื่อออกจากระบบ 🚪',
      'ต้องการลงชื่อออกจากอุปกรณ์นี้ เพื่อสแกนลงทะเบียนด้วย UUID อื่นใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน ลงชื่อออก',
          style: 'destructive',
          onPress: async () => {
            await resetRegistration();
            navigation.replace('ScanOnboarding');
          },
        },
      ]
    );
  };

  const handleTestPrint = async () => {
    setTestingPrint(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('th-TH');
      const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      const success = await SunmiPrinterService.printVisitorSlip({
        serviceName: guardhouse?.villageName || 'MyVisitor',
        guardhouse: guardhouse?.name || 'Sunmi V2 Pro Inner Printer',
        passId: '72740921',
        visitorName: 'PWA Test',
        houseNo: '123/4',
        licensePlate: 'TEST-1234',
        reason: 'ทดสอบ Inner Printer',
        dateStr: now.toISOString().replace('Z', '+0700'),
        qrPayload: 'pass_exchange?id=TEST-72740921',
        legacyQrPayload: 'pass_exchange?id=TEST-72740921',
        payloadMode: innerPrinterPayloadMode,
      });

      setTestingPrint(false);
      if (success) {
        setPrinterConnected(true);
        Alert.alert('พิมพ์สำเร็จ', 'เครื่องพิมพ์ความร้อน Sunmi ทำงานปกติ');
      } else {
        Alert.alert('แจ้งเตือน', 'ไม่สามารถติดต่อเครื่องพิมพ์ได้ กรุณาตรวจสอบกระดาษ');
      }
    } catch (e: any) {
      setTestingPrint(false);
      Alert.alert('เกิดข้อผิดพลาด', e.message || 'พิมพ์ไม่สำเร็จ');
    }
  };

  const visitorPassMethodLabel =
    visitorPassIssueMethod === 'generated'
      ? '2. QR Code Generator'
      : visitorPassIssueMethod === 'visitor_card'
        ? '1. แลกบัตรปกติ'
        : 'ถามทุกครั้ง';

  const chooseVisitorPassMethod = () => {
    Alert.alert(
      'วิธีออกบัตรผู้ติดต่อ',
      'ตั้งค่าให้ตรงกับ PWA ของป้อมนี้',
      [
        { text: 'ถามทุกครั้ง', onPress: () => setVisitorPassIssueMethod('ask') },
        { text: '1. แลกบัตรปกติ', onPress: () => setVisitorPassIssueMethod('visitor_card') },
        { text: '2. QR Code Generator', onPress: () => setVisitorPassIssueMethod('generated') },
        { text: 'ยกเลิก', style: 'cancel' },
      ]
    );
  };

  const printerPayloadModeLabel =
    innerPrinterPayloadMode === 'short_token'
      ? 'Short Token QR + Barcode'
      : innerPrinterPayloadMode === 'hybrid'
        ? 'Hybrid: QR Legacy + Barcode Token'
        : 'Legacy QRCodePass UUID';

  const choosePrinterPayloadMode = () => {
    Alert.alert(
      'Inner Printer Payload Mode',
      'กำหนดรูปแบบ QR / Barcode สำหรับพิมพ์ตรงผ่าน Sunmi Inner Printer',
      [
        { text: 'Legacy QRCodePass UUID', onPress: () => setInnerPrinterPayloadMode('legacy') },
        { text: 'Short Token QR + Barcode', onPress: () => setInnerPrinterPayloadMode('short_token') },
        { text: 'Hybrid: QR Legacy + Barcode Token', onPress: () => setInnerPrinterPayloadMode('hybrid') },
        { text: 'ยกเลิก', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Clean Single Header for Settings */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerBadge}>VMS POS SMART TERMINAL</Text>
          <Text style={styles.headerTitle}>ตั้งค่าระบบ & ฮาร์ดแวร์</Text>
          <Text style={styles.headerSubtitle}>Sunmi V2 Pro Device Management</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: printerConnected ? '#10B981' : '#F59E0B' }]} />
          <Text style={styles.statusPillText}>{printerConnected ? 'POS ONLINE' : 'CHECK POS'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Guard Profile & Device Card */}
        <View style={styles.sectionBlock}>
          <GuardProfileCard
            onLockScreenPress={handleLockScreen}
            onLogoutPress={handleLogout}
            onSwitchProfilePress={handleSwitchProfile}
          />
        </View>

        {/* Per-Guardhouse Scope Notice */}
        <View style={styles.profileScopeNotice}>
          <Text style={styles.profileScopeIcon}>📍</Text>
          <Text style={styles.profileScopeText}>
            การตั้งค่าทั้งหมดด้านล่าง จะถูกบันทึกแยกเฉพาะป้อม: <Text style={styles.profileScopeBold}>{guardhouse?.name || 'ป้อมปัจจุบัน'} ({guardhouse?.villageName || ''})</Text>
          </Text>
        </View>

        {/* 2. Sunmi Hardware Control Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🛠️</Text>
            <Text style={styles.cardTitle}>ฮาร์ดแวร์เครื่องพิมพ์ & สแกนเนอร์</Text>
          </View>

          {/* Printer Row */}
          <View style={styles.hwRow}>
            <View style={styles.hwInfo}>
              <Text style={styles.hwName}>เครื่องพิมพ์ความร้อน (58mm Thermal Printer)</Text>
              <Text style={styles.hwSub}>
                สถานะ: {printerConnected ? '✅ พร้อมพิมพ์สลิปทันที' : '⏳ รอตรวจสอบการเชื่อมต่อ'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, testingPrint && styles.actionBtnDisabled]}
              onPress={handleTestPrint}
              disabled={testingPrint}
              activeOpacity={0.8}
            >
              {testingPrint ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionBtnText}>🖨️ ทดสอบพิมพ์</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          {/* Scanner Row */}
          <View style={styles.hwRow}>
            <View style={styles.hwInfo}>
              <Text style={styles.hwName}>สแกนเนอร์ปุ่มส้ม (Side Barcode Reader)</Text>
              <Text style={styles.hwSub}>
                ผลสแกนล่าสุด:{' '}
                <Text style={styles.codeHighlight}>{lastScannedCode}</Text>
              </Text>
            </View>
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>พร้อมสแกน</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Bluetooth Scanner Configuration */}
          <View style={styles.btScannerSection}>
            <View style={styles.btHeaderRow}>
              <Text style={styles.btSectionIcon}>🔵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.btSectionTitle}>สแกนเนอร์บลูทูธไร้สาย (Wireless Scanner)</Text>
                <Text style={styles.btSectionSub}>เลือกรูปแบบการเชื่อมต่อระหว่าง SPP หรือ HID</Text>
              </View>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.btModeSwitcher}>
              <TouchableOpacity
                style={[
                  styles.btModeTab,
                  bluetoothScannerMode === 'SPP' && styles.btModeTabActiveSpp,
                ]}
                onPress={() => setBluetoothScannerMode('SPP')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.btModeTabText,
                    bluetoothScannerMode === 'SPP' && styles.btModeTabTextActive,
                  ]}
                >
                  🔵 โหมด SPP (Serial Port)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btModeTab,
                  bluetoothScannerMode === 'HID' && styles.btModeTabActiveHid,
                ]}
                onPress={() => setBluetoothScannerMode('HID')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.btModeTabText,
                    bluetoothScannerMode === 'HID' && styles.btModeTabTextActive,
                  ]}
                >
                  ⌨️ โหมด HID (Keyboard)
                </Text>
              </TouchableOpacity>
            </View>

            {/* SPP Mode Details */}
            {bluetoothScannerMode === 'SPP' ? (
              <View style={styles.btDetailsCard}>
                <View style={styles.btStatusRow}>
                  <Text style={styles.btStatusLabel}>สถานะ SPP:</Text>
                  <View
                    style={[
                      styles.btStatusBadge,
                      btStatus.connected ? styles.btStatusBadgeConnected : styles.btStatusBadgeDisconnected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.btStatusBadgeText,
                        btStatus.connected ? styles.btStatusTextConnected : styles.btStatusTextDisconnected,
                      ]}
                    >
                      {btStatus.connected
                        ? `🟢 เชื่อมต่อแล้ว: ${btStatus.deviceName || bluetoothScannerDevice?.name || 'Scanner'}`
                        : '⚪ ยังไม่เชื่อมต่อ'}
                    </Text>
                  </View>
                </View>

                {bluetoothScannerDevice && (
                  <Text style={styles.btDeviceAddressText}>
                    อุปกรณ์ที่บันทึกไว้: {bluetoothScannerDevice.name} ({bluetoothScannerDevice.address})
                  </Text>
                )}

                <View style={styles.btActionBtnRow}>
                  <TouchableOpacity
                    style={styles.btSelectDeviceBtn}
                    onPress={() => setShowBtModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btSelectDeviceBtnText}>🔍 ค้นหา / เลือกอุปกรณ์บลูทูธ</Text>
                  </TouchableOpacity>

                  {btStatus.connected && (
                    <TouchableOpacity
                      style={styles.btDisconnectBtn}
                      onPress={async () => {
                        await BluetoothSppService.disconnect();
                        setBluetoothScannerDevice(null);
                        setBtStatus({ connected: false });
                        Alert.alert('ตัดการเชื่อมต่อแล้ว', 'ตัดการเชื่อมต่อสแกนเนอร์บลูทูธเรียบร้อย');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btDisconnectBtnText}>✕ ตัดการเชื่อมต่อ</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.btExplText}>
                  ℹ️ โหมด SPP อ่านค่าตรงผ่านบลูทูธพอร์ตซีเรียล (Serial Port) ไม่กระทบคีย์บอร์ดเสมือนบนหน้าจอ และรองรับการสแกนความเร็วสูง
                </Text>
              </View>
            ) : (
              <View style={styles.btDetailsCardHid}>
                <View style={styles.btStatusRow}>
                  <Text style={styles.btStatusLabel}>สถานะ HID:</Text>
                  <View style={styles.btStatusBadgeConnected}>
                    <Text style={styles.btStatusTextConnected}>
                      🟢 พร้อมรับค่า Keyboard Mode
                    </Text>
                  </View>
                </View>
                <Text style={styles.btExplTextHid}>
                  ℹ️ โหมด HID ทำงานเสมือนแป้นพิมพ์พิมพ์ข้อความอัตโนมัติ (กรุณาจับคู่บลูทูธสแกนเนอร์ใน "การตั้งค่า Bluetooth ของ Android" โดยตรง จากนั้นยิงสแกนได้ทันที)
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 3. System & Server Configuration Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🌐</Text>
            <Text style={styles.cardTitle}>การเชื่อมต่อเซิร์ฟเวอร์ & ประสิทธิภาพ</Text>
          </View>

          {/* Server URL Config */}
          <Text style={styles.inputLabel}>PWA Proxy Server URL:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="https://thai-vms.site"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.saveUrlBtn}
              onPress={() => {
                setApiUrl(inputUrl);
                Alert.alert('บันทึกสำเร็จ', `อัปเดต PWA Proxy URL เป็น:\n${inputUrl}`);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.saveUrlText}>บันทึก</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.updateBox}>
            <View style={styles.updateHeaderRow}>
              <View style={styles.updateTitleWrap}>
                <Text style={styles.updateTitle}>อัปเดตแอป VMP ผ่าน GitHub Release</Text>
                <Text style={styles.updateSub}>
                  {updateCheckResult
                    ? `เครื่องนี้: ${updateCheckResult.installed.versionName} (${updateCheckResult.installed.versionCode})`
                    : 'ใช้ไฟล์ APK จาก release ล่าสุดของ GitHub'}
                </Text>
              </View>
              {updateCheckResult?.hasUpdate ? (
                <View style={styles.updateAvailableBadge}>
                  <Text style={styles.updateAvailableText}>มีอัปเดต</Text>
                </View>
              ) : (
                <View style={styles.updateIdleBadge}>
                  <Text style={styles.updateIdleText}>GitHub</Text>
                </View>
              )}
            </View>

            <Text style={styles.inputLabel}>GitHub Release / version.json URL:</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={updateUrlInput}
                onChangeText={setUpdateUrlInput}
                placeholder="https://api.github.com/repos/.../releases/latest"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.saveUrlBtn}
                onPress={handleSaveUpdateUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.saveUrlText}>บันทึก</Text>
              </TouchableOpacity>
            </View>

            {updateCheckResult?.remote && (
              <View style={styles.updateResultCard}>
                <Text style={styles.updateResultTitle}>
                  ล่าสุด: {updateCheckResult.remote.versionName}
                </Text>
                {!!updateCheckResult.remote.publishedAt && (
                  <Text style={styles.updateResultMeta}>
                    Published: {new Date(updateCheckResult.remote.publishedAt).toLocaleString('th-TH')}
                  </Text>
                )}
                {!!updateCheckResult.remote.releaseNotes && (
                  <Text style={styles.updateReleaseNotes} numberOfLines={4}>
                    {updateCheckResult.remote.releaseNotes}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.updateActionRow}>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, checkingUpdate && styles.secondaryActionBtnDisabled]}
                onPress={handleCheckUpdate}
                disabled={checkingUpdate || installingUpdate}
                activeOpacity={0.8}
              >
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#1D4ED8" />
                ) : (
                  <Text style={styles.secondaryActionText}>ตรวจสอบอัปเดต</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  (!updateCheckResult?.hasUpdate || installingUpdate) && styles.actionBtnDisabled,
                ]}
                onPress={handleInstallUpdate}
                disabled={!updateCheckResult?.hasUpdate || installingUpdate}
                activeOpacity={0.8}
              >
                {installingUpdate ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionBtnText}>ดาวน์โหลด APK</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Lite Mode Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>โหมดเบาพิเศษ (Ultra-Lite Mode)</Text>
              <Text style={styles.switchSub}>
                {config.isLiteMode
                  ? 'เปิดอยู่: ลด Animation & Shadow ประหยัด RAM Sunmi'
                  : 'ปิดอยู่: แสดงผลกราฟิกและ Animation เต็มรูปแบบ'}
              </Text>
            </View>
            <Switch
              value={config.isLiteMode}
              onValueChange={(val) => setLiteMode(val)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={config.isLiteMode ? '#1D4ED8' : '#F1F5F9'}
            />
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>รูปแบบข้อมูล Sunmi Inner Printer</Text>
              <Text style={styles.switchSub}>
                พิมพ์ตรงจากเครื่อง พร้อม QR/Barcode โดยไม่ต้องส่งผ่าน VMS Bridge
              </Text>
            </View>
            <TouchableOpacity style={styles.passMethodBtn} onPress={choosePrinterPayloadMode} activeOpacity={0.8}>
              <Text style={styles.passMethodBtnText}>{printerPayloadModeLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>วิธีออกบัตรผู้ติดต่อ</Text>
              <Text style={styles.switchSub}>
                ใช้ค่าเดียวกับ PWA: QR Generator จะจอง/สร้าง QR ตามการตั้งค่าของป้อม
              </Text>
            </View>
            <TouchableOpacity style={styles.passMethodBtn} onPress={chooseVisitorPassMethod} activeOpacity={0.8}>
              <Text style={styles.passMethodBtnText}>{visitorPassMethodLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>แสดง Preview ภาพก่อนหรือไม่</Text>
              <Text style={styles.switchSub}>
                {showPhotoPreview
                  ? 'เปิดอยู่: ตรวจสอบรูป ถ่ายใหม่ หรือยืนยันก่อนไปขั้นตอนถัดไป'
                  : 'ปิดอยู่: หลังถ่ายรูป ระบบจะใช้รูปและไปขั้นตอนถัดไปทันที'}
              </Text>
            </View>
            <Switch
              value={showPhotoPreview}
              onValueChange={setShowPhotoPreview}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={showPhotoPreview ? '#1D4ED8' : '#F1F5F9'}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Debug ระบบ Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>Debug ระบบ</Text>
              <Text style={styles.switchSub}>
                {debugMode
                  ? 'เปิดอยู่: บันทึก Log และแสดงเวลาประมวลผล (Timing) ของบันทึกออกอย่างละเอียด'
                  : 'ปิดอยู่: ทำงานในโหมดมาตรฐาน ไม่แสดง Log เพิ่มเติม'}
              </Text>
            </View>
            <Switch
              value={debugMode}
              onValueChange={setDebugMode}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={debugMode ? '#1D4ED8' : '#F1F5F9'}
            />
          </View>

          {/* Recent Checkout Debug Logs (Visible when Debug Mode is ON) */}
          {debugMode && (
            <View style={styles.debugLogsCard}>
              <View style={styles.debugLogsHeader}>
                <View style={styles.debugLogsTitleRow}>
                  <Text style={styles.debugLogsIcon}>🔍</Text>
                  <Text style={styles.debugLogsTitle}>ประวัติ Log บันทึกออก (Check-Out)</Text>
                </View>
                <TouchableOpacity
                  style={styles.clearLogsBtn}
                  onPress={() => {
                    checkoutDebugTracker.clearLogs();
                    setDebugLogsRefresh((c) => c + 1);
                    Alert.alert('ล้าง Log สำเร็จ', 'ล้างประวัติ Log ทั้งหมดเรียบร้อยแล้ว');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearLogsBtnText}>ล้าง Log</Text>
                </TouchableOpacity>
              </View>

              {checkoutDebugTracker.getLogs().length === 0 ? (
                <Text style={styles.debugEmptyText}>
                  ยังไม่มีประวัติการสแกนบันทึกออก (ลองสแกน QR Code เพื่อดูผลลัพธ์ที่นี่)
                </Text>
              ) : (
                checkoutDebugTracker.getLogs().slice(0, 5).map((log, idx) => (
                  <View key={log.id || idx} style={styles.debugLogCardItem}>
                    <View style={styles.debugLogItemTop}>
                      <View style={styles.debugTimeBadge}>
                        <Text style={styles.debugTimeText}>🕒 {log.timestamp}</Text>
                      </View>
                      <View
                        style={[
                          styles.debugStatusBadge,
                          log.status ? styles.debugBadgeSuccess : styles.debugBadgeFailed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.debugStatusBadgeText,
                            log.status ? styles.debugTextSuccess : styles.debugTextFailed,
                          ]}
                        >
                          {log.status ? '✓ สำเร็จ' : '✕ ล้มเหลว'} · {log.totalDurationMs} ms
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.debugPassCodeText} numberOfLines={1}>
                      Pass ID: {log.passId || log.rawCode}
                    </Text>

                    <View style={styles.debugStepsBox}>
                      {log.steps.map((st, sIdx) => (
                        <View key={sIdx} style={styles.debugStepMiniRow}>
                          <Text style={styles.debugStepMiniName} numberOfLines={1}>
                            {st.stepNum}. {st.name}
                          </Text>
                          <Text
                            style={[
                              styles.debugStepMiniDuration,
                              st.status === 'SUCCESS' ? styles.debugTextSuccess : styles.debugTextFailed,
                            ]}
                          >
                            {st.durationMs}ms ({st.status === 'SUCCESS' ? 'OK' : 'ERR'})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Gate Control Policy Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🚧</Text>
            <Text style={styles.cardTitle}>เงื่อนไขควบคุมไม้กั้น (Gate Control Policy)</Text>
          </View>

          {/* ลงเวลาเข้าอัตโนมัติหรือไม่ */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>ลงเวลาเข้าอัตโนมัติหรือไม่</Text>
              <Text style={styles.switchSub}>
                {autoCheckIn
                  ? 'เปิดอยู่: เมื่อสร้างรายการสำเร็จ ระบบจะลงเวลาเข้าให้อัตโนมัติทันที และไปขั้นตอนเปิดไม้กั้น'
                  : 'ปิดอยู่: แสดงหน้าต่างสร้างรายการสำเร็จ เพื่อเลือกกดยืนยันด้วยตนเอง'}
              </Text>
            </View>
            <Switch
              value={autoCheckIn}
              onValueChange={setAutoCheckIn}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={autoCheckIn ? '#1D4ED8' : '#F1F5F9'}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* เปิดใช้งานจัดการไม้กั้นหรือไม่ */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>เปิดใช้งานจัดการไม้กั้นหรือไม่</Text>
              <Text style={styles.switchSub}>
                {enableGateControl
                  ? 'เปิดอยู่: แสดงเมนูจัดการไม้กั้นที่หน้าหลัก และแสดงปุ่มเปิดไม้กั้นเมื่อสร้างรายการสำเร็จ'
                  : 'ปิดอยู่: ซ่อนเมนูจัดการไม้กั้น และใช้ปุ่มลงเวลาเข้าเท่านั้น'}
              </Text>
            </View>
            <Switch
              value={enableGateControl}
              onValueChange={setEnableGateControl}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={enableGateControl ? '#1D4ED8' : '#F1F5F9'}
            />
          </View>

          {enableGateControl && <View style={styles.cardDivider} />}

          {enableGateControl && (
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrapper}>
                <Text style={styles.switchTitle}>ต้องการระบุบ้านเลขที่เพื่อสั่งไม้กั้น</Text>
                <Text style={styles.switchSub}>
                  {requireHouseForGate
                    ? 'เปิดอยู่: ต้องระบุและตรวจสอบบ้านเลขที่ในระบบก่อนเปิดไม้กั้น'
                    : 'ปิดอยู่: เปิดไม้กั้นได้ทันทีโดยไม่ต้องระบุบ้านเลขที่'}
                </Text>
              </View>
              <Switch
                value={requireHouseForGate}
                onValueChange={setRequireHouseForGate}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={requireHouseForGate ? '#1D4ED8' : '#F1F5F9'}
              />
            </View>
          )}

          {enableGateControl && requireHouseForGate && (
            <View style={styles.policyExplCard}>
              <View style={styles.policyExplHeader}>
                <Text style={styles.policyExplIcon}>ℹ️</Text>
                <Text style={styles.policyExplTitle}>เงื่อนไขการสั่งเปิดไม้กั้น</Text>
              </View>
              <Text style={styles.policyExplText}>
                จำเป็นจะต้องระบุบ้านเลขที่ที่มีอยู่ในระบบ เพื่อสั่งเปิดไม้กั้น โดยเมื่อกดเปิดไม้กั้น ระบบจะเปิด Keypad ให้ตรวจสอบและเลือกบ้านเลขที่ก่อนส่งสัญญาณ และระบบ Backend จะบันทึกประวัติการเปิดไม้กั้นแยกตามบ้านเลขที่อย่างละเอียด
              </Text>
            </View>
          )}
        </View>

        {/* 4. Cache Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>⚡</Text>
            <Text style={styles.cardTitle}>ระบบ Cache ข้อมูล Backend</Text>
          </View>

          {/* Toggle Cache On/Off */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.switchTitle}>เปิดใช้งาน Cache</Text>
              <Text style={styles.switchSub}>
                {cacheConfig.enabled
                  ? `เปิดอยู่: ใช้ข้อมูลที่บันทึกไว้ (${cacheConfig.ttlMinutes} นาที) ลด Backend calls`
                  : 'ปิดอยู่: ดึงข้อมูลใหม่จาก Backend ทุกครั้ง'}
              </Text>
            </View>
            <Switch
              value={cacheConfig.enabled}
              onValueChange={handleToggleCache}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={cacheConfig.enabled ? '#1D4ED8' : '#F1F5F9'}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* TTL Setting */}
          <Text style={styles.inputLabel}>เวลาเก็บ Cache (นาที, 1–60):</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, !cacheConfig.enabled && { opacity: 0.4 }]}
              value={ttlInput}
              onChangeText={setTtlInput}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor="#94A3B8"
              editable={cacheConfig.enabled}
              maxLength={2}
            />
            <Text style={styles.cacheUnitLabel}>นาที</Text>
            <TouchableOpacity
              style={[styles.saveUrlBtn, !cacheConfig.enabled && { opacity: 0.4 }]}
              onPress={handleSaveTtl}
              disabled={!cacheConfig.enabled}
              activeOpacity={0.8}
            >
              <Text style={styles.saveUrlText}>บันทึก</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          {/* Cache Stats */}
          <View style={styles.cacheStatsBox}>
            <View style={styles.cacheStatRow}>
              <Text style={styles.cacheStatIcon}>📋</Text>
              <Text style={styles.cacheStatLabel}>เหตุผลเข้า-ออก</Text>
              <Text style={styles.cacheStatValue}>
                {cacheStats.entryReasons.length > 0
                  ? `${cacheStats.entryReasons[0].count} รายการ · เรียกใช้ ${cacheStats.entryReasons[0].hits || 0} ครั้ง · หมดใน ${Math.ceil(cacheStats.entryReasons[0].expiresIn / 60)} นาที`
                  : 'ไม่มี Cache'}
              </Text>
            </View>
            <View style={styles.cacheStatRow}>
              <Text style={styles.cacheStatIcon}>📝</Text>
              <Text style={styles.cacheStatLabel}>Config ฟอร์ม</Text>
              <Text style={styles.cacheStatValue}>
                {cacheStats.requiredFields.length > 0
                  ? `เรียกใช้ ${cacheStats.requiredFields[0].hits || 0} ครั้ง · หมดใน ${Math.ceil(cacheStats.requiredFields[0].expiresIn / 60)} นาที`
                  : 'ไม่มี Cache'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Clear Cache Button */}
          <TouchableOpacity
            style={styles.clearCacheBtn}
            onPress={handleClearCache}
            activeOpacity={0.8}
          >
            <Text style={styles.clearCacheBtnText}>🗑️ ล้าง Cache ทั้งหมด</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🗂️</Text>
            <View style={styles.payloadHeaderText}>
              <Text style={styles.cardTitle}>สรุปการตั้งค่าจากระบบ</Text>
              <Text style={styles.payloadSubTitle}>ข้อมูลที่ใช้กับการบันทึกผู้ติดต่อของป้อมนี้</Text>
            </View>
            <TouchableOpacity
              style={[styles.refreshPayloadBtn, loadingBackendPayloads && styles.actionBtnDisabled]}
              onPress={() => loadBackendPayloads(true)}
              disabled={loadingBackendPayloads}
              activeOpacity={0.8}
            >
              {loadingBackendPayloads ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.refreshPayloadText}>↻ ดึงล่าสุด</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.backendMeta}>
            <Text style={styles.backendMetaLabel}>โครงการ</Text>
            <Text style={styles.backendMetaValue}>{guardhouse?.serviceId || '-'}</Text>
            <Text style={styles.backendMetaLabel}>อัปเดตล่าสุด</Text>
            <Text style={styles.backendMetaValue}>{lastBackendSync || 'ยังไม่ได้ดึงข้อมูล'}</Text>
          </View>

          {backendPayloadError && <Text style={styles.payloadError}>{backendPayloadError}</Text>}

          <View style={styles.summarySection}>
            <View style={styles.summaryTitleRow}>
              <Text style={styles.summaryTitle}>ช่องข้อมูลที่ต้องบันทึก</Text>
              <Text style={styles.summaryCount}>
                {requiredFieldItems.filter((item) => requiredFields[item.key] === true).length} ช่องบังคับ
              </Text>
            </View>
            <Text style={styles.summaryHint}>เจ้าหน้าที่ต้องกรอกเฉพาะรายการที่ระบุว่า “ต้องกรอก”</Text>
            <View style={styles.requiredFieldsGrid}>
              {requiredFieldItems.map((item) => {
                const isRequired = requiredFields[item.key] === true;
                return (
                  <View key={item.key} style={styles.requiredFieldRow}>
                    <Text style={styles.requiredFieldIcon}>{item.icon}</Text>
                    <Text style={styles.requiredFieldLabel}>{item.label}</Text>
                    <View style={[styles.fieldStatusBadge, isRequired ? styles.fieldRequired : styles.fieldOptional]}>
                      <Text style={[styles.fieldStatusText, isRequired ? styles.fieldRequiredText : styles.fieldOptionalText]}>
                        {isRequired ? 'ต้องกรอก' : 'ไม่บังคับ'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryTitleRow}>
              <Text style={styles.summaryTitle}>เหตุผลเข้า-ออกที่ใช้งาน</Text>
              <Text style={styles.summaryCount}>{entryReasons.filter((item) => item.active !== false).length} รายการ</Text>
            </View>
            {entryReasons.length > 0 ? (
              entryReasons.map((reason, index) => {
                const isActive = reason.active !== false;
                const reasonName = String(reason.reason_name || reason.name || reason.reason || 'ไม่ระบุชื่อเหตุผล');
                return (
                  <View key={String(reason.id || index)} style={styles.reasonRow}>
                    <Text style={styles.reasonNumber}>{index + 1}</Text>
                    <Text style={styles.reasonName}>{reasonName}</Text>
                    <Text style={[styles.reasonStatus, isActive ? styles.reasonActive : styles.reasonInactive]}>
                      {isActive ? 'ใช้งาน' : 'ปิดใช้'}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptySummary}>ยังไม่พบเหตุผลเข้า-ออกสำหรับโครงการนี้</Text>
            )}
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>ข้อมูลป้อมที่กำลังใช้งาน</Text>
            <View style={styles.deviceSummaryRow}>
              <Text style={styles.deviceSummaryLabel}>ผู้ดูแลอุปกรณ์</Text>
              <Text style={styles.deviceSummaryValue}>{guard?.fullName || '-'}</Text>
            </View>
            <View style={styles.deviceSummaryRow}>
              <Text style={styles.deviceSummaryLabel}>ตำแหน่ง</Text>
              <Text style={styles.deviceSummaryValue}>{guard?.positionName || '-'}</Text>
            </View>
            <View style={styles.deviceSummaryRow}>
              <Text style={styles.deviceSummaryLabel}>ป้อม</Text>
              <Text style={styles.deviceSummaryValue}>{guardhouse?.name || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>Sunmi AIDL Integration • React Native 0.74 • Android 7.1.2</Text>
        </View>
      </ScrollView>

      {/* Bluetooth SPP Device Picker Modal */}
      <BluetoothDeviceModal
        visible={showBtModal}
        currentAddress={bluetoothScannerDevice?.address}
        onClose={() => setShowBtModal(false)}
        onConnected={(device) => {
          setBluetoothScannerDevice({ name: device.name, address: device.address });
          setBtStatus({ connected: true, deviceName: device.name, address: device.address });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  headerBadge: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  statusPillText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  hwRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hwInfo: {
    flex: 1,
    paddingRight: 10,
  },
  hwName: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '700',
  },
  hwSub: {
    color: '#64748B',
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
  },
  codeHighlight: {
    color: '#2563EB',
    fontWeight: '800',
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  readyBadge: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  readyBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  inputLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  saveUrlBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  saveUrlText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  updateBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D9E2EF',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  updateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  updateTitleWrap: {
    flex: 1,
  },
  updateTitle: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '900',
  },
  updateSub: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  updateAvailableBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  updateAvailableText: {
    color: '#15803D',
    fontSize: 10.5,
    fontWeight: '900',
  },
  updateIdleBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  updateIdleText: {
    color: '#3730A3',
    fontSize: 10.5,
    fontWeight: '900',
  },
  updateResultCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  updateResultTitle: {
    color: '#1E293B',
    fontSize: 12.5,
    fontWeight: '900',
  },
  updateResultMeta: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
  },
  updateReleaseNotes: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  updateActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryActionBtnDisabled: {
    opacity: 0.55,
  },
  secondaryActionText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '900',
  },
  passMethodBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    maxWidth: 145,
  },
  passMethodBtnText: {
    color: '#3730A3',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextWrapper: {
    flex: 1,
    paddingRight: 10,
  },
  switchTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  switchSub: {
    color: '#64748B',
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
  },
  payloadHeaderText: {
    flex: 1,
  },
  payloadSubTitle: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  refreshPayloadBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    minWidth: 86,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  refreshPayloadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  backendMeta: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  backendMetaLabel: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '700',
  },
  backendMetaValue: {
    color: '#1E293B',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 1,
    marginBottom: 6,
  },
  payloadError: {
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '600',
    padding: 8,
    marginBottom: 8,
  },
  summarySection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 12,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryCount: {
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    fontSize: 10.5,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  summaryHint: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 8,
  },
  requiredFieldsGrid: {
    gap: 5,
  },
  requiredFieldRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  requiredFieldIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  requiredFieldLabel: {
    color: '#334155',
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
  },
  fieldStatusBadge: {
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  fieldRequired: {
    backgroundColor: '#FEF2F2',
  },
  fieldOptional: {
    backgroundColor: '#F1F5F9',
  },
  fieldStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fieldRequiredText: {
    color: '#DC2626',
  },
  fieldOptionalText: {
    color: '#64748B',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reasonNumber: {
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '800',
    marginRight: 8,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  reasonName: {
    color: '#334155',
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    paddingRight: 6,
  },
  reasonStatus: {
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reasonActive: {
    backgroundColor: '#ECFDF5',
    color: '#059669',
  },
  reasonInactive: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  emptySummary: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  deviceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  deviceSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  deviceSummaryValue: {
    color: '#1E293B',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    paddingLeft: 12,
    textAlign: 'right',
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  cacheUnitLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  cacheStatsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  cacheStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cacheStatIcon: {
    fontSize: 14,
  },
  cacheStatLabel: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  cacheStatValue: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: 'hidden',
  },
  clearCacheBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearCacheBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  policyExplCard: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  policyExplHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  policyExplIcon: {
    fontSize: 15,
  },
  policyExplTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  policyExplText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  profileScopeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 8,
  },
  profileScopeIcon: {
    fontSize: 15,
  },
  profileScopeText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 18,
  },
  profileScopeBold: {
    fontWeight: '900',
    color: '#1D4ED8',
  },
  debugLogsCard: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  debugLogsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  debugLogsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  debugLogsIcon: {
    fontSize: 14,
  },
  debugLogsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  clearLogsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  clearLogsBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  debugEmptyText: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 8,
  },
  debugLogCardItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 9,
    gap: 6,
  },
  debugLogItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugTimeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  debugTimeText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '700',
  },
  debugStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  debugBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  debugBadgeFailed: {
    backgroundColor: '#FEE2E2',
  },
  debugStatusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  debugTextSuccess: {
    color: '#16A34A',
  },
  debugTextFailed: {
    color: '#DC2626',
  },
  debugPassCodeText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  debugStepsBox: {
    gap: 3,
    marginTop: 2,
  },
  debugStepMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugStepMiniName: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  debugStepMiniDuration: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  btScannerSection: {
    marginTop: 4,
  },
  btHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  btSectionIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  btSectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  btSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  btModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  btModeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  btModeTabActiveSpp: {
    backgroundColor: '#1D4ED8',
  },
  btModeTabActiveHid: {
    backgroundColor: '#059669',
  },
  btModeTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  btModeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  btDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  btDetailsCardHid: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  btStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btStatusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  btStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  btStatusBadgeConnected: {
    backgroundColor: '#DCFCE7',
  },
  btStatusBadgeDisconnected: {
    backgroundColor: '#F1F5F9',
  },
  btStatusBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  btStatusTextConnected: {
    color: '#16A34A',
    fontWeight: '800',
    fontSize: 11.5,
  },
  btStatusTextDisconnected: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 11.5,
  },
  btDeviceAddressText: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btActionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  btSelectDeviceBtn: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btSelectDeviceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  btDisconnectBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btDisconnectBtnText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '800',
  },
  btExplText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  btExplTextHid: {
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
  },
});
