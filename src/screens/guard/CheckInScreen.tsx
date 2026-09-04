import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { LiffBottomNav } from '../../components/layout/LiffTabsAndNav';
import { LiteButton } from '../../components/common/LiteButton';
import { KeypadModal } from '../../components/common/KeypadModal';
import { GateCountdownModal } from '../../components/common/GateCountdownModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { PhotoCaptureModal } from '../../components/common/PhotoCaptureModal';
import { CameraScannerModal } from '../../components/common/CameraScannerModal';
import { GeneratedPassResultModal, GeneratedPassResultData } from '../../components/common/GeneratedPassResultModal';
import { ResultStatusModal } from '../../components/common/ResultStatusModal';
import { PaperOutModal } from '../../components/common/PaperOutModal';
import { SunmiPrinterService, VisitorSlipData } from '../../hardware/SunmiPrinter';
import { SunmiScannerService } from '../../hardware/SunmiScanner';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

const vehicleTypes = ['รถจักรยานยนต์', 'รถเก๋ง / กระบะ', 'รถแท็กซี่', 'รถบรรทุก / 6 ล้อขึ้นไป'];
const genderOptions = ['ชาย', 'หญิง', 'ไม่ระบุ'];

const getReasonIcon = (name: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('อาหาร') || n.includes('food') || n.includes('grab') || n.includes('lineman') || n.includes('panda') || n.includes('robinhood') || n.includes('shopee')) return '🛵';
  if (n.includes('ญาติ') || n.includes('เพื่อน') || n.includes('ครอบครัว') || n.includes('เยี่ยม')) return '👥';
  if (n.includes('รับ-ส่ง') || n.includes('ลูกค้า') || n.includes('แท็กซี่') || n.includes('taxi') || n.includes('bolt')) return '🚗';
  if (n.includes('แม่บ้าน') || n.includes('ทำความสะอาด') || n.includes('ผรม') || n.includes('ช่าง') || n.includes('ซ่อม')) return '🧹';
  if (n.includes('ขยะ') || n.includes('เทศบาล') || n.includes('สิ่งปฏิกูล')) return '🚛';
  if (n.includes('พัสดุ') || n.includes('ไปรษณีย์') || n.includes('ขนส่ง') || n.includes('delivery') || n.includes('kerry') || n.includes('flash') || n.includes('j&t')) return '📦';
  if (n.includes('ตรวจ') || n.includes('รักษา') || n.includes('พยาบาล') || n.includes('หมอ')) return '🚑';
  if (n.includes('ประชุม') || n.includes('อบรม') || n.includes('สัมมนา')) return '💼';
  return '📋';
};

// RequiredFields schema from backend
interface RequiredFields {
  reason_entry?: boolean;
  number_house?: boolean;
  name?: boolean;
  id_number?: boolean;
  gender?: boolean;
  vehicle?: boolean;
  color_vehicle?: boolean;
  picture_id_card?: boolean;
  picture_car_number?: boolean;
  visitor_qr_code?: boolean;
}

interface CheckInReason {
  id: string;
  name: string;
  icon?: string;
  requires_house_number?: boolean;
}

// step 1 = เลือกเหตุผล, step 2 = กรอกรายละเอียด
type Step = 1 | 2;
type PhotoTarget = 'id_card' | 'car_number' | null;

const getBackendErrorMessage = (error: any) => {
  const data = error?.response?.data;
  const status = error?.response?.status;
  const readableMessage = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    if (/<(?:!doctype|html|head|body)\b/i.test(value)) {
      return status === 500
        ? 'ระบบ Backend ขัดข้องชั่วคราว (HTTP 500) กรุณาลองใหม่ หรือติดต่อผู้ดูแลระบบ'
        : `Backend ตอบกลับผิดรูปแบบ (HTTP ${status || '-'}) กรุณาลองใหม่`;
    }
    return value.length > 300 ? `Backend ตอบกลับผิดพลาด (HTTP ${status || '-'})` : value;
  };

  if (!data) {
    return status
      ? `Backend ตอบกลับผิดพลาด (HTTP ${status}) กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ`
      : error?.message || 'ไม่สามารถเชื่อมต่อ Backend ได้ กรุณาตรวจสอบเครือข่าย';
  }
  if (typeof data === 'string') {
    return readableMessage(data) || 'Backend ไม่สามารถบันทึกรายการได้';
  }
  if (data.status === 'non_json_response') {
    const upstreamStatus = data.status_code || status || '-';
    return upstreamStatus === 500
      ? 'ระบบ QR Code Generator ของ Backend ขัดข้องชั่วคราว (HTTP 500) กรุณาลองใหม่ หรือติดต่อผู้ดูแลระบบ'
      : `ระบบ QR Code Generator ตอบกลับผิดรูปแบบ (HTTP ${upstreamStatus}) กรุณาลองใหม่`;
  }
  const message = readableMessage(data.message) || readableMessage(data.error) || readableMessage(data.detail);
  if (message) return message;

  const details = Object.entries(data)
    .map(([field, value]) => {
      const message = Array.isArray(value) ? value.join(', ') : readableMessage(value) || String(value);
      return `${field === 'non_field_errors' ? 'ข้อมูล' : field}: ${message}`;
    })
    .join('\n');
  return details || 'Backend ไม่สามารถบันทึกรายการได้';
};

