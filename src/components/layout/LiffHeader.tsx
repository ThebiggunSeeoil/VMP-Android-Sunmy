import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppStore } from '../../state/useAppStore';

interface LiffHeaderProps {
  showGuardCard?: boolean;
  onLogoutPress?: () => void;
}

export const GuardProfileCard: React.FC<{
  onLogoutPress?: () => void;
  onSwitchProfilePress?: () => void;
  onLockScreenPress?: () => void;
}> = ({ onLogoutPress, onSwitchProfilePress, onLockScreenPress }) => {
  const { guardhouse, guard } = useAppStore();

  return (
    <View style={styles.guardCard}>
      <View style={styles.guardCardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarIcon}>👮</Text>
        </View>
        <View style={styles.guardDetails}>
          <View style={styles.guardNameRow}>
            <View style={styles.statusDot} />
            <Text style={styles.guardName}>
              {guard?.fullName || 'อุปกรณ์ส่วนกลาง'}
            </Text>
          </View>
          <Text style={styles.guardPosition}>
            {guard?.positionName || 'อุปกรณ์ส่วนกลาง'} • {guardhouse?.name || 'ป้อมรปภ.'}
          </Text>
          <Text style={styles.guardCompany}>
            {guard?.companyName || guardhouse?.ownerName || 'บจก.รักษาความปลอดภัย'}
          </Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      {(onLockScreenPress || onSwitchProfilePress || onLogoutPress) && (
        <View style={styles.guardCardActionsColumn}>
          {onLockScreenPress && (
            <TouchableOpacity
              style={styles.lockScreenBtn}
              onPress={onLockScreenPress}
              activeOpacity={0.8}
            >
              <Text style={styles.lockScreenBtnText}>🔒 Lock หน้าจอ</Text>
            </TouchableOpacity>
          )}

          {(onSwitchProfilePress || onLogoutPress) && (
            <View style={styles.guardCardActionsRow}>
              {onSwitchProfilePress && (
                <TouchableOpacity
                  style={styles.switchProfileBtn}
                  onPress={onSwitchProfilePress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.switchProfileBtnText}>🔄 สลับป้อม / เปลี่ยนผู้ใช้</Text>
                </TouchableOpacity>
              )}

              {onLogoutPress && (
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={onLogoutPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutText}>🚪 ลงชื่อออก</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export const LiffHeader: React.FC<LiffHeaderProps> = ({ showGuardCard = false, onLogoutPress }) => {
  const { guardhouse, guard, printerConnected } = useAppStore();

  return (
    <View style={styles.container}>
      {/* Compact Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandInfo}>
          <View style={styles.villageRow}>
            <Text style={styles.systemBadge}>VMP</Text>
            <Text style={styles.villageTitle} numberOfLines={1}>
              {guardhouse?.villageName || 'หมู่บ้าน'}
            </Text>
          </View>
          <Text style={styles.guardhouseSubtitle} numberOfLines={1}>
            📍 {guardhouse?.name || 'ป้อมรปภ.'} • 👮 {guard?.name || 'เจ้าหน้าที่'}
          </Text>
        </View>

        <View style={styles.topRightActions}>
          <View style={[styles.hwBadge, { backgroundColor: printerConnected ? '#059669' : '#D97706' }]}>
            <Text style={styles.hwBadgeText}>
              {printerConnected ? '🖨️ พร้อม' : '🖨️ ตรวจสอบ'}
            </Text>
          </View>
        </View>
      </View>

      {/* Optional Guard Profile Card */}
      {showGuardCard && <GuardProfileCard onLogoutPress={onLogoutPress} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandInfo: {
    flex: 1,
    paddingRight: 8,
  },
  villageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  systemBadge: {
    backgroundColor: '#1E293B',
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  villageTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  guardhouseSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  topRightActions: {
    alignItems: 'flex-end',
  },
  hwBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  hwBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  guardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guardCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  avatarIcon: {
    fontSize: 24,
  },
  guardDetails: {
    flex: 1,
  },
  guardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  guardName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  guardPosition: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  guardCompany: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  guardCardActionsColumn: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  lockScreenBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lockScreenBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  guardCardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  switchProfileBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchProfileBtnText: {
    color: '#1D4ED8',
    fontSize: 12.5,
    fontWeight: '900',
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '900',
  },
});
