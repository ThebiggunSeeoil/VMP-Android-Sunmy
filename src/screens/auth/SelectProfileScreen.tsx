import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useAppStore, GuardhouseProfile } from '../../state/useAppStore';

interface Props {
  navigation: any;
}

export const SelectProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { profiles, deleteProfile } = useAppStore();

  const handleSelectProfile = (profile: GuardhouseProfile) => {
    navigation.navigate('PasscodeLogin', { profileId: profile.profileId });
  };

  const handleDeleteProfile = (profile: GuardhouseProfile) => {
    Alert.alert(
      'ลบป้อมออกจากอุปกรณ์',
      `ต้องการลบ "${profile.guardhouse.villageName}" ออกจากอุปกรณ์นี้ใช่หรือไม่?\n\nคุณสามารถลงทะเบียนใหม่ได้โดยสแกน QR Code`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบออก',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(profile.profileId);
            const remaining = profiles.filter(p => p.profileId !== profile.profileId);
            if (remaining.length === 0) {
              navigation.replace('ScanOnboarding');
            }
          },
        },
      ]
    );
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandLabel}>VMS POS GUARD</Text>
        <Text style={styles.headerTitle}>เลือกป้อมยาม</Text>
        <Text style={styles.headerSub}>
          อุปกรณ์นี้ลงทะเบียน {profiles.length} ป้อม — เลือกป้อมที่ต้องการใช้งาน
        </Text>
      </View>

      {/* Profile List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {profiles.map((profile) => (
          <TouchableOpacity
            key={profile.profileId}
            style={styles.profileCard}
            onPress={() => handleSelectProfile(profile)}
            onLongPress={() => handleDeleteProfile(profile)}
            activeOpacity={0.75}
          >
            {/* Avatar */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarIcon}>🏠</Text>
            </View>

            {/* Info */}
            <View style={styles.profileInfo}>
              <Text style={styles.profileVillage}>{profile.guardhouse.villageName}</Text>
              <Text style={styles.profileGuardName}>{profile.guard.fullName}</Text>
              <Text style={styles.profileMeta}>
                {profile.guardhouse.name}
                {profile.biometricEnabled ? '  👆 Fingerprint' : ''}
              </Text>
              <Text style={styles.profileLastUsed}>ใช้งานล่าสุด: {formatDate(profile.lastUsed)}</Text>
            </View>

            {/* Arrow */}
            <Text style={styles.arrowIcon}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Add New Profile */}
        <TouchableOpacity
          style={styles.addCard}
          onPress={() => navigation.navigate('ScanOnboarding')}
          activeOpacity={0.8}
        >
          <Text style={styles.addIcon}>➕</Text>
          <Text style={styles.addText}>ลงทะเบียนป้อมใหม่</Text>
          <Text style={styles.addSub}>สแกน QR Code จาก Backend</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.hintText}>กดค้างที่รายการเพื่อลบออกจากอุปกรณ์</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    fontSize: 22,
  },
  profileInfo: {
    flex: 1,
  },
  profileVillage: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  profileGuardName: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  profileMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  profileLastUsed: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  arrowIcon: {
    color: '#94A3B8',
    fontSize: 28,
    fontWeight: '300',
  },
  addCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderStyle: 'dashed',
    gap: 4,
  },
  addIcon: {
    fontSize: 28,
  },
  addText: {
    color: '#15803D',
    fontSize: 15,
    fontWeight: '900',
  },
  addSub: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  hintText: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    paddingBottom: 20,
  },
});
