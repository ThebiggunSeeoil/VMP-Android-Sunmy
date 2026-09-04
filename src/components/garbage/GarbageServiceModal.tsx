import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { GarbageChoiceView } from './GarbageChoiceView';
import { GarbageItemsListView } from './GarbageItemsListView';
import { GarbageDetailModal } from './GarbageDetailModal';
import { HandoverConfirmModal } from './HandoverConfirmModal';
import { KeypadModal } from '../common/KeypadModal';
import { CameraScannerModal } from '../common/CameraScannerModal';
import { PhotoCaptureModal } from '../common/PhotoCaptureModal';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { ResultStatusModal } from '../common/ResultStatusModal';
import { vmsApi } from '../../api/vmsApi';
import { useAppStore } from '../../state/useAppStore';

interface GarbageServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GarbageServiceModal: React.FC<GarbageServiceModalProps> = ({
  visible,
  onClose,
}) => {
  const [subStep, setSubStep] = useState<'CHOICE' | 'LIST'>('CHOICE');
  const [showKeypad, setShowKeypad] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState('กำลังโหลดข้อมูล...');
  const [items, setItems] = useState<any[]>([]);
  const [targetHouseNumber, setTargetHouseNumber] = useState('');
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [confirmModalData, setConfirmModalData] = useState<{
    visible: boolean;
    selectedIds: number[];
    totalBags: number;
    totalCards: number;
  } | null>(null);
  const [pendingDeliveryIds, setPendingDeliveryIds] = useState<number[]>([]);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  } | null>(null);

  const guard = useAppStore((s) => s.guard);
  const guardhouse = useAppStore((s) => s.guardhouse);
  const showPhotoPreview = useAppStore((s) => s.showPhotoPreview);
  const [houseNumbersList, setHouseNumbersList] = useState<string[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSubStep('CHOICE');
      setShowKeypad(false);
      setShowScanner(false);
      setShowCamera(false);
      setLoading(false);
      setItems([]);
      setTargetHouseNumber('');
      setSelectedItemDetail(null);
      setPendingDeliveryIds([]);
      setResultModal(null);

      // Pre-load house numbers for keypad
      if (guardhouse?.serviceId) {
        vmsApi.getHouseNumbers(guardhouse.serviceId).then((houses) => {
          if (Array.isArray(houses) && houses.length > 0) {
            setHouseNumbersList(houses);
          }
        }).catch(() => {});
      }
    }
  }, [visible, guardhouse?.serviceId]);

  // Handle House Number Entered via Keypad
  const handleHouseConfirmed = async (houseNo: string) => {
    setShowKeypad(false);
    const cleanHouse = houseNo.trim();
    if (!cleanHouse) return;

    setTargetHouseNumber(cleanHouse);
    setLoadingTitle('กำลังค้นหารายการถุงขยะ/คีย์การ์ด...');
    setLoading(true);

    try {
      const res = await vmsApi.getGarbageItems(cleanHouse);
      setLoading(false);
      if (res.status && Array.isArray(res.data) && res.data.length > 0) {
        setItems(res.data);
        setSubStep('LIST');
      } else {
        Alert.alert(
          'ไม่พบรายการ',
          `ไม่พบรายการถุงขยะหรือคีย์การ์ดสำหรับบ้านเลขที่ "${cleanHouse}"\nกรุณาตรวจสอบเลขบ้านอีกครั้ง`,
          [{ text: 'ตกลง' }]
        );
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    }
  };

  // Handle Resident QR Scanned
  const handleQRScanned = async (scannedText: string) => {
    setShowScanner(false);
    const cleanQR = scannedText.trim();
    if (!cleanQR) return;

    setLoadingTitle('กำลังตรวจสอบ QR Code...');
    setLoading(true);

    try {
      const res = await vmsApi.getGarbageItems(undefined, cleanQR);
      setLoading(false);
      if (res.status && Array.isArray(res.data) && res.data.length > 0) {
        setItems(res.data);
        const inferredHouse = res.data[0]?.bag_contorl_house_number_local || '';
        setTargetHouseNumber(inferredHouse);
        setSubStep('LIST');
      } else {
        Alert.alert(
          'ไม่พบข้อมูล QR Code',
          'ไม่พบรายการถุงขยะหรือคีย์การ์ดที่ตรงกับ QR Code นี้',
          [{ text: 'ตกลง' }]
        );
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    }
  };

  // Handle Proceed to Delivery (Open Custom VMP Handover Confirm Modal)
  const handleProceedDelivery = (selectedIds: number[]) => {
    if (selectedIds.length === 0) return;

    const selectedData = items.filter((i) => selectedIds.includes(Number(i.id)));
    const totalBags = selectedData
      .filter((i) => i.bill_type === 'Bag')
      .reduce((sum, i) => sum + Number(i.bag_no || 0), 0);
    const totalCards = selectedData
      .filter((i) => i.bill_type === 'Card')
      .reduce((sum, i) => sum + Number(i.card_no || 0), 0);

    setConfirmModalData({
      visible: true,
      selectedIds,
      totalBags,
      totalCards,
    });
  };

  // Handle Photo Captured & Deliver to Backend
  const handlePhotoCaptured = async (photoUri: string) => {
    setShowCamera(false);
    if (!photoUri || pendingDeliveryIds.length === 0) return;

    setLoadingTitle('กำลังบันทึกการส่งมอบและอัปโหลดรูปภาพ...');
    setLoading(true);

    const activeUserId = guard?.userId || 'VisitorBox-03';
    const profile = {
      userId: activeUserId,
      displayName: guard?.name || 'เจ้าหน้าที่ รปภ.',
    };

    const resultLogs: { rowId: number; status: boolean; message: string }[] = [];

    for (const bagId of pendingDeliveryIds) {
      try {
        const res = await vmsApi.deliverGarbageItem(bagId, photoUri, profile, activeUserId);
        resultLogs.push({
          rowId: bagId,
          status: res.status,
          message: res.message || res.detail || (res.status ? 'สำเร็จ' : 'ล้มเหลว'),
        });
      } catch (e: any) {
        resultLogs.push({
          rowId: bagId,
          status: false,
          message: e?.message || 'เกิดข้อผิดพลาด',
        });
      }
    }

    setLoading(false);

    const successCount = resultLogs.filter((r) => r.status).length;
    const allSuccess = successCount === pendingDeliveryIds.length;

    if (allSuccess) {
      setResultModal({
        visible: true,
        type: 'success',
        title: 'ส่งมอบเรียบร้อย',
        message: `บันทึกการส่งมอบ ${successCount} รายการ สำเร็จเรียบร้อย`,
      });
    } else {
      setResultModal({
        visible: true,
        type: successCount > 0 ? 'warning' : 'error',
        title: successCount > 0 ? 'ดำเนินการสำเร็จบางส่วน' : 'ไม่สามารถส่งมอบได้',
        message: `สำเร็จ ${successCount} จาก ${pendingDeliveryIds.length} รายการ`,
      });
    }

    // Refresh items list for target house
    if (targetHouseNumber) {
      try {
        const refreshRes = await vmsApi.getGarbageItems(targetHouseNumber);
        if (refreshRes.status && Array.isArray(refreshRes.data)) {
          setItems(refreshRes.data);
        }
      } catch {}
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, subStep === 'LIST' ? styles.modalCardFull : styles.modalCardChoice]}>
          {subStep === 'CHOICE' ? (
            <GarbageChoiceView
              onScanQR={() => setShowScanner(true)}
              onEnterHouseNumber={() => setShowKeypad(true)}
              onCancel={onClose}
            />
          ) : (
            <GarbageItemsListView
              items={items}
              targetHouseNumber={targetHouseNumber}
              onRetry={() => setSubStep('CHOICE')}
              onProceed={handleProceedDelivery}
              onViewItemDetail={(item) => setSelectedItemDetail(item)}
              onCancel={onClose}
            />
          )}
        </View>
      </View>

      {/* Zero-Latency Keypad Modal for Entering House Number */}
      <KeypadModal
        visible={showKeypad}
        title="ป้อนบ้านเลขที่เพื่อค้นหาถุงขยะ/คีย์การ์ด"
        houseNumbers={houseNumbersList}
        canSubmitEmpty={false}
        onConfirm={handleHouseConfirmed}
        onCancel={() => setShowKeypad(false)}
      />

      {/* Direct Camera Scanner Modal for QR Code */}
      <CameraScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScanned}
        title="สแกน QR Code รับถุงขยะ/คีย์การ์ด"
        subtitle="ส่องกล้องสแกน QR Code จากลูกบ้านเพื่อค้นหารายการ"
      />

      {/* Handover Confirmation Modal (VMP Theme) */}
      <HandoverConfirmModal
        visible={Boolean(confirmModalData?.visible)}
        targetHouseNumber={targetHouseNumber}
        selectedCount={confirmModalData?.selectedIds.length || 0}
        totalBags={confirmModalData?.totalBags || 0}
        totalCards={confirmModalData?.totalCards || 0}
        onConfirm={() => {
          const selectedIds = confirmModalData?.selectedIds || [];
          setConfirmModalData(null);
          setPendingDeliveryIds(selectedIds);
          setShowCamera(true);
        }}
        onCancel={() => setConfirmModalData(null)}
      />

      {/* Photo Capture Modal for Handover Confirmation */}
      <PhotoCaptureModal
        visible={showCamera}
        captureType="id_card"
        showPreview={showPhotoPreview}
        title="📷 ถ่ายรูปผู้รับของ"
        subtitle="ถ่ายรูปผู้มาติดต่อรับของเพื่อเป็นหลักฐานการส่งมอบ"
        onCapture={handlePhotoCaptured}
        onCancel={() => setShowCamera(false)}
      />

      {/* Item Detail Modal */}
      <GarbageDetailModal
        visible={Boolean(selectedItemDetail)}
        item={selectedItemDetail}
        onClose={() => setSelectedItemDetail(null)}
      />

      {/* Loading Overlay */}
      <LoadingOverlay
        visible={loading}
        title={loadingTitle}
        message="กรุณารอสักครู่..."
      />

      {/* Result Status Modal */}
      {resultModal?.visible && (
        <ResultStatusModal
          visible={true}
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          autoCloseSeconds={2}
          onClose={() => {
            const wasSuccess = resultModal.type === 'success';
            setResultModal(null);
            if (wasSuccess) {
              onClose(); // Automatically exit modal and return directly to main screen!
            }
          }}
        />
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
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 10,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalCardChoice: {
    maxWidth: 420,
  },
  modalCardFull: {
    flex: 1,
    height: '98%',
    maxHeight: '99%',
  },
});
