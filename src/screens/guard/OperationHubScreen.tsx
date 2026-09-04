import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Header } from '../../components/common/Header';
import { useAppStore } from '../../state/useAppStore';
import { SunmiPrinterService } from '../../hardware/SunmiPrinter';
import { SunmiScannerService } from '../../hardware/SunmiScanner';

interface OperationHubProps {
  navigation: any;
}

export const OperationHubScreen: React.FC<OperationHubProps> = ({ navigation }) => {
  const { currentShift, setPrinterConnected } = useAppStore();

  useEffect(() => {
    // Check printer connection on load
    SunmiPrinterService.isConnected().then((connected) => {
      setPrinterConnected(connected);
    });

    // Listen to hardware physical keys (VOLUME_UP, VOLUME_DOWN) from home screen
    const keySub = SunmiScannerService.onHardwareKey((key) => {
      if (key === 'VOLUME_UP') {
        navigation.navigate('CheckOut', { initialMode: 'CHECK_IN', autoOpenScanner: true });
      } else if (key === 'VOLUME_DOWN') {
        navigation.navigate('CheckOut', { initialMode: 'CHECK_OUT', autoOpenScanner: true });
      }
    });

    // Listen to hardware scanner button presses from anywhere
    const scanSub = SunmiScannerService.onScan((code) => {
      // If guard scanned a visitor QR code from home screen, jump to Check-Out immediately!
      if (code.includes('pass_exchange') || code.includes('visitor') || code.startsWith('*+')) {
        navigation.navigate('CheckOut', { scannedCode: code, initialMode: 'CHECK_OUT' });
      }
    });

    return () => {
      keySub?.remove();
      scanSub?.remove();
    };
  }, []);

  const actions = [
    {
      id: 'check-in',
      title: 'บันทึกเข้า',
      subtitle: 'ผู้ติดต่อบันทึกเข้า',
      color: '#1D4ED8',
      screen: 'CheckIn',
    },
    {
      id: 'check-out',
      title: 'บันทึกออก',
      subtitle: 'ผู้ติดต่อบันทึกออก',
      color: '#059669',
      screen: 'CheckOut',
    },
    {
      id: 'checkpoints',
      title: 'จุดออกตรวจ',
      subtitle: 'เดินตรวจพื้นที่/NFC',
      color: '#7C3AED',
      screen: 'Checkpoints',
    },
    {
      id: 'gate-control',
      title: 'จัดการไม้กั้น',
      subtitle: 'เปิด-ปิดประตูทางเข้าออก',
      color: '#EA580C',
      onPress: () => {
        Alert.alert('จัดการไม้กั้น', 'เลือกคำสั่งเปิดไม้กั้น', [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'เปิดขาเข้า (IN)',
            onPress: () => Alert.alert('สำเร็จ', 'ส่งคำสั่งเปิดไม้กั้นขาเข้าเรียบร้อย'),
          },
          {
            text: 'เปิดขาออก (OUT)',
            onPress: () => Alert.alert('สำเร็จ', 'ส่งคำสั่งเปิดไม้กั้นขาออกเรียบร้อย'),
          },
        ]);
      },
    },
    {
      id: 'worktime',
      title: 'ลงเวลางาน',
      subtitle: 'บันทึกเข้า-ออกกะ รปภ.',
      color: '#2563EB',
      screen: 'WorkTime',
    },
    {
      id: 'settings',
      title: 'ตั้งค่า & ทดสอบ',
      subtitle: 'ทดสอบพิมพ์สลิป/โหมดเบา',
      color: '#475569',
      screen: 'Settings',
    },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="ป้อมปฏิบัติการ"
        subtitle={currentShift?.guardhouse_name || 'ป้อมทางเข้าหลัก'}
        onSettingsPress={() => navigation.navigate('Settings')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Shift Status Badge */}
        <View style={styles.shiftBanner}>
          <View style={styles.shiftDot} />
          <View style={styles.shiftTextWrapper}>
            <Text style={styles.shiftTitle}>กำลังปฏิบัติหน้าที่: {currentShift?.guardhouse_name || 'ป้อม 1'}</Text>
            <Text style={styles.shiftSub}>พร้อมสแกนบัตรและพิมพ์ใบผ่านอัตโนมัติ</Text>
          </View>
        </View>

        {/* Action Grid */}
        <View style={styles.grid}>
          {actions.map((act) => (
            <TouchableOpacity
              key={act.id}
              style={[styles.actionCard, { borderLeftColor: act.color }]}
              onPress={() => {
                if (act.screen) {
                  navigation.navigate(act.screen);
                } else if (act.onPress) {
                  act.onPress();
                }
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.colorBar, { backgroundColor: act.color }]} />
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>{act.title}</Text>
                <Text style={styles.actionSubtitle}>{act.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
    paddingBottom: 32,
  },
  shiftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  shiftDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    marginRight: 10,
  },
  shiftTextWrapper: {
    flex: 1,
  },
  shiftTitle: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '800',
  },
  shiftSub: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  grid: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBar: {
    width: 0,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
});
