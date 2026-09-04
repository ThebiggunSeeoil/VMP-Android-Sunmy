import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Header } from '../../components/common/Header';
import { LiteCard } from '../../components/common/LiteCard';
import { LiteButton } from '../../components/common/LiteButton';
import { useAppStore } from '../../state/useAppStore';

export const WorkTimeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, currentShift } = useAppStore();

  const [clockInTime, setClockInTime] = useState('07:00 น.');
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClockOut = () => {
    Alert.alert('ยืนยันลงเวลาออกกะ', 'ต้องการบันทึกเวลาออกปฏิบัติหน้าที่ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยันออกกะ',
        style: 'destructive',
        onPress: () => {
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
            const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            setClockOutTime(now + ' น.');
            Alert.alert('สำเร็จ', `ลงเวลาออกกะเรียบร้อยแล้ว (${now} น.)`);
          }, 400);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="จัดการเวลาเข้าออกงาน" subtitle="WorkTime Attendance" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Guard Profile Summary */}
        <LiteCard title={user?.displayName || 'รปภ. ประจำการ'} subtitle={user?.positionName || 'หัวหน้าชุดปฏิบัติการ'}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>โครงการ:</Text>
            <Text style={styles.infoValue}>{currentShift?.service_name || 'หมู่บ้านกาญจน์กนกวิลล์ 20'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ป้อมประจำการ:</Text>
            <Text style={styles.infoValue}>{currentShift?.guardhouse_name || 'ป้อมหลัก'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>กะปฏิบัติงาน:</Text>
            <Text style={styles.infoValue}>กะกลางวัน (07:00 - 19:00 น.)</Text>
          </View>
        </LiteCard>

        {/* Time Attendance Log Box */}
        <LiteCard title="สถานะการลงเวลาวันนี้" style={styles.attendanceCard}>
          <View style={styles.timeBoxRow}>
            <View style={styles.timeBox}>
              <Text style={styles.timeBoxLabel}>เวลาเข้ากะ (IN)</Text>
              <Text style={styles.timeBoxValue}>{clockInTime || '-'}</Text>
              <Text style={styles.timeBoxStatus}>✅ บันทึกแล้ว</Text>
            </View>

            <View style={[styles.timeBox, !clockOutTime && styles.timeBoxPending]}>
              <Text style={styles.timeBoxLabel}>เวลาออกกะ (OUT)</Text>
              <Text style={styles.timeBoxValue}>{clockOutTime || '--:--'}</Text>
              <Text style={[styles.timeBoxStatus, !clockOutTime && styles.timeBoxPendingText]}>
                {clockOutTime ? '✅ ออกกะแล้ว' : '⏳ กำลังปฏิบัติหน้าที่'}
              </Text>
            </View>
          </View>
        </LiteCard>

        {/* Action Button */}
        <View style={styles.actionArea}>
          {!clockOutTime ? (
            <LiteButton
              title="🔴 ลงเวลาออกกะ (Clock-Out)"
              onPress={handleClockOut}
              loading={loading}
              variant="danger"
            />
          ) : (
            <LiteButton
              title="🟢 ลงเวลาเข้ากะใหม่ (Clock-In)"
              onPress={() => {
                setClockOutTime(null);
                setClockInTime(
                  new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
                );
                Alert.alert('สำเร็จ', 'ลงเวลาเข้ากะเรียบร้อยแล้ว');
              }}
              variant="success"
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
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
  attendanceCard: {
    marginTop: 10,
  },
  timeBoxRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  timeBox: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  timeBoxPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  timeBoxLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  timeBoxValue: {
    color: '#1D4ED8',
    fontSize: 22,
    fontWeight: '900',
    marginVertical: 6,
  },
  timeBoxStatus: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '800',
  },
  timeBoxPendingText: {
    color: '#F59E0B',
  },
  actionArea: {
    marginTop: 24,
  },
});
