import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { LiffBottomNav } from '../../components/layout/LiffTabsAndNav';
import { useAppStore } from '../../state/useAppStore';
import { SunmiScannerService } from '../../hardware/SunmiScanner';
import { SunmiPrinterService } from '../../hardware/SunmiPrinter';
import { CheckpointsScreen } from '../guard/CheckpointsScreen';
import { WorkTimeScreen } from '../guard/WorkTimeScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { HistoryScreen } from '../history/HistoryScreen';
import { CameraScannerModal } from '../../components/common/CameraScannerModal';
import { GateControlModal } from '../../components/common/GateControlModal';
import { GateCountdownModal } from '../../components/common/GateCountdownModal';
import { KeypadModal } from '../../components/common/KeypadModal';
import { ResultStatusModal } from '../../components/common/ResultStatusModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { GarbageServiceModal } from '../../components/garbage/GarbageServiceModal';
import { ScanActionChoiceModal } from '../../components/common/ScanActionChoiceModal';
import { BluetoothSppService } from '../../hardware/BluetoothSppScanner';
import { vmsApi } from '../../api/vmsApi';

export const WorksTabScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    guardhouse,
    guard,
    activeTab,
    resetRegistration,
    setPrinterConnected,
    completeRegistration,
    requireHouseForGate,
    bluetoothScannerMode,
    bluetoothScannerDevice,
  } = useAppStore();

  const [scannerMode, setScannerMode] = React.useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_OUT');
  const [showCheckoutScannerModal, setShowCheckoutScannerModal] = React.useState(false);
  const [showScanChoiceModal, setShowScanChoiceModal] = React.useState(false);
  const [pendingScanCodes, setPendingScanCodes] = React.useState<string[]>([]);
  const [showGarbageModal, setShowGarbageModal] = React.useState(false);
  const [showGateOpenModal, setShowGateOpenModal] = React.useState<{
    visible: boolean;
    direction: 'IN' | 'OUT';
  } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [checkoutResultModal, setCheckoutResultModal] = React.useState<{
    visible: boolean;
    type: 'success' | 'error';
    title: string;
    message?: string;
    autoCloseSeconds?: number;
    debugSession?: any;
  } | null>(null);

  const [showGateControlModal, setShowGateControlModal] = React.useState(false);
  const [showGateKeypadModal, setShowGateKeypadModal] = React.useState(false);
  const [pendingGateDirection, setPendingGateDirection] = React.useState<'IN' | 'OUT' | null>(null);
  const [houseNumbersList, setHouseNumbersList] = React.useState<string[]>([]);
  const [gateResultModal, setGateResultModal] = React.useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message?: string;
    autoCloseSeconds?: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Pre-load check-in data (Reasons + Required Fields + House Numbers) in background
  useEffect(() => {
    if (guardhouse?.serviceId) {
      Promise.all([
        vmsApi.getEntryReasons(guardhouse.serviceId),
        vmsApi.getRequiredFields(guardhouse.serviceId),
        vmsApi.getHouseNumbers(guardhouse.serviceId),
      ])
        .then(([_, __, houses]) => {
          if (Array.isArray(houses) && houses.length > 0) {
            setHouseNumbersList(houses);
          }
        })
        .catch(() => {});
    }
  }, [guardhouse?.serviceId]);

  const isCheckingOutRef = useRef(false);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const handleBatchScanAction = async (codes: string[], overrideMode?: 'CHECK_IN' | 'CHECK_OUT') => {
    setShowCheckoutScannerModal(false);
    setShowScanChoiceModal(false);
    // Remove any duplicates before sending to backend
    const validCodes = Array.from(new Set(codes.map(c => c.trim()).filter(Boolean)));
    if (validCodes.length === 0 || isCheckingOutRef.current) return;
    isCheckingOutRef.current = true;

    const activeMode = overrideMode || scannerMode;
    setScannerMode(activeMode);
    setCheckoutLoading(true);

    const total = validCodes.length;

    if (activeMode === 'CHECK_IN') {
      try {
        const results = await Promise.allSettled(
          validCodes.map(c => vmsApi.updatePassCheckInStatus(c, guard?.userId))
        );

        setCheckoutLoading(false);
        isCheckingOutRef.current = false;

        const succeeded = results.filter(
          r => r.status === 'fulfilled' && (r.value as any)?.status
        ).length;
        const failed = total - succeeded;

        if (succeeded > 0) {
          setShowGateOpenModal({
            visible: true,
            direction: 'IN',
          });
          if (failed > 0) {
            setCheckoutResultModal({
              visible: true,
              type: 'error',
              title: `บันทึกเข้าสำเร็จ ${succeeded}/${total} รายการ`,
              message: `บันทึกสำเร็จ ${succeeded} รายการ (ไม่สำเร็จ ${failed} รายการ)\nกำลังสั่งเปิดไม้กั้นขาเข้า...`,
              autoCloseSeconds: 4,
            });
          }
        } else {
          const firstErr = results.find(r => r.status === 'fulfilled' && !(r.value as any)?.status);
          const errMsg = firstErr && firstErr.status === 'fulfilled' ? (firstErr.value as any)?.message : 'ไม่สามารถลงเวลาเข้าได้';
          setCheckoutResultModal({
            visible: true,
            type: 'error',
            title: 'บันทึกเข้าไม่สำเร็จ',
            message: errMsg || 'ไม่พบรหัสผู้ติดต่อ หรือไม่สามารถลงเวลาเข้าได้',
            autoCloseSeconds: 4,
          });
        }
      } catch (e: any) {
        setCheckoutLoading(false);
        isCheckingOutRef.current = false;
        setCheckoutResultModal({
          visible: true,
          type: 'error',
          title: 'เกิดข้อผิดพลาดในการลงเวลาเข้า',
          message: e?.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ Backend ได้',
          autoCloseSeconds: 4,
        });
      }
    } else {
      // CHECK_OUT
      const debugMode = useAppStore.getState().debugMode;
      try {
        const results = await Promise.allSettled(
          validCodes.map(c => vmsApi.processCheckoutQRCode(c, guard?.userId, guardhouse?.id, debugMode))
        );

        setCheckoutLoading(false);
        isCheckingOutRef.current = false;

        const succeeded = results.filter(
          r => r.status === 'fulfilled' && (r.value as any)?.status
        ).length;
        const failed = total - succeeded;

        if (succeeded > 0) {
          setShowGateOpenModal({
            visible: true,
            direction: 'OUT',
          });
          if (failed > 0) {
            setCheckoutResultModal({
              visible: true,
              type: 'error',
              title: `บันทึกออกสำเร็จ ${succeeded}/${total} รายการ`,
              message: `บันทึกออกสำเร็จ ${succeeded} รายการ (ไม่สำเร็จ ${failed} รายการ)\nกำลังสั่งเปิดไม้กั้นขาออก...`,
              autoCloseSeconds: debugMode ? 8 : 4,
            });
          }
        } else {
          const firstErr = results.find(r => r.status === 'fulfilled' && !(r.value as any)?.status);
          const errMsg = firstErr && firstErr.status === 'fulfilled' ? (firstErr.value as any)?.message : 'ไม่พบรายการ หรือทำรายการเช็คเอาท์ไปแล้ว';
          setCheckoutResultModal({
            visible: true,
            type: 'error',
            title: 'บันทึกออกไม่สำเร็จ',
            message: errMsg,
            autoCloseSeconds: debugMode ? 8 : 4,
          });
        }
      } catch (e: any) {
        setCheckoutLoading(false);
        isCheckingOutRef.current = false;
        setCheckoutResultModal({
          visible: true,
          type: 'error',
          title: 'เกิดข้อผิดพลาดในการบันทึกออก',
          message: e?.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ Backend ได้',
          autoCloseSeconds: 4,
        });
      }
    }
  };

  const handleScanAction = (code: string, overrideMode?: 'CHECK_IN' | 'CHECK_OUT') => {
    handleBatchScanAction([code], overrideMode);
  };

  useEffect(() => {
    // Check printer status
    SunmiPrinterService.isConnected().then((connected) => {
      setPrinterConnected(connected);
    });

    // Hardware Physical Key Listener (VOLUME_UP, VOLUME_DOWN)
    const keySub = SunmiScannerService.onHardwareKey((key) => {
      if (key === 'VOLUME_UP') {
        setScannerMode('CHECK_IN');
        setShowCheckoutScannerModal(true);
      } else if (key === 'VOLUME_DOWN') {
        setScannerMode('CHECK_OUT');
        setShowCheckoutScannerModal(true);
      }
    });

    // Hardware & Bluetooth HID/SPP Scanner Listener
    const sub = SunmiScannerService.onScan((code) => {
      if (activeTab === 'works') {
        const clean = code.trim();
        if (!clean) return;

        const now = Date.now();
        // Prevent rapid duplicate scan within 800ms
        if (lastScanRef.current.code === clean && now - lastScanRef.current.time < 800) {
          return;
        }
        lastScanRef.current = { code: clean, time: now };

        if (showCheckoutScannerModal) {
          handleBatchScanAction([clean], scannerMode);
        } else {
          // Accumulate scanned codes continuously in queue, preventing duplicates in the list
          setPendingScanCodes((prev) => {
            if (prev.includes(clean)) {
              return prev; // Card already in active queue
            }
            return [...prev, clean];
          });
          setShowScanChoiceModal(true);
        }
      }
    });

    // Auto connect to saved SPP Bluetooth Scanner if configured
    if (bluetoothScannerMode === 'SPP' && bluetoothScannerDevice?.address) {
      BluetoothSppService.isConnected().then((res) => {
        if (!res.connected && bluetoothScannerDevice.address) {
          BluetoothSppService.connect(bluetoothScannerDevice.address).catch(() => {});
        }
      });
    }

    return () => {
      keySub?.remove();
      sub?.remove();
    };
  }, [activeTab, guard?.id, guard?.userId, guardhouse?.id, scannerMode, showCheckoutScannerModal, bluetoothScannerMode, bluetoothScannerDevice?.address]);

  const executeGateCommand = async (direction: 'IN' | 'OUT', houseNo?: string) => {
    const cmd = direction === 'IN' ? 'door_open_in' : 'door_open_out';
    const directionLabel = direction === 'IN' ? 'ขาเข้า' : 'ขาออก';
    try {
      const result = await vmsApi.sendGateCommand(
        cmd,
        guardhouse?.id,
        guardhouse?.serviceId,
        guard?.id,
        {
          houseNo,
          triggerSource: 'sunmi_pos_liff',
          guardName: guard?.name,
          guardhouseName: guardhouse?.name,
          serviceName: guardhouse?.serviceName,
        }
      );

      const isSuccess = result?.success === true || result?.status === true || result?.message === 'Command sent successfully';

      if (isSuccess) {
        setGateResultModal({
          visible: true,
          type: 'success',
          title: `สั่งเปิดไม้กั้น (${directionLabel}) สำเร็จ`,
          message: houseNo
            ? `บันทึกสำหรับบ้านเลขที่: ${houseNo}\n(จะปิดอัตโนมัติใน 3 วินาที)`
            : 'ส่งสัญญาณเปิดไม้กั้นเรียบร้อย\n(จะปิดอัตโนมัติใน 3 วินาที)',
          autoCloseSeconds: 3,
        });
      } else {
        setGateResultModal({
          visible: true,
          type: 'error',
          title: `ไม่สามารถเปิดไม้กั้น (${directionLabel})`,
          message: `${result.message || 'โปรดตรวจสอบการเชื่อมต่อ Relay/Server'}\n(จะปิดอัตโนมัติใน 3 วินาที)`,
          autoCloseSeconds: 3,
        });
      }
    } catch (e: any) {
      setGateResultModal({
        visible: true,
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการสั่งไม้กั้น',
        message: `${e.message || 'Network Error'}\n(จะปิดอัตโนมัติใน 3 วินาที)`,
        autoCloseSeconds: 3,
      });
    }
  };

  const handleOpenGate = async (direction: 'IN' | 'OUT') => {
    setShowGateControlModal(false);

    if (requireHouseForGate) {
      setPendingGateDirection(direction);
      if (houseNumbersList.length === 0 && guardhouse?.serviceId) {
        try {
          const houses = await vmsApi.getHouseNumbers(guardhouse.serviceId);
          if (Array.isArray(houses) && houses.length > 0) {
            setHouseNumbersList(houses);
          }
        } catch (e) {
          console.warn('Error fetching house numbers:', e);
        }
      }
      setShowGateKeypadModal(true);
      return;
    }

    // Direct open when toggle is OFF
    executeGateCommand(direction);
  };

  const handleConfirmGateHouse = (enteredHouse: string) => {
    const trimmed = enteredHouse.trim();
    if (!trimmed) {
      Alert.alert('กรุณาระบุบ้านเลขที่', 'โปรดพิมพ์หรือเลือกบ้านเลขที่ที่ต้องการสั่งเปิดไม้กั้น');
      return;
    }

    // Validate that entered house exists in house numbers if list is available
    if (houseNumbersList.length > 0 && !houseNumbersList.includes(trimmed)) {
      Alert.alert(
        'ไม่พบบ้านเลขที่ในระบบ',
        `ไม่พบบ้านเลขที่ "${trimmed}" ในฐานข้อมูลโครงการ\nกรุณาตรวจสอบอีกครั้ง หรือกดเลือกจากปุ่ม "ดูบ้านเลขที่ทั้งหมด"`,
        [{ text: 'ตกลง' }]
      );
      return;
    }

    setShowGateKeypadModal(false);
    if (pendingGateDirection) {
      executeGateCommand(pendingGateDirection, trimmed);
    }
  };

  const handleRefresh = React.useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      // The printer may have been switched on/off after the app was opened.
      const printerConnected = await SunmiPrinterService.isConnected();
      setPrinterConnected(printerConnected);

      // Re-read the guard record used when this POS device was registered. This
      // keeps the header and guardhouse settings current without requiring a
      // new QR registration. Keep the existing local record if the backend is
      // temporarily unavailable.
      if (guard?.id) {
        const registration = await vmsApi.registerDeviceWithSecurityGuardQR(guard.id);
        await completeRegistration(registration.guard, registration.guardhouse, registration.token);
      }
    } catch (error) {
      console.warn('Home refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [completeRegistration, guard?.id, isRefreshing, setPrinterConnected]);

  const enableGateControl = useAppStore((s) => s.enableGateControl);

  const allActionCards = [
    {
      id: 'check-in',
      title: 'บันทึกเข้า',
      hint: 'ผู้ติดต่อบันทึกเข้า (แลกบัตร / ถ่ายรูป)',
      icon: '📥',
      onPress: () => navigation.navigate('CheckIn'),
    },
    {
      id: 'check-out',
      title: 'บันทึกออก',
      hint: 'ผู้ติดต่อบันทึกออก (สแกน QR Code / บาร์โค้ด)',
      icon: '📤',
      onPress: () => {
        setScannerMode('CHECK_OUT');
        setShowCheckoutScannerModal(true);
      },
    },
    {
      id: 'gate-control',
      title: 'จัดการไม้กั้น',
      hint: 'ควบคุมไม้กั้นทางเข้า-ออก',
      icon: '🚧',
      onPress: () => setShowGateControlModal(true),
    },
    {
      id: 'garbage',
      title: 'ถุงขยะ/คีย์การ์ด',
      hint: 'บริการลูกบ้าน (รับถุงขยะ / คีย์การ์ด)',
      icon: '🗑️',
      onPress: () => setShowGarbageModal(true),
    },
  ];

  const actionCards = enableGateControl
    ? allActionCards
    : allActionCards.filter((c) => c.id !== 'gate-control');

  return (
    <View style={styles.container}>
      <View style={styles.contentArea}>
        {activeTab === 'works' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            }
          >
            {/* Compact Space-Saving Header */}
            <LiffHeader />

            {/* Main Action List (Unified VMP Corporate Theme) */}
            <View style={styles.actionList}>
              {actionCards.map((card) => {
                return (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.actionCardRow}
                    activeOpacity={0.75}
                    onPress={card.onPress}
                  >
                    <View style={styles.iconContainerRow}>
                      <Text style={styles.cardEmoji}>{card.icon}</Text>
                    </View>
                    <View style={styles.cardContentRow}>
                      <Text style={styles.cardTitleRow}>{card.title}</Text>
                      <Text style={styles.cardHintRow}>{card.hint}</Text>
                    </View>
                    <View style={styles.actionArrowBadge}>
                      <Text style={styles.actionArrowText}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {activeTab === 'patrol' && <CheckpointsScreen navigation={navigation} />}
        {activeTab === 'worktime' && <WorkTimeScreen navigation={navigation} />}
        {activeTab === 'settings' && <SettingsScreen navigation={navigation} />}
        {activeTab === 'history' && <HistoryScreen navigation={navigation} />}
      </View>

      {/* Bottom Floating Nav Bar */}
      <LiffBottomNav navigation={navigation} />

      {/* PWA 1:1 Gate Control Modal */}
      <GateControlModal
        visible={showGateControlModal}
        onClose={() => setShowGateControlModal(false)}
        onOpenGate={handleOpenGate}
      />

      {/* Keypad Modal for Gate Control (3-Language Banner, No Unknown/Home buttons) */}
      <KeypadModal
        visible={showGateKeypadModal}
        title={`ระบุบ้านเลขที่ (เปิดไม้กั้น${pendingGateDirection === 'IN' ? 'ขาเข้า' : 'ขาออก'})`}
        houseNumbers={houseNumbersList}
        isGateMode={true}
        canSubmitEmpty={false}
        onConfirm={handleConfirmGateHouse}
        onCancel={() => {
          setShowGateKeypadModal(false);
          setPendingGateDirection(null);
        }}
      />

      {/* Gate Result Status Modal (Themed with 3s Auto-Close) */}
      {gateResultModal?.visible && (
        <ResultStatusModal
          visible={true}
          type={gateResultModal.type}
          title={gateResultModal.title}
          message={gateResultModal.message}
          autoCloseSeconds={gateResultModal.autoCloseSeconds ?? 3}
          onClose={() => setGateResultModal(null)}
        />
      )}

      {/* Direct Dual-Mode Camera Scanner Modal (Instant 0ms popup & dismiss) */}
      <CameraScannerModal
        visible={showCheckoutScannerModal}
        onClose={() => setShowCheckoutScannerModal(false)}
        onScan={handleScanAction}
        title={scannerMode === 'CHECK_IN' ? 'สแกน QR Code ลงเวลาเข้า (Check-In)' : 'สแกน QR Code บันทึกออก (Check-Out)'}
        subtitle={
          scannerMode === 'CHECK_IN'
            ? 'ส่องกล้องสแกน QR Code หรือสลิป เพื่อลงเวลาเข้า'
            : 'ส่องกล้องสแกน QR Code หรือสลิป เพื่อลงเวลาออก'
        }
      />

      {/* Checkout Loading Overlay */}
      <LoadingOverlay
        visible={checkoutLoading}
        title={scannerMode === 'CHECK_IN' ? 'กำลังบันทึกเข้า...' : 'กำลังบันทึกออก...'}
        message={
          scannerMode === 'CHECK_IN'
            ? 'กำลังส่งข้อมูล Check-In ไปยัง Backend...'
            : 'กำลังส่งข้อมูล Check-Out ไปยัง Backend...'
        }
      />

      {/* Prominent Gate Open Modal (No countdown, user presses button manually) */}
      {showGateOpenModal?.visible && (
        <GateCountdownModal
          visible={true}
          direction={showGateOpenModal.direction}
          hasCountdown={false}
          onOpenNow={() => {
            const dir = showGateOpenModal.direction;
            setShowGateOpenModal(null);
            executeGateCommand(dir);
          }}
          onCancel={() => {
            setShowGateOpenModal(null);
          }}
        />
      )}

      {/* Checkout Result Status Modal */}
      {checkoutResultModal?.visible && (
        <ResultStatusModal
          visible={true}
          type={checkoutResultModal.type}
          title={checkoutResultModal.title}
          message={checkoutResultModal.message}
          autoCloseSeconds={checkoutResultModal.autoCloseSeconds ?? 3}
          debugSession={checkoutResultModal.debugSession}
          onClose={() => setCheckoutResultModal(null)}
        />
      )}

      {/* Bluetooth & Multi-Scan Action Selector Modal */}
      <ScanActionChoiceModal
        visible={showScanChoiceModal}
        scannedCodes={pendingScanCodes}
        onRemoveCode={(index) => {
          setPendingScanCodes((prev) => {
            const updated = prev.filter((_, i) => i !== index);
            if (updated.length === 0) {
              setShowScanChoiceModal(false);
            }
            return updated;
          });
        }}
        onSelectCheckIn={() => {
          const codes = [...pendingScanCodes];
          setShowScanChoiceModal(false);
          setPendingScanCodes([]);
          handleBatchScanAction(codes, 'CHECK_IN');
        }}
        onSelectCheckOut={() => {
          const codes = [...pendingScanCodes];
          setShowScanChoiceModal(false);
          setPendingScanCodes([]);
          handleBatchScanAction(codes, 'CHECK_OUT');
        }}
        onCancel={() => {
          setShowScanChoiceModal(false);
          setPendingScanCodes([]);
        }}
      />

      {/* Resident Garbage & Keycard Service Modal */}
      <GarbageServiceModal
        visible={showGarbageModal}
        onClose={() => setShowGarbageModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  activeShiftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#93C5FD',
    marginBottom: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  shiftIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shiftIconText: {
    fontSize: 24,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftGuardhouseName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  shiftGuardName: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  actionList: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 4,
  },
  actionCardRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderLeftWidth: 6,
    borderColor: '#BFDBFE',
    borderLeftColor: '#2563EB',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iconContainerRow: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    marginRight: 14,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardContentRow: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitleRow: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  cardHintRow: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  actionArrowBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginLeft: 8,
  },
  actionArrowText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2563EB',
    lineHeight: 24,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyItemHouse: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  historyItemSub: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  historyStatus: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  historyStatusText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
});
