import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { LiffBottomNav } from '../../components/layout/LiffTabsAndNav';
import { KeypadModal } from '../../components/common/KeypadModal';
import { PhotoCaptureModal } from '../../components/common/PhotoCaptureModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { ResultStatusModal } from '../../components/common/ResultStatusModal';
import { SunmiPrinterService, VisitorSlipData } from '../../hardware/SunmiPrinter';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

type RequestType = 'NEW' | 'DAMAGED';
type WizardStep = 'request_type' | 'reason' | 'id_photo' | 'plate_photo' | 'review';

const getReasonIcon = (name: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('อาหาร') || n.includes('food') || n.includes('grab') || n.includes('lineman') || n.includes('panda') || n.includes('shopee')) return '🛵';
  if (n.includes('ญาติ') || n.includes('เพื่อน') || n.includes('ครอบครัว') || n.includes('เยี่ยม')) return '👥';
  if (n.includes('รับ-ส่ง') || n.includes('ลูกค้า') || n.includes('แท็กซี่')) return '🚗';
  if (n.includes('ขยะ')) return '🚛';
  if (n.includes('พัสดุ') || n.includes('ไปรษณีย์')) return '📦';
  if (n.includes('แม่บ้าน') || n.includes('ทำความสะอาด')) return '🧹';
  if (n.includes('ไฟฟ้า')) return '⚡';
  return '📋';
};

const stepLabels: Record<WizardStep, string> = {
  request_type: 'ขั้นตอน 1 จาก 5: เลือกประเภทคำขอ',
  reason: 'ขั้นตอน 2 จาก 5: เลือกเหตุผลการติดต่อ',
  id_photo: 'ขั้นตอน 3 จาก 5: ถ่ายบัตรประชาชน',
  plate_photo: 'ขั้นตอน 4 จาก 5: ถ่ายป้ายทะเบียนรถ',
  review: 'ขั้นตอน 5 จาก 5: ตรวจสอบก่อนส่งคำขอ',
};

