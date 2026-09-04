import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { PasscodeKeypad } from '../../components/common/PasscodeKeypad';
import { useAppStore } from '../../state/useAppStore';

interface Props {
  navigation: any;
  profileId: string;
}

type Step = 'set' | 'confirm';

export const SetPasscodeScreen: React.FC<Props> = ({ navigation, profileId }) => {
  const { savePasscode, profiles } = useAppStore();
  const [step, setStep] = useState<Step>('set');
  const [firstPin, setFirstPin] = useState('');
  const [shake, setShake] = useState(false);

  const profile = profiles.find(p => p.profileId === profileId) || (profiles.length === 1 ? profiles[0] : undefined);
  const targetProfileId = profile?.profileId || profileId;

  const handleSetPin = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== firstPin) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      Alert.alert('PIN ไม่ตรงกัน', 'กรุณากด PIN ทั้ง 2 ครั้งให้ตรงกัน');
      setStep('set');
      setFirstPin('');
      return;
    }

    try {
      await savePasscode(targetProfileId, pin);
      useAppStore.getState().loginWithProfile(targetProfileId);
      Alert.alert(
        'ตั้ง PIN สำเร็จ ✅',
        'PIN ของคุณถูกบันทึกแล้ว ครั้งถัดไปสามารถ login ด้วย PIN ได้ทันที',
        [{ text: 'เริ่มปฏิบัติงาน', onPress: () => navigation.replace('MainHub') }]
      );
    } catch {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึก PIN ได้ กรุณาลองใหม่');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandLabel}>VMS POS GUARD</Text>
        <Text style={styles.headerTitle}>
          {step === 'set' ? '🔐 กำหนด PIN' : '🔐 ยืนยัน PIN'}
        </Text>
        {profile && (
          <Text style={styles.headerSub}>
            {profile.guardhouse.villageName} · {profile.guard.fullName}
          </Text>
        )}
      </View>

      {/* Progress Dots */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
      </View>

      <View style={styles.body}>
        <PasscodeKeypad
          title={step === 'set' ? 'กด PIN 4 หลักของคุณ' : 'กด PIN อีกครั้งเพื่อยืนยัน'}
          subtitle={
            step === 'set'
              ? 'ใช้สำหรับ login ครั้งถัดไปโดยไม่ต้อง scan QR'
              : 'กด PIN เดิมซ้ำเพื่อยืนยัน'
          }
          onComplete={step === 'set' ? handleSetPin : handleConfirmPin}
          shake={shake}
        />
      </View>

      <Text style={styles.secureNote}>
        🔒 PIN ถูกเข้ารหัสและเก็บบนอุปกรณ์นี้เท่านั้น
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
  },
  brandLabel: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 0,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
  },
  stepDotActive: {
    backgroundColor: '#1D4ED8',
  },
  stepLine: {
    width: 60,
    height: 3,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  secureNote: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
});