export const CheckInScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    guardhouse,
    guard,
    showPhotoPreview,
    visitorPassIssueMethod,
    innerPrinterPayloadMode,
    enableGateControl,
    autoCheckIn,
    updateGuardhouse,
  } = useAppStore();

  const [step, setStep] = useState<Step>(1);
  const [reasonsList, setReasonsList] = useState<CheckInReason[]>(() => {
    if (guardhouse?.serviceId) {
      const cached = vmsApi._entryReasonsCache[guardhouse.serviceId];
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        return cached.data.map((r: any) => ({
          id: r.id || r.reason_name,
          name: r.reason_name || r.name,
          icon: r.icon || '📋',
          requires_house_number: r.requires_house_number,
        }));
      }
    }
    return [];
  });
  const [houseNumbers, setHouseNumbers] = useState<string[]>(() => {
    if (guardhouse?.serviceId) {
      const cached = vmsApi._houseNumbersCache[guardhouse.serviceId];
      if (cached && Array.isArray(cached.data)) return cached.data;
    }
    return [];
  });
  const [requiredFields, setRequiredFields] = useState<RequiredFields>(() => {
    if (guardhouse?.serviceId) {
      const cached = vmsApi._requiredFieldsCache[guardhouse.serviceId];
      if (cached && cached.data && typeof cached.data === 'object') return cached.data as RequiredFields;
    }
    return {};
  });
  const [selectedReason, setSelectedReason] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [selectedReasonRequiresHouseNumber, setSelectedReasonRequiresHouseNumber] = useState(true);

  // Form fields
  const [houseNo, setHouseNo] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [gender, setGender] = useState(genderOptions[0]);
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState(vehicleTypes[0]);
  const [vehicleColor, setVehicleColor] = useState('');
  const [photoIdCard, setPhotoIdCard] = useState<string | null>(null);
  const [photoCarNumber, setPhotoCarNumber] = useState<string | null>(null);
  const [visitorQrCode, setVisitorQrCode] = useState('');

  // UI states
  const [showKeypad, setShowKeypad] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  const [showGeneratedPassModal, setShowGeneratedPassModal] = useState(false);
  const [generatedPassResult, setGeneratedPassResult] = useState<GeneratedPassResultData | null>(null);
  const [passRecordIdForCheckIn, setPassRecordIdForCheckIn] = useState<string>('');
  const [actionToast, setActionToast] = useState<{ visible: boolean; title: string; message: string } | null>(null);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message?: string;
    autoCloseSeconds?: number;
  } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<PhotoTarget>(null);
  const [isAutoPhotoSequence, setIsAutoPhotoSequence] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [showPhotoTransition, setShowPhotoTransition] = useState(false);
  const [showVisitorScanner, setShowVisitorScanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [showPaperOutModal, setShowPaperOutModal] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [lastSlipData, setLastSlipData] = useState<VisitorSlipData | null>(null);
  const [isRetryingPrint, setIsRetryingPrint] = useState(false);
  const [paperOutErrorMessage, setPaperOutErrorMessage] = useState('');
  const [postPrintAction, setPostPrintAction] = useState<(() => void) | null>(null);

  const hasPassedHouseStep = !selectedReasonRequiresHouseNumber || Boolean(houseNo);
  const canShowCarPhoto = hasPassedHouseStep && (!requiredFields.picture_id_card || Boolean(photoIdCard));
  const needsVisitorCard = requiredFields.visitor_qr_code && visitorPassIssueMethod === 'visitor_card';
  const canShowSubmit =
    hasPassedHouseStep &&
    (!requiredFields.picture_id_card || Boolean(photoIdCard)) &&
    (!requiredFields.picture_car_number || Boolean(photoCarNumber)) &&
    (!needsVisitorCard || Boolean(visitorQrCode));

  useEffect(() => {
    if (!guardhouse?.serviceId) return;

    const isCached = vmsApi.hasCachedCheckInData(guardhouse.serviceId);
    if (!isCached) {
      setLoadingBackend(true);
    }

    // โหลด Reasons + RequiredFields + HouseNumbers
    Promise.all([
      vmsApi.getEntryReasons(guardhouse.serviceId),
      vmsApi.getRequiredFields(guardhouse.serviceId),
      vmsApi.getHouseNumbers(guardhouse.serviceId),
    ])
      .then(([liveReasons, fields, liveHouseNumbers]) => {
        if (Array.isArray(liveReasons) && liveReasons.length > 0) {
          setReasonsList(
            liveReasons.map((r: any) => ({
              id: r.id || r.reason_name,
              name: r.reason_name || r.name,
              icon: r.icon || '📋',
              requires_house_number: r.requires_house_number,
            }))
          );
        }
        if (fields && typeof fields === 'object') {
          setRequiredFields(fields as RequiredFields);
        }
        if (Array.isArray(liveHouseNumbers) && liveHouseNumbers.length > 0) {
          setHouseNumbers(liveHouseNumbers);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!isCached) {
          setLoadingBackend(false);
        }
      });
  }, [guardhouse?.serviceId]);

  const acceptVisitorQrCode = (rawCode: string) => {
    const visitorId = vmsApi.extractUuid(rawCode);
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(visitorId)) {
      Alert.alert('QR Code ไม่ถูกต้อง', 'กรุณาสแกน QR Code จากบัตรผู้มาติดต่ออีกครั้ง');
      return;
    }
    setVisitorQrCode(visitorId);
    setShowVisitorScanner(false);
  };

  // The orange SUNMI scanner should complete the visitor-card step whenever
  // this project has enabled visitor_qr_code, just as the LIFF flow does.
  useEffect(() => {
    const subscription = SunmiScannerService.onScan((code) => {
      if (step === 2 && needsVisitorCard && hasPassedHouseStep) {
        acceptVisitorQrCode(code);
      }
    });
    return () => subscription?.remove();
  }, [step, needsVisitorCard, hasPassedHouseStep]);

  const chooseVisitorPassMode = (): Promise<'visitor_card' | 'generated' | null> => {
    if (visitorPassIssueMethod !== 'ask') return Promise.resolve(visitorPassIssueMethod);
    return new Promise((resolve) => {
      Alert.alert(
        'เลือกวิธีออกบัตรผู้ติดต่อ',
        'ต้องการแลกบัตรผู้ติดต่อแบบปกติ หรือใช้ QR Code Generator',
        [
          { text: 'ยกเลิก', style: 'cancel', onPress: () => resolve(null) },
          { text: '1. แลกบัตรปกติ', onPress: () => resolve('visitor_card') },
          { text: '2. QR Code Generator', onPress: () => resolve('generated') },
        ]
      );
    });
  };

  // Each reason controls whether a house number must be collected.
  const handleSelectReason = (reason: CheckInReason) => {
    const requiresHouseNumber = reason.requires_house_number !== false;
    setSelectedReason(reason.name);
    setSelectedReasonId(reason.id);
    setSelectedReasonRequiresHouseNumber(requiresHouseNumber);
    setHouseNo('');
    setStep(2);
    if (requiresHouseNumber) {
      setTimeout(() => setShowKeypad(true), 50);
    }
  };

  // ย้อนกลับไป step 1
  const handleBackToReasons = () => {
    setStep(1);
    setSelectedReason('');
    setSelectedReasonId('');
    setSelectedReasonRequiresHouseNumber(true);
    setHouseNo('');
    setShowKeypad(false);
  };

  // เปิดกล้องถ่ายรูป
  const openCameraForPhoto = (target: PhotoTarget) => {
    setIsAutoPhotoSequence(false);
    setOpeningCamera(false);
    setCameraTarget(target);
    setShowCamera(true);
  };

  // รับ file path จาก PhotoCaptureModal
  const handlePhotoCapture = (filePath: string) => {
    const capturedTarget = cameraTarget;

    if (capturedTarget === 'id_card') {
      setPhotoIdCard(filePath);

      // Continue straight to the license-plate camera only for the guided
      // check-in sequence that starts after confirming the house number.
      if (isAutoPhotoSequence && requiredFields.picture_car_number) {
        if (!showPhotoPreview) {
          // With Preview disabled, acknowledge the completed ID-card photo
          // before moving to the next camera so the user understands the flow.
          setShowCamera(false);
          setCameraTarget(null);
          setShowPhotoTransition(true);
          setTimeout(() => {
            setShowPhotoTransition(false);
            setCameraTarget('car_number');
            setShowCamera(true);
          }, 1200);
          return;
        }
        setCameraTarget('car_number');
        return;
      }

      // If car_number is not required and id_card is done
      if (!requiredFields.picture_car_number) {
        setShowCamera(false);
        setCameraTarget(null);
        setIsAutoPhotoSequence(false);
        setTimeout(() => {
          handleSubmit({ photoIdCard: filePath });
        }, 200);
        return;
      }
    }

    if (capturedTarget === 'car_number') {
      setPhotoCarNumber(filePath);
      setShowCamera(false);
      setCameraTarget(null);
      setIsAutoPhotoSequence(false);

      // ทำงานบันทึกทันทีเมื่อขั้นตอนถ่ายรูปทะเบียนรถสำเร็จ
      setTimeout(() => {
        handleSubmit({ photoCarNumber: filePath });
      }, 200);
      return;
    }

    setShowCamera(false);
    setCameraTarget(null);
    setIsAutoPhotoSequence(false);
  };

  const handleHouseConfirmed = (houseNumber: string) => {
    setHouseNo(houseNumber);
    setShowKeypad(false);

    // Start the camera workflow after the keypad has closed, so the next
    // screen does not compete with the keypad modal animation.
    if (requiredFields.picture_id_card || requiredFields.picture_car_number) {
      setIsAutoPhotoSequence(true);
      setOpeningCamera(true);
      setTimeout(() => {
        setCameraTarget(requiredFields.picture_id_card ? 'id_card' : 'car_number');
        setShowCamera(true);
        setOpeningCamera(false);
      }, 200);
    }
  };

  const handleSubmit = async (overrides?: { photoIdCard?: string; photoCarNumber?: string }) => {
    const activePhotoIdCard = overrides?.photoIdCard !== undefined ? overrides.photoIdCard : photoIdCard;
    const activePhotoCarNumber = overrides?.photoCarNumber !== undefined ? overrides.photoCarNumber : photoCarNumber;

    if (selectedReasonRequiresHouseNumber && !houseNo) {
      Alert.alert('กรุณาระบุข้อมูล', 'กรุณากรอกบ้านเลขที่ของผู้ที่ต้องการติดต่อ');
      setShowKeypad(true);
      return;
    }
    if (requiredFields.picture_id_card && !activePhotoIdCard) {
      Alert.alert('กรุณาระบุข้อมูล', 'กรุณาถ่ายรูปบัตรประชาชนก่อน');
      return;
    }
    if (requiredFields.picture_car_number && !activePhotoCarNumber) {
      Alert.alert('กรุณาระบุข้อมูล', 'กรุณาถ่ายรูปป้ายทะเบียนรถก่อน');
      return;
    }
    if (!selectedReasonId) {
      Alert.alert('กรุณาระบุข้อมูล', 'ไม่พบรหัสเหตุผลการเข้า กรุณาเลือกเหตุผลใหม่');
      return;
    }

    setSubmitting(true);

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('th-TH');
      const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      let passId = `VMS-${Date.now().toString().slice(-6)}`;
      let qrPayload = `pass_exchange?id=${passId}`;
      let legacyQrPayload = qrPayload;
      let barcodePayload = '';
      let validUntil = '';
      let validHours = 0;
      let checkoutRequired = false;
      let allowLateCheckout = false;
      let rawRecordId = '';

      // 1. Submit to backend. A failed check-in must never continue to print
      // or open the gate because it would create an untraceable visitor entry.
      try {
        let userId = guard?.userId;
        if (!userId && guard?.id) {
          const guardDetail = await vmsApi.getSecurityGuardDetail(guard.id);
          userId =
            guardDetail?.userprofile?.guard_select_profile?.user_id ||
            guardDetail?.guard_select_userprofile_detail?.user_id ||
            guardDetail?.user_id ||
            undefined;
        }

        if (!userId) {
          throw new Error('ไม่พบ userId ที่ผูกกับ รปภ. ของอุปกรณ์นี้ กรุณาลงทะเบียนอุปกรณ์ใหม่');
        }
        if (!guardhouse?.serviceId) {
          throw new Error('ไม่พบรหัสโครงการของป้อม กรุณาลงทะเบียนอุปกรณ์ใหม่');
        }

        const selectedIssueMethod = await chooseVisitorPassMode();
        if (!selectedIssueMethod) {
          setSubmitting(false);
          return;
        }

        if (requiredFields.visitor_qr_code && selectedIssueMethod === 'visitor_card' && !visitorQrCode) {
          setSubmitting(false);
          Alert.alert('กรุณาสแกนบัตรผู้ติดต่อ', 'สแกน QR Code จากบัตรผู้มาติดต่อก่อนบันทึกรายการ');
          setShowVisitorScanner(true);
          return;
        }

        const checkInPayload = {
          userId,
          service_name_id: guardhouse.serviceId,
          ServiceNameFiled_id: guardhouse.serviceId,
          reason_entry_file_id: selectedReasonId,
          reason_entry: selectedReason,
          number_house: houseNo,
          name: visitorName || '',
          id_number: idNumber || '',
          gender,
          vehicle: vehicleType,
          color_vehicle: vehicleColor || '',
          car_number: licensePlate || '',
          picture_id_card: activePhotoIdCard,
          picture_car_number: activePhotoCarNumber,
          guardhouse_id: guardhouse.id || undefined,
        };

        if (requiredFields.visitor_qr_code && selectedIssueMethod === 'generated') {
          let activeGuardhouseId = guardhouse.id;
          let qrCodeGeneratorMode = guardhouse.qrCodeGeneratorMode;
          if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(activeGuardhouseId || '')) {
            const guardhouses = await vmsApi.getGuardhousesByService(guardhouse.serviceId);
            const resolvedGuardhouse = guardhouses.find((item: any) => item?.id === guardhouse.id) || guardhouses[0];
            if (resolvedGuardhouse?.id) {
              activeGuardhouseId = resolvedGuardhouse.id;
              qrCodeGeneratorMode = resolvedGuardhouse.qr_code_generator_mode === 'create_new_qr_each_time'
                ? 'create_new_qr_each_time'
                : 'reserve_existing_cards';
              updateGuardhouse({
                ...guardhouse,
                id: activeGuardhouseId,
                name: resolvedGuardhouse.guardhouse_name || guardhouse.name,
                enableQrCodeGenerator: resolvedGuardhouse.enable_qr_code_generator === true,
                qrCodeGeneratorMode,
              }).catch(() => {});
            }
          }
          if (!activeGuardhouseId || !/^[0-9a-fA-F-]{36}$/.test(activeGuardhouseId)) {
            throw new Error('ไม่พบข้อมูลป้อมที่กำลังปฏิบัติงาน จึงไม่สามารถใช้ QR Code Generator ได้');
          }
          checkInPayload.guardhouse_id = activeGuardhouseId;

          if (qrCodeGeneratorMode === 'create_new_qr_each_time') {
            const generated = await vmsApi.createGeneratedPass(checkInPayload);
            if (!generated?.status || !generated?.generated_pass?.qrcode_pass_record_id) {
              throw new Error(generated?.message || 'ไม่สามารถสร้าง QR Code สำหรับผู้ติดต่อได้');
            }
            const generatedPass = generated.generated_pass;
            rawRecordId = generatedPass.qrcode_pass_record_id || generatedPass.id || '';
            setPassRecordIdForCheckIn(rawRecordId);
            passId = generatedPass.short_token || generatedPass.qrcode_pass_record_id || passId;
            legacyQrPayload = generatedPass.legacy_payload || generatedPass.payload || generatedPass.payload_checkin || qrPayload;
            barcodePayload = generatedPass.short_token_payload || generatedPass.barcode_payload || '';
            qrPayload = innerPrinterPayloadMode === 'short_token'
              ? barcodePayload || legacyQrPayload
              : legacyQrPayload;
            validUntil = generatedPass.allow_end_datetime || generatedPass.token_expires_at || '';
            validHours = Number(generatedPass.valid_hours || 0);
            checkoutRequired = generatedPass.checkout_required === true;
            allowLateCheckout = generatedPass.allow_late_checkout === true;
          } else {
            const reserved = await vmsApi.reserveGeneratedVisitorQr(activeGuardhouseId, userId);
            const generatedQrId = reserved?.generated_qr?.visitor_qr_id;
            if (!reserved?.status || !generatedQrId) {
              throw new Error(reserved?.message || 'ไม่สามารถจอง QR Code สำหรับผู้ติดต่อได้');
            }
            qrPayload = reserved.generated_qr.payload || qrPayload;
            legacyQrPayload = qrPayload;
            passId = reserved.generated_qr.running_number
              ? `Visitor #${reserved.generated_qr.running_number}`
              : generatedQrId;
            setPassRecordIdForCheckIn('');
            const backendResult = await vmsApi.submitCheckIn({
              ...checkInPayload,
              visitor_qr_code: generatedQrId,
              visitor_qr_source: 'generated_qr',
            });
            if (backendResult?.status && backendResult.status !== 'check_in_success') {
              throw new Error(backendResult.message || 'Backend ไม่สามารถบันทึกรายการได้');
            }
          }
        } else {
          setPassRecordIdForCheckIn('');
          const backendResult = await vmsApi.submitCheckIn({
            ...checkInPayload,
            visitor_qr_code: visitorQrCode || undefined,
            visitor_qr_source: visitorQrCode ? 'visitor_card' : undefined,
          });

          if (backendResult?.status && backendResult.status !== 'check_in_success') {
            throw new Error(backendResult.message || 'Backend ไม่สามารถบันทึกรายการได้');
          }
          passId = visitorQrCode || passId;
        }
      } catch (backendErr) {
        console.warn('Backend check-in failed:', backendErr);
        setSubmitting(false);
        Alert.alert('บันทึก Check-In ไม่สำเร็จ', getBackendErrorMessage(backendErr));
        return;
      }

      // 2. Print slip
      const slipPayload: VisitorSlipData = {
        title: 'บัตรผู้มาติดต่อ (VISITOR PASS)',
        serviceName: guardhouse?.villageName || 'ระบบบริหารจัดการผู้ติดต่อ',
        villageName: guardhouse?.villageName || 'ระบบบริหารจัดการผู้ติดต่อ',
        dateStr,
        timeStr,
        guardhouse: guardhouse?.name || 'ป้อม 1',
        reason: selectedReason,
        houseNo,
        licensePlate: licensePlate || '-',
        vehicleType,
        visitorName: visitorName || '-',
        qrPayload,
        legacyQrPayload,
        barcodePayload,
        payloadMode: innerPrinterPayloadMode,
        passId,
        validUntil,
        validHours,
        checkoutRequired,
        allowLateCheckout,
      };

      setLastSlipData(slipPayload);

      let printSuccess = false;
      let printDetail = '';
      let isPaperOut = false;
      let isCoverOpenDetected = false;
      try {
        const pRes = await SunmiPrinterService.printVisitorSlip(slipPayload);
        printSuccess = !!pRes?.success;
        if (!printSuccess || pRes?.status === 'OUT_OF_PAPER' || pRes?.status === 'COVER_OPEN') {
          isCoverOpenDetected = pRes?.status === 'COVER_OPEN' || (!!pRes?.message && (pRes.message.toLowerCase().includes('open') || pRes.message.includes('ฝา')));
          isPaperOut = pRes?.status === 'OUT_OF_PAPER' || (!!pRes?.message && pRes.message.toLowerCase().includes('paper'));
          setIsCoverOpen(isCoverOpenDetected);
        }
        printDetail = pRes?.message || (printSuccess ? 'พิมพ์ใบเสร็จผ่าน Sunmi 58mm สำเร็จ' : 'ไม่สามารถพิมพ์ใบเสร็จได้');
      } catch (err: any) {
        printSuccess = false;
        printDetail = err?.message || 'ยังเชื่อมห้อง Printer Room ไม่สำเร็จ';
        if (printDetail.toLowerCase().includes('paper')) {
          isPaperOut = true;
        }
        if (printDetail.toLowerCase().includes('open') || printDetail.includes('ฝา')) {
          isCoverOpenDetected = true;
          setIsCoverOpen(true);
        }
      }

      // Format validUntil for display matching PWA
      let displayValidUntil = '-';
      if (validUntil) {
        try {
          const d = new Date(validUntil);
          if (!isNaN(d.getTime())) {
            const day = d.getDate();
            const month = d.getMonth() + 1;
            const year = d.getFullYear() + 543;
            const time = d.toLocaleTimeString('th-TH', { hour12: false });
            displayValidUntil = `${day}/${month}/${year} ${time}`;
          } else {
            displayValidUntil = validUntil;
          }
        } catch {
          displayValidUntil = validUntil;
        }
      } else {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
        displayValidUntil = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${d.toLocaleTimeString('th-TH', { hour12: false })}`;
      }

      const passResultData: GeneratedPassResultData = {
        passId,
        passRecordId: rawRecordId,
        guardhouseName: guardhouse?.name || 'ป้อม 1',
        validHours: validHours || 24,
        validUntil: displayValidUntil,
        checkoutRequired: checkoutRequired ?? true,
        allowLateCheckout: allowLateCheckout ?? false,
        printSuccess,
        printSkipped: false,
        printDetail,
      };

      setGeneratedPassResult(passResultData);
      setSubmitting(false);

      if (autoCheckIn) {
        // ── Auto Check-In Flow (Skip Image 1) ──
        const targetPassId = rawRecordId || passRecordIdForCheckIn;
        const guardUserId = guard?.userId || '';

        setActionToast({
          visible: true,
          title: 'กำลังลงเวลาเข้าให้อัตโนมัติ...',
          message: 'ระบบกำลังบันทึกเวลาเข้าให้อัตโนมัติ',
        });

        let checkInRes: { status?: boolean | string; message?: string; error?: string } = {
          status: true,
          message: 'ระบบบันทึกเวลาเข้าเรียบร้อยแล้ว',
        };

        try {
          if (targetPassId && guardUserId) {
            checkInRes = await vmsApi.updatePassCheckInStatus(targetPassId, guardUserId);
          } else {
            checkInRes = {
              status: false,
              message: !targetPassId ? 'ไม่พบ passRecordId' : 'ไม่พบ guard userId',
            };
          }
        } catch (e: any) {
          checkInRes = {
            status: false,
            message: e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
          };
        }

        setActionToast(null);

        // If printing failed, prompt user with PaperOutModal to change roll / close lid & retry
        if (!printSuccess) {
          setPaperOutErrorMessage(isCoverOpenDetected ? 'ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท' : isPaperOut ? 'กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่ (58 มม.)' : printDetail);
          setPostPrintAction(() => () => {
            if (enableGateControl) {
              setShowGateModal(true);
            } else {
              if (checkInRes?.status === true || checkInRes?.status === 'check_in_success' || checkInRes?.status === 'success') {
                setResultModal({
                  visible: true,
                  type: 'success',
                  title: 'ลงเวลาเข้าสำเร็จ',
                  message: checkInRes.message || 'ระบบบันทึกเวลาเข้าเรียบร้อยแล้ว',
                  autoCloseSeconds: 3,
                });
              } else {
                setResultModal({
                  visible: true,
                  type: 'error',
                  title: 'ลงเวลาเข้าไม่สำเร็จ',
                  message: checkInRes?.message || checkInRes?.error || 'ระบบไม่สามารถบันทึกเวลาเข้าได้',
                  autoCloseSeconds: 4,
                });
              }
            }
          });
          setShowPaperOutModal(true);
          return;
        }

        if (enableGateControl) {
          // If gate control is enabled -> immediately show Gate Modal (Prominent 'เปิดไม้กั้น')
          setShowGateModal(true);
        } else {
          // If gate control is disabled -> show result status and return
          if (checkInRes?.status === true || checkInRes?.status === 'check_in_success' || checkInRes?.status === 'success') {
            setResultModal({
              visible: true,
              type: 'success',
              title: 'ลงเวลาเข้าสำเร็จ',
              message: checkInRes.message || 'ระบบบันทึกเวลาเข้าเรียบร้อยแล้ว',
              autoCloseSeconds: 3,
            });
          } else {
            setResultModal({
              visible: true,
              type: 'error',
              title: 'ลงเวลาเข้าไม่สำเร็จ',
              message: checkInRes?.message || checkInRes?.error || 'ระบบไม่สามารถบันทึกเวลาเข้าได้',
              autoCloseSeconds: 4,
            });
          }
        }
      } else {
        // ── Manual Flow (Show Image 1) ──
        if (!printSuccess) {
          setPaperOutErrorMessage(isCoverOpenDetected ? 'ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท' : isPaperOut ? 'กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่ (58 มม.)' : printDetail);
          setShowPaperOutModal(true);
        } else {
          setShowGeneratedPassModal(true);
        }
      }
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('เกิดข้อผิดพลาด', e.message || 'ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const handleRetryPrint = async () => {
    if (!lastSlipData) return;
    setIsRetryingPrint(true);
    try {
      const res = await SunmiPrinterService.printVisitorSlip(lastSlipData);
      setIsRetryingPrint(false);
      if (res.success) {
        setShowPaperOutModal(false);
        setGeneratedPassResult((prev) =>
          prev ? { ...prev, printSuccess: true, printDetail: 'พิมพ์สลิปสำเร็จ' } : null
        );
        Alert.alert('✓ พิมพ์สำเร็จ', 'พิมพ์สลิปผู้ติดต่อเรียบร้อยแล้ว', [
          {
            text: 'ตกลง',
            onPress: () => {
              if (postPrintAction) {
                postPrintAction();
              } else if (autoCheckIn) {
                if (enableGateControl) setShowGateModal(true);
                else navigation.goBack();
              } else {
                setShowGeneratedPassModal(true);
              }
            },
          },
        ]);
      } else {
        Alert.alert(
          'ยังไม่สามารถพิมพ์ได้',
          res.message || 'กรุณาตรวจสอบว่าใส่กระดาษม้วนใหม่และปิดฝาสนิทแล้วหรือไม่'
        );
      }
    } catch (e: any) {
      setIsRetryingPrint(false);
      Alert.alert('เกิดข้อผิดพลาดในการพิมพ์', e?.message || 'โปรดลองใหม่อีกครั้ง');
    }
  };

  const handleSkipPaperOut = () => {
    setShowPaperOutModal(false);
    if (postPrintAction) {
      postPrintAction();
    } else if (autoCheckIn) {
      if (enableGateControl) setShowGateModal(true);
      else navigation.goBack();
    } else {
      setShowGeneratedPassModal(true);
    }
  };

  // ── Action handlers for GeneratedPassResultModal ──
  const handleCheckInOnly = async () => {
    const targetPassId = generatedPassResult?.passRecordId || passRecordIdForCheckIn;
    const guardUserId = guard?.userId || '';
    setShowGeneratedPassModal(false);
    setActionToast({
      visible: true,
      title: 'กำลังลงเวลาเข้า...',
      message: 'ระบบกำลังบันทึกเวลาเข้าสู่ฐานข้อมูล',
    });

    let result: { status?: boolean | string; message?: string; error?: string } = {
      status: true,
      message: 'ระบบบันทึกเวลาเข้าเรียบร้อยแล้ว',
    };

    try {
      if (targetPassId && guardUserId) {
        result = await vmsApi.updatePassCheckInStatus(targetPassId, guardUserId);
      } else {
        result = {
          status: false,
          message: !targetPassId ? 'ไม่พบ passRecordId' : 'ไม่พบ guard userId',
        };
      }
    } catch (e: any) {
      result = {
        status: false,
        message: e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
      };
    }

    setActionToast(null);

    if (result?.status === true || result?.status === 'check_in_success' || result?.status === 'success') {
      setResultModal({
        visible: true,
        type: 'success',
        title: 'ลงเวลาเข้าสำเร็จ',
        message: result.message || 'ระบบบันทึกเวลาเข้าเรียบร้อยแล้ว',
        autoCloseSeconds: 3,
      });
    } else {
      setResultModal({
        visible: true,
        type: 'error',
        title: 'ลงเวลาเข้าไม่สำเร็จ',
        message: result?.message || result?.error || 'ระบบไม่สามารถบันทึกเวลาเข้าได้',
        autoCloseSeconds: 4,
      });
    }
  };

  const handleCheckInAndOpenGate = async () => {
    const targetPassId = generatedPassResult?.passRecordId || passRecordIdForCheckIn;
    const guardUserId = guard?.userId || '';
    setShowGeneratedPassModal(false);
    setActionToast({
      visible: true,
      title: 'กำลังลงเวลาเข้า...',
      message: 'ระบบกำลังบันทึกเวลาเข้าและเตรียมเปิดไม้กั้น',
    });

    let result: { status?: boolean | string; message?: string; error?: string } = {
      status: true,
      message: 'ระบบบันทึกเวลาเข้าเรียบร้อยแล้ว',
    };

    try {
      if (targetPassId && guardUserId) {
        result = await vmsApi.updatePassCheckInStatus(targetPassId, guardUserId);
      }
    } catch (e: any) {
      result = {
        status: false,
        message: e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
      };
    }

    setActionToast(null);

    if (result?.status === false) {
      Alert.alert(
        'ลงเวลาเข้าไม่สำเร็จ',
        result?.message || 'ไม่สามารถลงเวลาเข้าได้ แต่จะดำเนินการเปิดไม้กั้นต่อไป',
        [
          {
            text: 'เปิดไม้กั้น',
            onPress: () => setShowGateModal(true),
          },
          {
            text: 'ยกเลิก',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      setShowGateModal(true);
    }
  };

  const handlePerformOpenGate = async () => {
    setShowGateModal(false);
    setActionToast({
      visible: true,
      title: 'กำลังส่งคำสั่งเปิดไม้กั้น...',
      message: 'ระบบกำลังส่งสัญญาณไปยังไม้กั้นทางเข้า',
    });

    const res = await vmsApi.sendGateCommand(
      'door_open_in',
      guardhouse?.id,
      guardhouse?.serviceId,
      guard?.userId,
      {
        houseNo: houseNo || '',
        triggerSource: 'checkin_flow',
        guardName: guard?.name,
        guardhouseName: guardhouse?.name,
        serviceName: guardhouse?.villageName || guardhouse?.name,
      }
    );
    setActionToast(null);

    if (res?.status === true || res?.message === 'Command sent successfully') {
      setResultModal({
        visible: true,
        type: 'success',
        title: 'เปิดไม้กั้นสำเร็จ',
        message: 'ส่งคำสั่งเปิดไม้กั้นขาเข้าเรียบร้อย',
        autoCloseSeconds: 3,
      });
    } else {
      setResultModal({
        visible: true,
        type: 'error',
        title: 'เปิดไม้กั้นไม่สำเร็จ',
        message: res?.message || 'ไม่สามารถส่งคำสั่งเปิดไม้กั้นได้',
        autoCloseSeconds: 4,
      });
    }
  };

  const handleFinish = () => {
    setShowGeneratedPassModal(false);
    navigation.goBack();
  };

  // ── Render helper: Photo capture button ──
  const renderPhotoField = (
    target: PhotoTarget,
    label: string,
    captured: string | null
  ) => (
    <View style={styles.photoRow}>
      {/* Thumbnail preview */}
      {captured && (
        <Image
          source={{ uri: `file://${captured}` }}
          style={styles.photoThumb}
          resizeMode="cover"
        />
      )}
      <View style={styles.photoLabelCol}>
        <Text style={styles.photoLabel}>{label}</Text>
        <Text style={styles.photoSub}>
          {captured ? '✅ ถ่ายรูปแล้ว · Backend ประมวลผล OCR อัตโนมัติ' : 'ยังไม่ได้ถ่ายรูป'}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.photoBtn, Boolean(captured) && styles.photoBtnDone]}
        onPress={() => openCameraForPhoto(target)}
        activeOpacity={0.8}
      >
        <Text style={styles.photoBtnText}>{captured ? '🔄 ถ่ายใหม่' : '📷 ถ่ายรูป'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LiffHeader />

      {/* Top Navbar */}
      <View style={styles.subHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={step === 2 ? handleBackToReasons : () => navigation.goBack()}
        >
          <Text style={styles.backText}>
            {step === 2 ? '‹ เลือกเหตุผลใหม่' : '‹ ย้อนกลับ'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle}>บันทึกผู้ติดต่อเข้า (Check-In)</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* ── STEP 1 : เลือกเหตุผล ── */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.stepOneHeaderBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNumber}>1</Text>
              <Text style={styles.sectionTitle}>เลือกเหตุผลการเข้า</Text>
            </View>
            <Text style={styles.stepOneSubTitle}>แตะเลือกประเภทหรือเหตุผลที่ผู้ติดต่อเข้ามาในโครงการ</Text>
          </View>

          <View style={styles.reasonList}>
            {reasonsList.map((r, idx) => {
              const icon = getReasonIcon(r.name);
              const runningNum = `${idx + 1}`;

              return (
                <TouchableOpacity
                  key={r.id}
                  style={styles.reasonCardNew}
                  onPress={() => handleSelectReason(r)}
                  activeOpacity={0.75}
                >
                  {/* Running Number Badge */}
                  <View style={styles.reasonNumBadge}>
                    <Text style={styles.reasonNumText}>{runningNum}</Text>
                  </View>

                  {/* Contextual Icon Avatar */}
                  <View style={styles.reasonIconBox}>
                    <Text style={styles.reasonEmoji}>{icon}</Text>
                  </View>

                  {/* Reason Title */}
                  <View style={styles.reasonTextBox}>
                    <Text style={styles.reasonTitle}>{r.name}</Text>
                    <View style={r.requires_house_number !== false ? styles.houseRequiredTag : styles.houseOptionalTag}>
                      <Text style={r.requires_house_number !== false ? styles.houseRequiredTagText : styles.houseOptionalTagText}>
                        {r.requires_house_number !== false ? 'ต้องระบุบ้านเลขที่' : 'ไม่ต้องระบุบ้านเลขที่'}
                      </Text>
                    </View>
                  </View>

                  {/* Arrow Action Indicator */}
                  <View style={styles.reasonArrowBadge}>
                    <Text style={styles.reasonArrowNew}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── STEP 2 : กรอกรายละเอียด ── */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Banner: เหตุผลที่เลือก */}
          <View style={styles.selectedReasonBanner}>
            <View style={styles.selectedReasonLeft}>
              <Text style={styles.selectedReasonLabel}>เหตุผลการเข้า</Text>
              <Text style={styles.selectedReasonText}>{selectedReason}</Text>
            </View>
            <TouchableOpacity style={styles.changeReasonBtn} onPress={handleBackToReasons}>
              <Text style={styles.changeReasonBtnText}>เปลี่ยน</Text>
            </TouchableOpacity>
          </View>

          {/* ── บ้านเลขที่ (number_house) ── */}
          {selectedReasonRequiresHouseNumber && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>2</Text>
                <Text style={styles.sectionTitle}>บ้านเลขที่ที่ติดต่อ *</Text>
              </View>
              <TouchableOpacity
                style={styles.housePicker}
                onPress={() => setShowKeypad(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.houseText, !houseNo && styles.housePlaceholder]}>
                  {houseNo ? `🏠 บ้านเลขที่ ${houseNo}` : 'แตะเพื่อระบุบ้านเลขที่ (เช่น 259/90)'}
                </Text>
                <View style={styles.keypadBadge}>
                  <Text style={styles.keypadBadgeText}>⌨️</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* ฟอร์มขั้นถัดไปจะแสดงหลังเลือกบ้านเลขที่แล้ว */}
          {hasPassedHouseStep && (
            <>
          {/* ── ชื่อผู้มาติดต่อ (name) ── */}
          {requiredFields.name && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>3</Text>
                <Text style={styles.sectionTitle}>ชื่อ-สกุลผู้มาติดต่อ</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="ชื่อ-สกุล ผู้มาติดต่อ"
                placeholderTextColor="#94A3B8"
                value={visitorName}
                onChangeText={setVisitorName}
              />
            </>
          )}

          {/* ── เลขบัตรประชาชน (id_number) ── */}
          {requiredFields.id_number && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>•</Text>
                <Text style={styles.sectionTitle}>เลขบัตรประชาชน</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="x-xxxx-xxxxx-xx-x"
                placeholderTextColor="#94A3B8"
                value={idNumber}
                onChangeText={setIdNumber}
                keyboardType="numeric"
                maxLength={13}
              />
            </>
          )}

          {/* ── เพศ (gender) ── */}
          {requiredFields.gender && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>•</Text>
                <Text style={styles.sectionTitle}>เพศ</Text>
              </View>
              <View style={styles.pillRow}>
                {genderOptions.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, gender === g && styles.pillSelected]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.pillText, gender === g && styles.pillTextSelected]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── ทะเบียนรถ (vehicle implied from current) ── */}
          {requiredFields.vehicle !== false && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>•</Text>
                <Text style={styles.sectionTitle}>ทะเบียนรถ</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="เช่น 1กข-9999 กทม."
                placeholderTextColor="#94A3B8"
                value={licensePlate}
                onChangeText={setLicensePlate}
              />
            </>
          )}

          {/* ── ประเภทยานพาหนะ ── */}
          {requiredFields.vehicle !== false && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>•</Text>
                <Text style={styles.sectionTitle}>ประเภทยานพาหนะ</Text>
              </View>
              <View style={styles.pillRow}>
                {vehicleTypes.map((vt) => (
                  <TouchableOpacity
                    key={vt}
                    style={[styles.pill, vehicleType === vt && styles.pillSelected]}
                    onPress={() => setVehicleType(vt)}
                  >
                    <Text style={[styles.pillText, vehicleType === vt && styles.pillTextSelected]}>{vt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── สีรถ (color_vehicle) ── */}
          {requiredFields.color_vehicle && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>•</Text>
                <Text style={styles.sectionTitle}>สีรถ</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="เช่น สีขาว, สีดำ"
                placeholderTextColor="#94A3B8"
                value={vehicleColor}
                onChangeText={setVehicleColor}
              />
            </>
          )}

          {/* ── รูปบัตรประชาชน (picture_id_card) ── */}
          {requiredFields.picture_id_card && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>📷</Text>
                <Text style={styles.sectionTitle}>รูปถ่ายบัตรประชาชน *</Text>
              </View>
              {renderPhotoField('id_card', 'บัตรประชาชน', photoIdCard)}
              <View style={styles.ocrNotice}>
                <Text style={styles.ocrNoticeText}>
                  🤖 Backend จะประมวลผล OCR อัตโนมัติหลัง Submit
                </Text>
              </View>
            </>
          )}

          {/* ── รูปป้ายทะเบียน (picture_car_number) ── */}
          {requiredFields.picture_car_number && canShowCarPhoto && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>📷</Text>
                <Text style={styles.sectionTitle}>รูปถ่ายป้ายทะเบียนรถ</Text>
              </View>
              {renderPhotoField('car_number', 'ป้ายทะเบียนรถ', photoCarNumber)}
            </>
          )}

          {/* ── QR บัตรผู้มาติดต่อ (visitor_qr_code) ── */}
          {needsVisitorCard &&
            (!requiredFields.picture_car_number || Boolean(photoCarNumber)) && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionNumber}>🔍</Text>
                  <Text style={styles.sectionTitle}>สแกนบัตรผู้มาติดต่อ *</Text>
                </View>
                <View style={styles.photoRow}>
                  <View style={styles.photoLabelCol}>
                    <Text style={styles.photoLabel}>
                      {visitorQrCode ? '✅ สแกนบัตรแล้ว' : 'QR Code / บัตรผู้มาติดต่อ'}
                    </Text>
                    <Text style={styles.photoSub}>
                      {visitorQrCode ? visitorQrCode : 'กดปุ่มสแกน หรือปุ่มส้มด้านข้างเครื่อง'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.photoBtn, Boolean(visitorQrCode) && styles.photoBtnDone]}
                    onPress={() => setShowVisitorScanner(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.photoBtnText}>{visitorQrCode ? '🔄 สแกนใหม่' : '📡 สแกน'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          {/* Action Button */}
          {canShowSubmit && (
          <View style={styles.bottomActions}>
            <LiteButton
              title="🖨️ สร้างรายการ และ พิมพ์ใบเสร็จ"
              onPress={handleSubmit}
              loading={submitting}
              variant="primary"
              style={styles.submitBtn}
            />
          </View>
          )}
            </>
          )}
        </ScrollView>
      )}

      {/* Keypad Modal */}
      <KeypadModal
        visible={showKeypad}
        houseNumbers={houseNumbers}
        onConfirm={handleHouseConfirmed}
        onCancel={() => setShowKeypad(false)}
      />

      {/* Photo Capture Modal — ถ่ายรูปจริงด้วย Camera2 */}
      <PhotoCaptureModal
        visible={showCamera}
        captureType={cameraTarget === 'car_number' ? 'car_number' : 'id_card'}
        title={cameraTarget === 'id_card' ? '📷 ถ่ายรูปบัตรประชาชน' : '📷 ถ่ายรูปป้ายทะเบียน'}
        subtitle={cameraTarget === 'id_card'
          ? 'วางบัตรประชาชนให้อยู่ในกรอบ ให้ชัดเจน'
          : 'วางป้ายทะเบียนให้อยู่ในกรอบ'
        }
        showPreview={showPhotoPreview}
        onClose={() => {
          setShowCamera(false);
          setCameraTarget(null);
          setIsAutoPhotoSequence(false);
          setOpeningCamera(false);
        }}
        onCapture={handlePhotoCapture}
      />

      <CameraScannerModal
        visible={showVisitorScanner}
        title="สแกนบัตรผู้มาติดต่อ"
        subtitle="วาง QR Code บนบัตรผู้มาติดต่อให้อยู่ภายในกรอบ"
        onClose={() => setShowVisitorScanner(false)}
        onScan={acceptVisitorQrCode}
      />

      {/* Generated Pass Result Modal (PWA 1:1 Match) */}
      <GeneratedPassResultModal
        visible={showGeneratedPassModal}
        data={generatedPassResult}
        onCheckInOnly={handleCheckInOnly}
        onCheckInAndOpenGate={handleCheckInAndOpenGate}
        onRetryPrint={handleRetryPrint}
        onFinish={handleFinish}
      />

      {/* Paper Out / Retry Print Modal */}
      <PaperOutModal
        visible={showPaperOutModal}
        slipData={lastSlipData}
        isCoverOpen={isCoverOpen}
        isPrinting={isRetryingPrint}
        errorMessage={paperOutErrorMessage}
        onRetryPrint={handleRetryPrint}
        onSkip={handleSkipPaperOut}
      />

      {/* Gate Open Modal (Prominent Step) */}
      <GateCountdownModal
        visible={showGateModal}
        direction="IN"
        hasCountdown={false}
        onOpenNow={handlePerformOpenGate}
        onCancel={() => {
          setShowGateModal(false);
          navigation.goBack();
        }}
      />

      {/* Result Status Modal (Theme Matched with 3s Auto-Close) */}
      {resultModal?.visible && (
        <ResultStatusModal
          visible={true}
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          autoCloseSeconds={resultModal.autoCloseSeconds ?? 3}
          onClose={() => {
            setResultModal(null);
            navigation.goBack();
          }}
        />
      )}

      {/* Action Toast Overlay */}
      {actionToast?.visible && (
        <LoadingOverlay
          visible={true}
          title={actionToast.title}
          message={actionToast.message}
        />
      )}

      {/* Loading Overlay — fetch */}
      <LoadingOverlay
        visible={loadingBackend}
        title="กำลังโหลดข้อมูล..."
        message="กำลังติดต่อ Backend เพื่อดึงรายการเหตุผลและ config ฟอร์ม"
      />

      <LoadingOverlay
        visible={openingCamera}
        title="กำลังเปิดกล้อง..."
        message="โปรดรอสักครู่ ระบบกำลังเตรียมกล้องสำหรับถ่ายรูปเอกสาร"
      />

      <LoadingOverlay
        visible={showPhotoTransition}
        title="✓ ถ่ายบัตรประชาชนสำเร็จ"
        message="กำลังเตรียมกล้องเพื่อถ่ายรูปป้ายทะเบียนรถเป็นขั้นตอนถัดไป"
      />

      {/* Loading Overlay — submit */}
      <LoadingOverlay
        visible={submitting}
        title="กำลังสร้างรายการ และ พิมพ์ใบเสร็จ..."
        message="กำลังส่งข้อมูลไปยัง Backend และสั่งพิมพ์ใบเสร็จความร้อน Sunmi 58mm"
      />

      {/* Persistent Bottom Nav */}
      <LiffBottomNav navigation={navigation} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: '#1D4ED8', fontSize: 14, fontWeight: '800' },
  subHeaderTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8 },
  sectionNumber: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1D4ED8', color: '#FFFFFF',
    fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 22, marginRight: 8,
  },
  sectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800' },

  // Step 1: Reason List (Unified VMP Corporate Theme)
  stepOneHeaderBox: {
    marginBottom: 10,
    marginTop: 4,
  },
  stepOneSubTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginLeft: 30,
  },
  reasonList: {
    gap: 12,
    marginTop: 4,
  },
  reasonCardNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderLeftWidth: 6,
    borderColor: '#BFDBFE',
    borderLeftColor: '#2563EB',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  reasonNumBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    marginRight: 10,
  },
  reasonNumText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  reasonIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    marginRight: 12,
  },
  reasonEmoji: {
    fontSize: 24,
  },
  reasonTextBox: {
    flex: 1,
    justifyContent: 'center',
  },
  reasonTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  houseRequiredTag: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
  },
  houseRequiredTagText: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '800',
  },
  houseOptionalTag: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#DCFCE7',
  },
  houseOptionalTagText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  reasonArrowBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginLeft: 8,
  },
  reasonArrowNew: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2563EB',
    lineHeight: 24,
  },

  // Step 2: Banner
  selectedReasonBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#BFDBFE',
    padding: 14, marginTop: 4, marginBottom: 4,
  },
  selectedReasonLeft: { flex: 1 },
  selectedReasonLabel: { color: '#1D4ED8', fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  selectedReasonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  changeReasonBtn: { backgroundColor: '#1D4ED8', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10 },
  changeReasonBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // House picker
  housePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#3B82F6',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
  },
  houseText: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  housePlaceholder: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  keypadBadge: {
    backgroundColor: '#EFF6FF', paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE',
  },
  keypadBadgeText: { color: '#1D4ED8', fontSize: 13, fontWeight: '800' },

  // Generic input
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#CBD5E1',
    color: '#0F172A', fontSize: 15, fontWeight: '700',
  },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1',
  },
  pillSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  pillText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  pillTextSelected: { color: '#FFFFFF', fontWeight: '800' },

  // Photo capture
  photoRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 12, gap: 10,
  },
  photoLabelCol: { flex: 1 },
  photoLabel: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  photoSub: { color: '#64748B', fontSize: 11, marginTop: 2, fontWeight: '600' },
  photoBtn: {
    backgroundColor: '#1D4ED8', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 10,
  },
  photoBtnDone: { backgroundColor: '#059669' },
  photoBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  photoThumb: {
    width: 56, height: 56, borderRadius: 8,
    borderWidth: 1, borderColor: '#CBD5E1',
  },

  // OCR notice
  ocrNotice: {
    backgroundColor: '#F0FDF4', borderRadius: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
    paddingVertical: 8, paddingHorizontal: 12, marginTop: 6,
  },
  ocrNoticeText: { color: '#166534', fontSize: 12, fontWeight: '700' },

  bottomActions: { marginTop: 24 },
  submitBtn: { minHeight: 56 },
});
