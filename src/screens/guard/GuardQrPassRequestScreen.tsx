import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { KeypadModal } from '../../components/common/KeypadModal';
import { PhotoCaptureModal } from '../../components/common/PhotoCaptureModal';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { SunmiPrinterService, VisitorSlipData } from '../../hardware/SunmiPrinter';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

export const GuardQrPassRequestScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { guardhouse, guard } = useAppStore();
  const [reasons, setReasons] = useState<any[]>([]); const [houses, setHouses] = useState<string[]>([]);
  const [type, setType] = useState<'NEW' | 'DAMAGED' | null>(null); const [reason, setReason] = useState<any>(null);
  const [house, setHouse] = useState(''); const [idPhoto, setIdPhoto] = useState(''); const [platePhoto, setPlatePhoto] = useState('');
  const [keypad, setKeypad] = useState(false); const [camera, setCamera] = useState<'id_card' | 'car_number' | null>(null); const [loading, setLoading] = useState(false);
  useEffect(() => { if (!guardhouse?.serviceId) return; Promise.all([vmsApi.getEntryReasons(guardhouse.serviceId), vmsApi.getHouseNumbers(guardhouse.serviceId)]).then(([r,h]) => { setReasons(r.filter((x:any) => x.active !== false && x.allow_qr_pass_request === true)); setHouses(h); }); }, [guardhouse?.serviceId]);
  const chooseReason = (item:any) => { setReason(item); setHouse(item.requires_house_number === false ? '000/00' : ''); if (item.requires_house_number !== false) setKeypad(true); else setCamera('id_card'); };
  const onCapture = (path:string) => { if (camera === 'id_card') { setIdPhoto(path); setCamera('car_number'); } else { setPlatePhoto(path); setCamera(null); } };
  const submit = async () => {
    if (!type || !reason || !house || !idPhoto || !platePhoto || !guardhouse?.serviceId) { Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกประเภท เหตุผล บ้านเลขที่ และถ่ายรูปให้ครบ'); return; }
    setLoading(true); try {
      const res = await vmsApi.submitGuardQrPassRequest({ project: guardhouse.serviceId, reason_entry_exit: reason.id, request_type: type, house_number: house, guard_id: guard?.id, guardhouse_id: guardhouse.id, picture_id_card:idPhoto, picture_car_number:platePhoto });
      if (!res?.status) throw new Error(res?.message || 'ส่งคำขอไม่สำเร็จ');
      Alert.alert('ส่งคำขอแล้ว', 'ต้องการบันทึกเข้าและพิมพ์บัตรผ่านสำหรับครั้งนี้หรือไม่', [
        { text: 'ไม่ใช่ตอนนี้', onPress: () => navigation.goBack() },
        { text: 'บันทึกเข้าและพิมพ์บัตร', onPress: () => checkInAndPrint() },
      ]);
    } catch (e:any) { Alert.alert('ส่งคำขอไม่สำเร็จ', e?.message || 'โปรดลองอีกครั้ง'); } finally { setLoading(false); }
  };
  const checkInAndPrint = async () => {
    if (!guardhouse?.serviceId || !reason) return; setLoading(true);
    try {
      const result = await vmsApi.submitCheckIn({ userId: guard?.userId || '', service_name_id: guardhouse.serviceId, ServiceNameFiled_id: guardhouse.serviceId, reason_entry_file_id: reason.id, reason_entry: reason.name, number_house: house, name: '', picture_id_card:idPhoto, picture_car_number:platePhoto, guardhouse_id:guardhouse.id });
      if (result?.status && result.status !== 'check_in_success') throw new Error(result.message);
      const now = new Date(); const slip: VisitorSlipData = { title:'บัตรผู้มาติดต่อ (VISITOR PASS)', serviceName:guardhouse.villageName, villageName:guardhouse.villageName, dateStr:now.toLocaleDateString('th-TH'), timeStr:now.toLocaleTimeString('th-TH'), guardhouse:guardhouse.name, reason:reason.name, houseNo:house, licensePlate:'-', vehicleType:'-', visitorName:'-', qrPayload:`VMS-${Date.now()}`, legacyQrPayload:'', barcodePayload:'', payloadMode:'legacy', passId:`VMS-${Date.now()}`, validUntil:'', validHours:24, checkoutRequired:true, allowLateCheckout:false };
      const printed = await SunmiPrinterService.printVisitorSlip(slip); Alert.alert(printed?.success ? 'บันทึกเข้าและพิมพ์สำเร็จ' : 'บันทึกเข้าสำเร็จ', printed?.success ? 'พิมพ์บัตรผ่านเรียบร้อยแล้ว' : (printed?.message || 'กรุณาตรวจสอบเครื่องพิมพ์')); navigation.goBack();
    } catch (e:any) { Alert.alert('บันทึกเข้าไม่สำเร็จ', e?.message || 'คำขอ QR ยังถูกบันทึกไว้แล้ว'); } finally { setLoading(false); }
  };
  return <View style={s.root}><ScrollView contentContainerStyle={s.content}><LiffHeader /><TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>‹ กลับหน้าหลัก</Text></TouchableOpacity><Text style={s.title}>ลงทะเบียนบัตร QR Code</Text><Text style={s.step}>1. เลือกประเภทคำขอ</Text><View style={s.row}>{[['NEW','ขอออกบัตรใหม่'],['DAMAGED','บัตรเดิมชำรุด']].map(([id,label]) => <TouchableOpacity key={id} style={[s.choice,type===id&&s.selected]} onPress={()=>setType(id as any)}><Text style={s.choiceText}>{label}</Text></TouchableOpacity>)}</View><Text style={s.step}>2. เลือกเหตุผลการติดต่อ</Text>{reasons.map(x=><TouchableOpacity key={x.id} style={[s.reason,reason?.id===x.id&&s.selected]} onPress={()=>chooseReason(x)}><Text style={s.reasonText}>{x.name}</Text><Text style={s.small}>{x.requires_house_number===false?'ผู้มาติดต่อส่วนกลาง 000/00':'ต้องระบุบ้านเลขที่'}</Text></TouchableOpacity>)}<Text style={s.step}>3. เอกสารประกอบ</Text><TouchableOpacity style={s.photo} onPress={()=>setCamera('id_card')}><Text>{idPhoto?'ถ่ายรูปบัตรประชาชนแล้ว':'ถ่ายรูปบัตรประชาชน *'}</Text></TouchableOpacity><TouchableOpacity style={s.photo} onPress={()=>setCamera('car_number')}><Text>{platePhoto?'ถ่ายรูปป้ายทะเบียนแล้ว':'ถ่ายรูปป้ายทะเบียนรถ *'}</Text></TouchableOpacity><TouchableOpacity style={s.submit} onPress={submit}><Text style={s.submitText}>ส่งคำขอ</Text></TouchableOpacity></ScrollView><KeypadModal visible={keypad} title="ระบุบ้านเลขที่" houseNumbers={houses} canSubmitEmpty={false} onConfirm={v=>{setHouse(v);setKeypad(false);setCamera('id_card')}} onCancel={()=>setKeypad(false)}/><PhotoCaptureModal visible={!!camera} captureType={camera || 'id_card'} onCapture={onCapture} onClose={()=>setCamera(null)}/><LoadingOverlay visible={loading} title="กำลังดำเนินการ" message="กำลังส่งข้อมูลและรูปภาพ..."/></View>;
};
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#F1F5F9'},content:{padding:14,paddingBottom:40},back:{color:'#2563EB',fontSize:17,fontWeight:'700',marginTop:16},title:{fontSize:26,fontWeight:'900',color:'#0F172A',marginVertical:16},step:{fontSize:18,fontWeight:'800',color:'#0F172A',marginTop:14,marginBottom:8},row:{flexDirection:'row',gap:10},choice:{flex:1,padding:16,backgroundColor:'#fff',borderWidth:2,borderColor:'#BFDBFE',borderRadius:8},selected:{borderColor:'#2563EB',backgroundColor:'#EFF6FF'},choiceText:{fontSize:16,fontWeight:'800',color:'#1E3A8A',textAlign:'center'},reason:{backgroundColor:'#fff',borderWidth:1,borderColor:'#CBD5E1',borderRadius:8,padding:14,marginBottom:8},reasonText:{fontSize:18,fontWeight:'800',color:'#0F172A'},small:{fontSize:13,color:'#64748B',marginTop:4},photo:{backgroundColor:'#fff',borderWidth:1,borderColor:'#CBD5E1',borderRadius:8,padding:18,marginBottom:10},submit:{backgroundColor:'#059669',borderRadius:8,padding:18,marginTop:18},submitText:{color:'#fff',fontSize:20,fontWeight:'900',textAlign:'center'}});
