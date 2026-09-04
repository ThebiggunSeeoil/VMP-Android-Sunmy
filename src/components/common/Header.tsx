import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppStore } from '../../state/useAppStore';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onSettingsPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title = 'ปฏิบัติงานป้อม', subtitle, onSettingsPress }) => {
  const { user, currentShift, printerConnected, config } = useAppStore();

  return (
    <View style={[styles.container, config.enableShadows && styles.shadow]}>
      <View style={styles.content}>
        <View style={styles.titleArea}>
          <Text style={styles.eyebrow}>{currentShift?.service_name || user?.serviceName || 'ระบบบริหารผู้ติดต่อ'}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>
            {subtitle || `${currentShift?.guardhouse_name || 'ป้อมหลัก'} • ${user?.displayName || 'รปภ.'}`}
          </Text>
        </View>

        {onSettingsPress && (
          <TouchableOpacity style={styles.settingsBtn} onPress={onSettingsPress} activeOpacity={0.7}>
            <View style={[styles.statusDot, { backgroundColor: printerConnected ? '#10B981' : '#F59E0B' }]} />
            <Text style={styles.settingsText}>ตั้งค่า</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  shadow: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
  },
  eyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  meta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  settingsText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
});
