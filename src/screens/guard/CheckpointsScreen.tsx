import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Header } from '../../components/common/Header';
import { LiteCard } from '../../components/common/LiteCard';
import { LiteButton } from '../../components/common/LiteButton';

interface PointItem {
  id: string;
  name: string;
  code: string;
  status: 'done' | 'pending';
  checkedAt?: string;
}

export const CheckpointsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [points, setPoints] = useState<PointItem[]>([
    { id: '1', name: 'จุดที่ 1: ป้อมหน้าโครงการ', code: 'CP-01', status: 'done', checkedAt: '14:05 น.' },
    { id: '2', name: 'จุดที่ 2: สระว่ายน้ำ / คลับเฮาส์', code: 'CP-02', status: 'pending' },
    { id: '3', name: 'จุดที่ 3: ประตูฉุกเฉินทิศใต้', code: 'CP-03', status: 'pending' },
    { id: '4', name: 'จุดที่ 4: สวนสาธารณะเฟส 2', code: 'CP-04', status: 'pending' },
    { id: '5', name: 'จุดที่ 5: แนวรั้วรอบนอกด้านหลัง', code: 'CP-05', status: 'pending' },
  ]);

  const handleScanCheckpoint = (point: PointItem) => {
    Alert.alert('สแกนจุดตรวจ', `ต้องการบันทึกการตรวจ [${point.name}] ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'บันทึกผ่าน (ปกติ)',
        onPress: () => {
          const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
          setPoints((prev) =>
            prev.map((p) => (p.id === point.id ? { ...p, status: 'done', checkedAt: nowStr + ' น.' } : p))
          );
          Alert.alert('สำเร็จ', `บันทึกการตรวจ ${point.name} เรียบร้อยแล้ว`);
        },
      },
    ]);
  };

  const completedCount = points.filter((p) => p.status === 'done').length;

  return (
    <View style={styles.container}>
      <Header title="จุดออกตรวจพื้นที่" subtitle={`รอบบ่าย (ตรวจแล้ว ${completedCount}/${points.length} จุด)`} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <View style={styles.progressBox}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>ความคืบหน้ารอบตรวจ</Text>
            <Text style={styles.progressPercent}>{Math.round((completedCount / points.length) * 100)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(completedCount / points.length) * 100}%` }]} />
          </View>
        </View>

        {/* Checkpoint Cards */}
        {points.map((p, idx) => {
          const isDone = p.status === 'done';
          return (
            <LiteCard
              key={p.id}
              title={`${idx + 1}. ${p.name}`}
              subtitle={isDone ? `ตรวจเมื่อ: ${p.checkedAt}` : 'ยังไม่ได้ตรวจ (แตะเพื่อสแกน QR / NFC)'}
              badge={isDone ? 'เรียบร้อย' : 'รอตรวจ'}
              badgeColor={isDone ? '#10B981' : '#F59E0B'}
              onPress={() => !isDone && handleScanCheckpoint(p)}
              style={[styles.pointCard, isDone && styles.pointCardDone]}
            />
          );
        })}

        <View style={styles.actionArea}>
          <LiteButton
            title="📡 สแกนจุดตรวจด้วยปุ่มส้ม Sunmi"
            onPress={() => {
              const nextPoint = points.find((p) => p.status === 'pending');
              if (nextPoint) {
                handleScanCheckpoint(nextPoint);
              } else {
                Alert.alert('รอบตรวจเสร็จสมบูรณ์', 'คุณได้ตรวจครบทุกจุดตรวจในรอบนี้แล้ว');
              }
            }}
            variant="primary"
          />
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
  progressBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  progressPercent: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1D4ED8',
    borderRadius: 4,
  },
  pointCard: {
    marginVertical: 5,
  },
  pointCardDone: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  actionArea: {
    marginTop: 20,
  },
});
