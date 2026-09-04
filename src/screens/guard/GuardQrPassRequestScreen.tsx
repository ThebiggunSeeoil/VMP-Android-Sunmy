import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { KeypadModal } from '../../components/common/KeypadModal';
import { PhotoCaptureModal } from '../../components/common/PhotoCaptureModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { SunmiPrinterService, VisitorSlipData } from '../../hardware/SunmiPrinter';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

type RequestType = 'NEW' | 'DAMAGED';
type WizardStep = 'request_type' | 'reason' | 'id_photo' | 'plate_photo' | 'review';

const stepLabels: Record<WizardStep, string> = {
  request_type: 'ขั้นตอน 1 จาก 5: เลือกประเภทคำขอ',
  reason: 'ขั้นตอน 2 จาก 5: เลือกเหตุผลการติดต่อ',
  id_photo: 'ขั้นตอน 3 จาก 5: ถ่ายบัตรประชาชน',
  plate_photo: 'ขั้นตอน 4 จาก 5: ถ่ายป้ายทะเบียนรถ',
  review: 'ขั้นตอน 5 จาก 5: ตรวจสอบก่อนส่งคำขอ',
};

export const GuardQrPassRequestScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { guardhouse, guard } = useAppStore();
  const [step, setStep] = useState<WizardStep>('request_type');
  const [reasons, setReasons] = useState<any[]>([]);
  const [houses, setHouses] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [reason, setReason] = useState<any>(null);
  const [house, setHouse] = useState('');
  const [idPhoto, setIdPhoto] = useState('');
  const [platePhoto, setPlatePhoto] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [camera, setCamera] = useState<'id_card' | 'car_number' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!guardhouse?.serviceId) return;
    Promise.all([vmsApi.getEntryReasons(guardhouse.serviceId), vmsApi.getHouseNumbers(guardhouse.serviceId)])
      .then(([items, houseList]) => {
        setReasons(items.filter((item: any) => item.active !== false && item.allow_qr_pass_request === true));
        setHouses(houseList);
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
    if (selected.requires_house_number === false) {
      setHouse('000/00');
      setStep('id_photo');
      setCamera('id_card');
    } else {
      setShowKeypad(true);
    }
  };

  const onCapture = (path: string) => {
    if (camera === 'id_card') {
      setIdPhoto(path);
      setCamera('car_number');
      setStep('plate_photo');
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
      Alert.alert('ส่งคำขอแล้ว', 'ต้องการบันทึกเข้าและพิมพ์บัตรผ่านสำหรับครั้งนี้หรือไม่', [
        { text: 'ไม่ใช่ตอนนี้', onPress: () => navigation.goBack(), style: 'cancel' },
        { text: 'บันทึกเข้าและพิมพ์บัตร', onPress: checkInAndPrint },
      ]);
    } catch (error: any) {
      Alert.alert('ส่งคำขอไม่สำเร็จ', error?.message || 'โปรดลองอีกครั้ง');
    } finally { setLoading(false); }
  };

  const checkInAndPrint = async () => {
    if (!guardhouse?.serviceId || !reason) return;
    setLoading(true);
    try {
      const result = await vmsApi.submitCheckIn({
        userId: guard?.userId || '', service_name_id: guardhouse.serviceId,
        ServiceNameFiled_id: guardhouse.serviceId, reason_entry_file_id: reason.id,
        reason_entry: reason.name, number_house: house, name: '', picture_id_card: idPhoto,
        picture_car_number: platePhoto, guardhouse_id: guardhouse.id,
      });
      if (result?.status && result.status !== 'check_in_success') throw new Error(result.message);
      const now = new Date(); const passId = `VMS-${Date.now()}`;
      const slip: VisitorSlipData = {
        title: 'บัตรผู้มาติดต่อ (VISITOR PASS)', serviceName: guardhouse.villageName, villageName: guardhouse.villageName,
        dateStr: now.toLocaleDateString('th-TH'), timeStr: now.toLocaleTimeString('th-TH'), guardhouse: guardhouse.name,
        reason: reason.name, houseNo: house, licensePlate: '-', vehicleType: '-', visitorName: '-', qrPayload: passId,
        legacyQrPayload: '', barcodePayload: '', payloadMode: 'legacy', passId, validUntil: '', validHours: 24,
        checkoutRequired: true, allowLateCheckout: false,
      };
      const printed = await SunmiPrinterService.printVisitorSlip(slip);
      Alert.alert(printed?.success ? 'บันทึกเข้าและพิมพ์สำเร็จ' : 'บันทึกเข้าสำเร็จ', printed?.success ? 'พิมพ์บัตรผ่านเรียบร้อยแล้ว' : (printed?.message || 'กรุณาตรวจสอบเครื่องพิมพ์'));
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('บันทึกเข้าไม่สำเร็จ', error?.message || 'คำขอ QR ถูกบันทึกไว้แล้ว');
    } finally { setLoading(false); }
  };

  const requestLabel = requestType === 'NEW' ? 'ขอออกบัตรใหม่' : 'บัตรเดิมชำรุด';
  return <View style={s.root}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <LiffHeader />
    <TouchableOpacity onPress={goBack} hitSlop={10}><Text style={s.back}>‹ {step === 'request_type' ? 'กลับหน้าหลัก' : 'ย้อนกลับ'}</Text></TouchableOpacity>
    <Text style={s.title}>ลงทะเบียนบัตร QR Code</Text><Text style={s.progress}>{stepLabels[step]}</Text>
    {step === 'request_type' && <View style={s.section}><Text style={s.heading}>เลือกประเภทคำขอ</Text>
      <Choice icon="🆕" title="ขอออกบัตรใหม่" hint="ลงทะเบียนเพื่อขอออกบัตรผ่าน QR Code" onPress={() => { setRequestType('NEW'); setStep('reason'); }} />
      <Choice icon="🪪" title="บัตรเดิมชำรุด" hint="ขอออกบัตรผ่าน QR Code ทดแทน" onPress={() => { setRequestType('DAMAGED'); setStep('reason'); }} />
    </View>}
    {step === 'reason' && <View style={s.section}><Text style={s.heading}>เลือกเหตุผลการติดต่อ</Text><Text style={s.caption}>เลือกได้เฉพาะเหตุผลที่เปิดสิทธิ์สำหรับการขอออกบัตร QR Code</Text>
      {reasons.map(item => <TouchableOpacity key={item.id} style={s.reasonCard} onPress={() => chooseReason(item)}><Text style={s.reasonTitle}>{item.name}</Text><Text style={[s.tag, item.requires_house_number === false ? s.centralTag : s.houseTag]}>{item.requires_house_number === false ? 'ผู้มาติดต่อส่วนกลาง 000/00' : 'ต้องระบุบ้านเลขที่'}</Text><Text style={s.arrow}>›</Text></TouchableOpacity>)}
      {!reasons.length && <Text style={s.empty}>ยังไม่มีเหตุผลที่เปิดให้สร้างบัตรผ่าน QR Code</Text>}
    </View>}
    {step === 'id_photo' && <PhotoStep icon="🪪" title="ถ่ายรูปบัตรประชาชน" hint="กรุณาวางบัตรให้อยู่ในกรอบภาพ" label={idPhoto ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายบัตรประชาชน'} onPress={() => setCamera('id_card')} />}
    {step === 'plate_photo' && <PhotoStep icon="🚘" title="ถ่ายรูปป้ายทะเบียนรถ" hint="กรุณาให้เห็นป้ายทะเบียนชัดเจน" label={platePhoto ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายป้ายทะเบียน'} onPress={() => setCamera('car_number')} />}
    {step === 'review' && <View style={s.section}><Text style={s.heading}>ตรวจสอบข้อมูลคำขอ</Text><View style={s.summary}>
      <Summary label="ประเภทคำขอ" value={requestLabel} /><Summary label="เหตุผลการติดต่อ" value={reason?.name || '-'} /><Summary label="บ้านเลขที่" value={house === '000/00' ? '000/00 - ผู้มาติดต่อส่วนกลาง' : house} /><Summary label="เอกสาร" value="บัตรประชาชน และป้ายทะเบียนรถ" />
    </View><TouchableOpacity style={s.submit} onPress={submit}><Text style={s.buttonText}>ส่งคำขอออกบัตร QR Code</Text></TouchableOpacity></View>}
  </ScrollView>
  <KeypadModal visible={showKeypad} title="ระบุบ้านเลขที่" houseNumbers={houses} canSubmitEmpty={false} onConfirm={value => { setHouse(value); setShowKeypad(false); setStep('id_photo'); setCamera('id_card'); }} onCancel={() => setShowKeypad(false)} />
  <PhotoCaptureModal visible={!!camera} captureType={camera || 'id_card'} onCapture={onCapture} onClose={() => setCamera(null)} />
  <LoadingOverlay visible={loading} title="กำลังดำเนินการ" message="กำลังส่งข้อมูลและรูปภาพ..." />
  </View>;
};

const Choice = ({ icon, title, hint, onPress }: any) => <TouchableOpacity style={s.choice} onPress={onPress}><Text style={s.choiceIcon}>{icon}</Text><View style={s.choiceCopy}><Text style={s.choiceTitle}>{title}</Text><Text style={s.choiceHint}>{hint}</Text></View><Text style={s.arrow}>›</Text></TouchableOpacity>;
const PhotoStep = ({ icon, title, hint, label, onPress }: any) => <View style={s.photoStep}><Text style={s.bigIcon}>{icon}</Text><Text style={s.heading}>{title}</Text><Text style={s.caption}>{hint}</Text><TouchableOpacity style={s.primary} onPress={onPress}><Text style={s.buttonText}>{label}</Text></TouchableOpacity></View>;
const Summary = ({ label, value }: any) => <View><Text style={s.summaryLabel}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>;

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F1F5F9'},content:{padding:14,paddingBottom:40},back:{color:'#2563EB',fontSize:18,fontWeight:'800',marginTop:16},title:{color:'#0F172A',fontSize:28,fontWeight:'900',marginTop:22},progress:{color:'#2563EB',fontSize:15,fontWeight:'800',marginTop:8,marginBottom:18},section:{gap:12},heading:{color:'#0F172A',fontSize:23,fontWeight:'900'},caption:{color:'#64748B',fontSize:15,lineHeight:22},choice:{minHeight:112,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderWidth:2,borderColor:'#BFDBFE',borderRadius:8,padding:16},choiceIcon:{fontSize:34,marginRight:14},choiceCopy:{flex:1},choiceTitle:{color:'#0F172A',fontSize:21,fontWeight:'900'},choiceHint:{color:'#64748B',fontSize:15,fontWeight:'700',marginTop:4},arrow:{color:'#2563EB',fontSize:38,fontWeight:'700',position:'absolute',right:18,top:27},reasonCard:{minHeight:104,backgroundColor:'#FFF',borderWidth:1.5,borderColor:'#CBD5E1',borderRadius:8,padding:16,justifyContent:'center'},reasonTitle:{color:'#0F172A',fontSize:21,fontWeight:'900',paddingRight:38},tag:{alignSelf:'flex-start',fontSize:13,fontWeight:'800',marginTop:8,paddingVertical:3,paddingHorizontal:8,borderRadius:4},houseTag:{color:'#B42318',backgroundColor:'#FEE4E2'},centralTag:{color:'#067647',backgroundColor:'#D1FADF'},empty:{color:'#64748B',fontSize:16,textAlign:'center',marginTop:42},photoStep:{alignItems:'center',paddingTop:62},bigIcon:{fontSize:58,marginBottom:20},primary:{backgroundColor:'#2563EB',borderRadius:8,paddingVertical:16,paddingHorizontal:22,marginTop:28},submit:{backgroundColor:'#059669',borderRadius:8,paddingVertical:18,marginTop:8},buttonText:{color:'#FFF',fontSize:18,fontWeight:'900',textAlign:'center'},summary:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#BFDBFE',borderRadius:8,padding:18,gap:8},summaryLabel:{color:'#64748B',fontSize:13,fontWeight:'800',marginTop:4},summaryValue:{color:'#0F172A',fontSize:18,fontWeight:'800',marginTop:2},
});
