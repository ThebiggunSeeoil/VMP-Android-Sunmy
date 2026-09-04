import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { PasscodeKeypad } from '../../components/common/PasscodeKeypad';
import { useAppStore } from '../../state/useAppStore';

const MAX_ATTEMPTS = 5;
const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: false });

interface Props {
  navigation: any;
  profileId: string;
}

export const PasscodeLoginScreen: React.FC<Props> = ({ navigation, profileId }) => {
  const {
    profiles,
    verifyPasscode,
    loginWithProfile,
    incrementLoginAttempt,
    resetLoginAttempts,
    loginAttempts,
    enableBiometric,
  } = useAppStore();

  const [shake, setShake] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const profile = profiles.find(p => p.profileId === profileId) || (profiles.length === 1 ? profiles[0] : undefined);
  const attemptsLeft = MAX_ATTEMPTS - loginAttempts;

  useEffect(() => { checkBiometric(); }, []);

  useEffect(() => {
    if (profile && !profile.passcodeHash) {
      // Auto-redirect if profile exists but PIN was not set
      navigation.replace('SetPasscode', { profileId: profile.profileId || profileId });
    }
  }, [profile, profileId]);

  useEffect(() => {
    if (biometricAvailable && profile?.biometricEnabled) {
      setTimeout(handleBiometric, 500);
    }
  }, [biometricAvailable]);

  useEffect(() => {
    if (loginAttempts >= MAX_ATTEMPTS) setLocked(true);
  }, [loginAttempts]);

  const checkBiometric = async () => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      setBiometricAvailable(available);
      if (biometryType) setBiometricType(biometryType);
    } catch { setBiometricAvailable(false); }
  };

  const handlePinComplete = (pin: string) => {
    if (locked) return;
    const targetProfileId = profile?.profileId || profileId;
    if (verifyPasscode(targetProfileId, pin)) {
      resetLoginAttempts();
      loginWithProfile(targetProfileId);
      navigation.replace('MainHub');
    } else {
      const attempts = incrementLoginAttempt();
      setShake(true);
      setTimeout(() => setShake(false), 700);
      if (attempts >= MAX_ATTEMPTS) {
        setLocked(true);
        Alert.alert(
          '🔒 บัญชีถูกล็อก',
          'กรอก PIN ผิดเกิน 5 ครั้ง\nกรุณาสแกน QR Code ใหม่เพื่อ Reset PIN',
          [{ text: 'สแกน QR ใหม่', onPress: () => navigation.navigate('ScanOnboarding') }]
        );
      }
    }
  };

  const handleBiometric = async () => {
    if (!biometricAvailable) return;
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'ยืนยันตัวตนด้วยลายนิ้วมือ',
        cancelButtonText: 'ใช้ PIN แทน',
      });
      if (success) {
        resetLoginAttempts();
        loginWithProfile(profileId);
        navigation.replace('MainHub');
      }
    } catch {}
  };

  const handleEnableBiometric = async () => {
    if (!biometricAvailable || !profile) return;
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'ยืนยันเพื่อเปิดใช้งานลายนิ้วมือ',
        cancelButtonText: 'ยกเลิก',
      });
      if (success) {
        await enableBiometric(profileId, true);
        Alert.alert('✅ เปิดใช้งานสำเร็จ', 'ครั้งถัดไปสามารถ login ด้วยลายนิ้วมือได้ทันที');
      }
    } catch {}
  };

  if (!profile) return (
    <View style={styles.container}>
      <Text style={styles.errorText}>ไม่พบข้อมูลป้อม</Text>
    </View>
  );

  const bioLabel = biometricType === BiometryTypes.FaceID ? 'Face ID' : 'ลายนิ้วมือ';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C1220" />

      {/* ── Compact Header ────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.appLabel}>VMS POS GUARD</Text>
        <View style={styles.headerRow}>
          {/* Mini avatar */}
          <View style={styles.avatarMini}>
            <Text style={styles.avatarEmoji}>🏠</Text>
          </View>
          {/* Village info */}
          <View style={styles.headerInfo}>
            <Text style={styles.villageName} numberOfLines={1}>{profile.guardhouse.villageName}</Text>
            <Text style={styles.postName} numberOfLines={1}>{profile.guardhouse.name}</Text>
          </View>
        </View>
      </View>

      {/* ── White Body: PIN label + dots + keypad ─ */}
      <View style={styles.body}>
        {/* PIN title */}
        <Text style={styles.pinTitle}>
          {locked ? '🔒 บัญชีถูกล็อก' : 'กรอก PIN เพื่อเข้าสู่ระบบ'}
        </Text>

        {/* Keypad (no title prop — title is above) */}
        <PasscodeKeypad
          onComplete={handlePinComplete}
          onBiometric={handleBiometric}
          showBiometric={biometricAvailable && !!profile.biometricEnabled}
          shake={shake}
          disabled={locked}
          attemptsLeft={attemptsLeft}
        />
      </View>

      {/* ── Bottom actions — always below keypad ── */}
      <View style={styles.footer}>
        {/* Enable Biometric row */}
        {biometricAvailable && !profile.biometricEnabled && !locked && (
          <TouchableOpacity style={styles.bioBtn} onPress={handleEnableBiometric} activeOpacity={0.8}>
            <Text style={styles.bioBtnText}>👆  เปิดใช้งาน{bioLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Links row */}
        <View style={styles.linksRow}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('ลืม PIN?', 'สแกน QR Code ใหม่เพื่อ Reset PIN', [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'สแกน QR', onPress: () => navigation.navigate('ScanOnboarding') },
              ])
            }
          >
            <Text style={styles.linkRed}>ลืม PIN?</Text>
          </TouchableOpacity>

          <View style={styles.sep} />

          {profiles.length > 1 ? (
            <TouchableOpacity onPress={() => navigation.navigate('SelectProfile')}>
              <Text style={styles.linkBlue}>เปลี่ยนป้อม ({profiles.length})</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('ScanOnboarding')}>
              <Text style={styles.linkBlue}>+ เพิ่มป้อมใหม่</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  /* ── Compact Header ── */
  header: {
    backgroundColor: '#0C1220',
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  appLabel: {
    color: '#3B82F6',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarMini: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E3A8A',
    borderWidth: 2,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  headerInfo: { flex: 1 },
  villageName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  postName: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  /* ── Body ── */
  body: {
    flex: 1,
    paddingTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 20,
    textAlign: 'center',
  },

  /* ── Footer ── */
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    gap: 10,
    alignItems: 'center',
  },
  bioBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
    alignItems: 'center',
  },
  bioBtnText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sep: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },
  linkRed: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  linkBlue: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#EF4444', textAlign: 'center', marginTop: 40 },
});