export const GuardQrPassRequestScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { guardhouse, guard, showPhotoPreview } = useAppStore();
  const [step, setStep] = useState<WizardStep>('request_type');
  const [reasons, setReasons] = useState<any[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<{ visitor_qr_code?: boolean }>({});
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [reason, setReason] = useState<any>(null);
  const [house, setHouse] = useState('');
  const [idPhoto, setIdPhoto] = useState('');
  const [platePhoto, setPlatePhoto] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [camera, setCamera] = useState<'id_card' | 'car_number' | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [showPhotoTransition, setShowPhotoTransition] = useState(false);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [resultModal, setResultModal] = useState<{
    type: 'success' | 'error' | 'warning'; title: string; message: string;
  } | null>(null);

  useEffect(() => {
    if (!guardhouse?.serviceId) return;
    Promise.all([
      vmsApi.getEntryReasons(guardhouse.serviceId),
      vmsApi.getHouseNumbers(guardhouse.serviceId),
      vmsApi.getRequiredFields(guardhouse.serviceId),
    ])
      .then(([items, houseList, fields]) => {
        setReasons(items.filter((item: any) => item.active !== false && item.allow_qr_pass_request === true));
        setHouses(houseList);
        setRequiredFields(fields || {});
      })
      .catch(() => Alert.alert('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง'));
  }, [guardhouse?.serviceId]);

  const goBack = () => {
    if (step === 'request_type') return navigation.goBack();
    if (step === 'reason') return setStep('request_type');
    if (step === 'id_photo') return setStep('reason');
    if (step === 'plate_photo') return setStep('id_photo');
    setStep('plate_photo');
  };

  const chooseReason = (selected: any) => {
    setReason(selected);
    if (!selected.requires_house_number) {
      setHouse('000/00');
      setStep('id_photo');
      beginCamera('id_card');
    } else {
      setShowKeypad(true);
    }
  };

  const beginCamera = (target: 'id_card' | 'car_number') => {
    setOpeningCamera(true);
    setTimeout(() => {
      setCamera(target);
      setOpeningCamera(false);
    }, 200);
  };

  const onCapture = (path: string) => {
    if (camera === 'id_card') {
      setIdPhoto(path);
      setStep('plate_photo');
      setCamera(null);
      setShowPhotoTransition(true);
      setTimeout(() => {
        setShowPhotoTransition(false);
        beginCamera('car_number');
      }, 1200);
    } else {
      setPlatePhoto(path);
      setCamera(null);
      setStep('review');
    }
  };

  const submit = async () => {
    if (!requestType || !reason || !house || !idPhoto || !platePhoto || !guardhouse?.serviceId) return;
    setLoading(true);
    try {
      const response = await vmsApi.submitGuardQrPassRequest({
        project: guardhouse.serviceId, reason_entry_exit: reason.id, request_type: requestType,
        house_number: house, guard_id: guard?.id, guardhouse_id: guardhouse.id,
        picture_id_card: idPhoto, picture_car_number: platePhoto,
      });
      if (!response?.status) throw new Error(response?.message || 'ส่งคำขอไม่สำเร็จ');
      setShowCheckInPrompt(true);
    } catch (error: any) {
      Alert.alert('ส่งคำขอไม่สำเร็จ', error?.message || 'โปรดลองอีกครั้ง');
    } finally { setLoading(false); }
  };

  const checkInAndPrint = async () => {
    if (!guardhouse?.serviceId || !reason) return;
    setShowCheckInPrompt(false);
    setLoading(true);
    try {
      let guardUserId = guard?.userId;
      if (!guardUserId && guard?.id) {
        const guardDetail = await vmsApi.getSecurityGuardDetail(guard.id);
        guardUserId = guardDetail?.userprofile?.guard_select_profile?.user_id
          || guardDetail?.guard_select_userprofile_detail?.user_id
          || guardDetail?.user_id
          || undefined;
      }
      if (!guardUserId) throw new Error('ไม่พบ userId ที่ผูกกับ รปภ. ของอุปกรณ์นี้');

      const checkInPayload = {
        // Keep this payload in lockstep with CheckInScreen. The backend requires
        // a guard userId before it will create a check-in transaction.
        userId: guardUserId, service_name_id: guardhouse.serviceId,
        ServiceNameFiled_id: guardhouse.serviceId, reason_entry_file_id: reason.id,
        reason_entry: reason.name, number_house: house, name: '', id_number: '', gender: 'ไม่ระบุ',
        vehicle: '', color_vehicle: '', car_number: '', picture_id_card: idPhoto,
        picture_car_number: platePhoto, guardhouse_id: guardhouse.id || undefined,
      };

      let result: any;
      let passId = '';
      let qrPayload = '';
      if (requiredFields.visitor_qr_code) {
        let activeGuardhouseId = guardhouse.id;
        if (!activeGuardhouseId || !/^[0-9a-fA-F-]{36}$/.test(activeGuardhouseId)) {
          const guardhouses = await vmsApi.getGuardhousesByService(guardhouse.serviceId);
          activeGuardhouseId = guardhouses.find((item: any) => item?.id === guardhouse.id)?.id || guardhouses[0]?.id;
        }
        if (!activeGuardhouseId || !/^[0-9a-fA-F-]{36}$/.test(activeGuardhouseId)) {
          throw new Error('ไม่พบข้อมูลป้อมที่กำลังปฏิบัติงาน จึงไม่สามารถจองบัตร QR Code ได้');
        }
        const reserved = await vmsApi.reserveGeneratedVisitorQr(activeGuardhouseId, guardUserId);
        const generatedQrId = reserved?.generated_qr?.visitor_qr_id;
        if (!reserved?.status || !generatedQrId) {
          throw new Error(reserved?.message || 'ไม่สามารถจอง QR Code สำหรับผู้ติดต่อได้');
        }
        qrPayload = reserved.generated_qr.payload || '';
        passId = reserved.generated_qr.running_number ? `Visitor #${reserved.generated_qr.running_number}` : generatedQrId;
        result = await vmsApi.submitCheckIn({
          ...checkInPayload,
          guardhouse_id: activeGuardhouseId,
          visitor_qr_code: generatedQrId,
          visitor_qr_source: 'generated_qr',
        });
      } else {
        result = await vmsApi.submitCheckIn(checkInPayload);
      }
      if (result?.status !== 'check_in_success') throw new Error(result?.message || 'Backend ไม่สามารถบันทึก Check-In ได้');
      const now = new Date();
      passId = passId || result.id || `VMS-${Date.now()}`;
      const slip: VisitorSlipData = {
        title: 'บัตรผู้มาติดต่อ (VISITOR PASS)', serviceName: guardhouse.villageName, villageName: guardhouse.villageName,
        dateStr: now.toLocaleDateString('th-TH'), timeStr: now.toLocaleTimeString('th-TH'), guardhouse: guardhouse.name,
        reason: reason.name, houseNo: house, licensePlate: '-', vehicleType: '-', visitorName: '-', qrPayload: qrPayload || passId,
        legacyQrPayload: qrPayload || '', barcodePayload: '', payloadMode: 'legacy', passId, validUntil: '', validHours: 24,
        checkoutRequired: true, allowLateCheckout: false,
      };
      const printed = await SunmiPrinterService.printVisitorSlip(slip);
      setResultModal(printed?.success
        ? { type: 'success', title: 'บันทึกเข้าและพิมพ์สำเร็จ', message: 'พิมพ์บัตรผ่านเรียบร้อยแล้ว' }
        : { type: 'warning', title: 'บันทึกเข้าสำเร็จ แต่พิมพ์ไม่สำเร็จ', message: printed?.message || 'กรุณาตรวจสอบกระดาษและเครื่องพิมพ์ Sunmi' }
      );
    } catch (error: any) {
      setResultModal({ type: 'error', title: 'บันทึกเข้าไม่สำเร็จ', message: error?.message || 'คำขอ QR ถูกบันทึกไว้แล้ว กรุณาลองบันทึกเข้าอีกครั้ง' });
    } finally { setLoading(false); }
  };

  const requestLabel = requestType === 'NEW' ? 'ขอออกบัตรใหม่' : 'บัตรเดิมชำรุด';
  return <View style={s.root}>
    <LiffHeader />
    <View style={s.subHeader}><TouchableOpacity style={s.backBtn} onPress={goBack}><Text style={s.back}>‹ {step === 'request_type' ? 'กลับหน้าหลัก' : 'ย้อนกลับ'}</Text></TouchableOpacity><Text style={s.subHeaderTitle}>ลงทะเบียนบัตร QR Code</Text><View style={s.subHeaderSpacer} /></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <Text style={s.progress}>{stepLabels[step]}</Text>
    {step === 'request_type' && <View style={s.section}><Text style={s.heading}>เลือกประเภทคำขอ</Text>
      <Choice icon="🆕" title="ขอออกบัตรใหม่" hint="ลงทะเบียนเพื่อขอออกบัตรผ่าน QR Code" onPress={() => { setRequestType('NEW'); setStep('reason'); }} />
      <Choice icon="🪪" title="บัตรเดิมชำรุด" hint="ขอออกบัตรผ่าน QR Code ทดแทน" onPress={() => { setRequestType('DAMAGED'); setStep('reason'); }} />
    </View>}
    {step === 'reason' && <View style={s.section}><View style={s.reasonHeader}><View style={s.stepNumber}><Text style={s.stepNumberText}>2</Text></View><Text style={s.heading}>เลือกเหตุผลการติดต่อ</Text></View><Text style={s.caption}>เลือกได้เฉพาะเหตุผลที่เปิดสิทธิ์สำหรับการขอออกบัตร QR Code</Text>
      <View style={s.reasonList}>{reasons.map((item, index) => {
        const requiresHouseNumber = item.requires_house_number === true;
        const allowsSkippingHouseNumber = requiresHouseNumber && item.allow_first === true;
        const tagStyle = !requiresHouseNumber ? s.houseOptionalTag : allowsSkippingHouseNumber ? s.houseSkippableTag : s.houseRequiredTag;
        const tagTextStyle = !requiresHouseNumber ? s.houseOptionalTagText : allowsSkippingHouseNumber ? s.houseSkippableTagText : s.houseRequiredTagText;
        const tagLabel = !requiresHouseNumber ? 'ไม่ต้องระบุบ้านเลขที่' : allowsSkippingHouseNumber ? 'ข้ามบ้านเลขที่ได้' : 'ต้องระบุบ้านเลขที่';
        return <TouchableOpacity key={item.id} style={s.reasonCard} onPress={() => chooseReason(item)} activeOpacity={0.75}>
          <View style={s.reasonNumBadge}><Text style={s.reasonNumText}>{index + 1}</Text></View>
          <View style={s.reasonIconBox}><Text style={s.reasonEmoji}>{getReasonIcon(item.name)}</Text></View>
          <View style={s.reasonTextBox}><Text style={s.reasonTitle}>{item.name}</Text><View style={tagStyle}><Text style={tagTextStyle}>{tagLabel}</Text></View></View>
          <View style={s.reasonArrowBadge}><Text style={s.reasonArrow}>›</Text></View>
        </TouchableOpacity>;
      })}</View>
      {!reasons.length && <Text style={s.empty}>ยังไม่มีเหตุผลที่เปิดให้สร้างบัตรผ่าน QR Code</Text>}
    </View>}
    {step === 'id_photo' && <PhotoStep icon="🪪" title="ถ่ายรูปบัตรประชาชน" hint="กรุณาวางบัตรให้อยู่ในกรอบภาพ" label={idPhoto ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายบัตรประชาชน'} onPress={() => beginCamera('id_card')} />}
    {step === 'plate_photo' && <PhotoStep icon="🚘" title="ถ่ายรูปป้ายทะเบียนรถ" hint="กรุณาให้เห็นป้ายทะเบียนชัดเจน" label={platePhoto ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายป้ายทะเบียน'} onPress={() => beginCamera('car_number')} />}
    {step === 'review' && <View style={s.section}><Text style={s.heading}>ตรวจสอบข้อมูลคำขอ</Text><View style={s.summary}>
      <Summary label="ประเภทคำขอ" value={requestLabel} /><Summary label="เหตุผลการติดต่อ" value={reason?.name || '-'} /><Summary label="บ้านเลขที่" value={house === '000/00' ? '000/00 - ผู้มาติดต่อส่วนกลาง' : house} /><Summary label="เอกสาร" value="บัตรประชาชน และป้ายทะเบียนรถ" />
    </View><TouchableOpacity style={s.submit} onPress={submit}><Text style={s.buttonText}>ส่งคำขอออกบัตร QR Code</Text></TouchableOpacity></View>}
    </ScrollView>
  <KeypadModal visible={showKeypad} title="ระบุบ้านเลขที่" houseNumbers={houses} canSubmitEmpty={false} onConfirm={value => { setHouse(value); setShowKeypad(false); setStep('id_photo'); beginCamera('id_card'); }} onCancel={() => setShowKeypad(false)} />
  <PhotoCaptureModal
    visible={!!camera}
    captureType={camera || 'id_card'}
    title={camera === 'car_number' ? '📷 ถ่ายรูปป้ายทะเบียน' : '📷 ถ่ายรูปบัตรประชาชน'}
    subtitle={camera === 'car_number' ? 'ให้เห็นป้ายทะเบียนรถชัดเจน' : 'วางบัตรประชาชนให้อยู่ในกรอบ'}
    showPreview={showPhotoPreview}
    onCapture={onCapture}
    onClose={() => setCamera(null)}
  />
  <LoadingOverlay visible={loading} title="กำลังดำเนินการ" message="กำลังส่งข้อมูลและรูปภาพ..." />
  <LoadingOverlay visible={openingCamera} title="กำลังเปิดกล้อง..." message="โปรดรอสักครู่ ระบบกำลังเตรียมกล้องสำหรับถ่ายรูปเอกสาร" />
  <LoadingOverlay visible={showPhotoTransition} title="✓ ถ่ายบัตรประชาชนสำเร็จ" message="กำลังเตรียมกล้องเพื่อถ่ายรูปป้ายทะเบียนรถเป็นขั้นตอนถัดไป" />
  <CheckInPromptModal visible={showCheckInPrompt} onSkip={() => { setShowCheckInPrompt(false); navigation.goBack(); }} onConfirm={checkInAndPrint} />
  {resultModal && <ResultStatusModal visible type={resultModal.type} title={resultModal.title} message={resultModal.message} autoCloseSeconds={0} onClose={() => { setResultModal(null); navigation.goBack(); }} />}
  <LiffBottomNav navigation={navigation} />
  </View>;
};

const Choice = ({ icon, title, hint, onPress }: any) => <TouchableOpacity style={s.choice} onPress={onPress}><Text style={s.choiceIcon}>{icon}</Text><View style={s.choiceCopy}><Text style={s.choiceTitle}>{title}</Text><Text style={s.choiceHint}>{hint}</Text></View><Text style={s.arrow}>›</Text></TouchableOpacity>;
const PhotoStep = ({ icon, title, hint, label, onPress }: any) => <View style={s.photoStep}><Text style={s.bigIcon}>{icon}</Text><Text style={s.heading}>{title}</Text><Text style={s.caption}>{hint}</Text><TouchableOpacity style={s.primary} onPress={onPress}><Text style={s.buttonText}>{label}</Text></TouchableOpacity></View>;
const Summary = ({ label, value }: any) => <View><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>;

const CheckInPromptModal = ({ visible, onSkip, onConfirm }: { visible: boolean; onSkip: () => void; onConfirm: () => void }) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
    <View style={s.modalBackdrop}><View style={s.modalCard}><View style={s.modalIcon}><Text style={s.modalIconText}>✓</Text></View><Text style={s.modalTitle}>ส่งคำขอแล้ว</Text><Text style={s.modalMessage}>ต้องการบันทึกเข้าและพิมพ์บัตรผ่านสำหรับครั้งนี้หรือไม่</Text><View style={s.modalActions}><TouchableOpacity style={s.modalSecondary} onPress={onSkip}><Text style={s.modalSecondaryText}>ไม่ใช่ตอนนี้</Text></TouchableOpacity><TouchableOpacity style={s.modalPrimary} onPress={onConfirm}><Text style={s.modalPrimaryText}>บันทึกเข้าและพิมพ์บัตร</Text></TouchableOpacity></View></View></View>
  </Modal>
);

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F1F5F9'},subHeader:{height:62,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#E2E8F0',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},backBtn:{width:104},back:{color:'#2563EB',fontSize:16,fontWeight:'800'},subHeaderTitle:{color:'#0F172A',fontSize:17,fontWeight:'900',textAlign:'center'},subHeaderSpacer:{width:104},content:{padding:16,paddingBottom:116},progress:{color:'#2563EB',fontSize:15,fontWeight:'800',marginTop:8,marginBottom:18},section:{gap:12},heading:{color:'#0F172A',fontSize:23,fontWeight:'900'},caption:{color:'#64748B',fontSize:15,lineHeight:22},choice:{minHeight:112,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderWidth:2,borderColor:'#BFDBFE',borderLeftWidth:6,borderLeftColor:'#2563EB',borderRadius:18,padding:16,shadowColor:'#1D4ED8',shadowOffset:{width:0,height:2},shadowOpacity:0.08,shadowRadius:5,elevation:2},choiceIcon:{fontSize:34,marginRight:14},choiceCopy:{flex:1},choiceTitle:{color:'#0F172A',fontSize:21,fontWeight:'900'},choiceHint:{color:'#64748B',fontSize:15,fontWeight:'700',marginTop:4},arrow:{color:'#2563EB',fontSize:22,fontWeight:'900',lineHeight:24},reasonHeader:{flexDirection:'row',alignItems:'center',gap:8},stepNumber:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#1D4ED8'},stepNumberText:{color:'#FFF',fontSize:15,fontWeight:'900'},reasonList:{gap:12,marginTop:4},reasonCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',paddingVertical:14,paddingHorizontal:14,borderRadius:18,borderWidth:2,borderLeftWidth:6,borderColor:'#BFDBFE',borderLeftColor:'#2563EB',shadowColor:'#1D4ED8',shadowOffset:{width:0,height:2},shadowOpacity:0.08,shadowRadius:5,elevation:2},reasonNumBadge:{width:34,height:34,borderRadius:12,justifyContent:'center',alignItems:'center',backgroundColor:'#EFF6FF',borderWidth:1.5,borderColor:'#93C5FD',marginRight:10},reasonNumText:{fontSize:15,fontWeight:'900',color:'#1D4ED8'},reasonIconBox:{width:48,height:48,borderRadius:14,justifyContent:'center',alignItems:'center',backgroundColor:'#EFF6FF',borderWidth:1.5,borderColor:'#DBEAFE',marginRight:12},reasonEmoji:{fontSize:24},reasonTextBox:{flex:1,justifyContent:'center'},reasonTitle:{color:'#0F172A',fontSize:16,fontWeight:'900'},houseRequiredTag:{alignSelf:'flex-start',marginTop:5,paddingHorizontal:7,paddingVertical:2,borderRadius:4,backgroundColor:'#FEE2E2'},houseRequiredTagText:{color:'#B91C1C',fontSize:10,fontWeight:'800'},houseSkippableTag:{alignSelf:'flex-start',marginTop:5,paddingHorizontal:7,paddingVertical:2,borderRadius:4,backgroundColor:'#FEF3C7'},houseSkippableTagText:{color:'#A16207',fontSize:10,fontWeight:'800'},houseOptionalTag:{alignSelf:'flex-start',marginTop:5,paddingHorizontal:7,paddingVertical:2,borderRadius:4,backgroundColor:'#DCFCE7'},houseOptionalTagText:{color:'#15803D',fontSize:10,fontWeight:'800'},reasonArrowBadge:{width:32,height:32,borderRadius:16,justifyContent:'center',alignItems:'center',backgroundColor:'#EFF6FF',marginLeft:8},empty:{color:'#64748B',fontSize:16,textAlign:'center',marginTop:42},photoStep:{alignItems:'center',paddingTop:62},bigIcon:{fontSize:58,marginBottom:20},primary:{backgroundColor:'#1D4ED8',borderRadius:10,paddingVertical:16,paddingHorizontal:22,marginTop:28},submit:{backgroundColor:'#059669',borderRadius:10,paddingVertical:18,marginTop:8},buttonText:{color:'#FFF',fontSize:18,fontWeight:'900',textAlign:'center'},summary:{backgroundColor:'#FFF',borderWidth:1.5,borderColor:'#BFDBFE',borderRadius:14,padding:18,gap:8},summaryLabel:{color:'#64748B',fontSize:13,fontWeight:'800',marginTop:4},summaryValue:{color:'#0F172A',fontSize:18,fontWeight:'800',marginTop:2},modalBackdrop:{flex:1,backgroundColor:'rgba(15,23,42,0.78)',justifyContent:'center',alignItems:'center',padding:24},modalCard:{width:'100%',maxWidth:340,backgroundColor:'#FFF',borderRadius:24,padding:24,alignItems:'center',borderWidth:1,borderColor:'#E2E8F0'},modalIcon:{width:64,height:64,borderRadius:32,justifyContent:'center',alignItems:'center',backgroundColor:'#DCFCE7',borderWidth:2,borderColor:'#86EFAC',marginBottom:14},modalIconText:{color:'#16A34A',fontSize:32,fontWeight:'900'},modalTitle:{color:'#0F172A',fontSize:21,fontWeight:'900',textAlign:'center'},modalMessage:{color:'#64748B',fontSize:15,fontWeight:'600',textAlign:'center',lineHeight:22,marginTop:8},modalActions:{width:'100%',gap:10,marginTop:22},modalPrimary:{backgroundColor:'#059669',borderRadius:10,paddingVertical:14},modalPrimaryText:{color:'#FFF',fontSize:16,fontWeight:'900',textAlign:'center'},modalSecondary:{backgroundColor:'#EFF6FF',borderRadius:10,paddingVertical:14,borderWidth:1,borderColor:'#BFDBFE'},modalSecondaryText:{color:'#1D4ED8',fontSize:16,fontWeight:'900',textAlign:'center'},
});
