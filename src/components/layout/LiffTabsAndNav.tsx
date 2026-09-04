import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAppStore } from '../../state/useAppStore';

const tabs: { id: 'works' | 'history' | 'settings'; label: string; icon: string }[] = [
  { id: 'works', label: 'ปฏิบัติงาน', icon: '📋' },
  { id: 'history', label: 'ประวัติเข้าออก', icon: '🕒' },
  { id: 'settings', label: 'ตั้งค่า/ระบบ', icon: '⚙️' },
];

export const LiffTopTabs: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <View style={styles.topTabsWrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topTabsScroll}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.topTabBtn, isActive && styles.topTabBtnActive]}
              onPress={() => setActiveTab(tab.id as any)}
              activeOpacity={0.75}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.topTabText, isActive && styles.topTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export const LiffBottomNav: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { activeTab, setActiveTab } = useAppStore();

  const handleTabPress = (tabId: 'works' | 'history' | 'settings') => {
    setActiveTab(tabId as any);
    if (navigation) {
      navigation.navigate('MainHub');
    }
  };

  return (
    <View style={styles.bottomNavContainer}>
      <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.navItemIcon, isActive && styles.navItemIconActive]}>{tab.icon}</Text>
              <Text style={[styles.navItemText, isActive && styles.navItemTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topTabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topTabsScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  topTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topTabBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  tabIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  topTabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  topTabTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  bottomNavContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 62,
  },
  navItemActive: {
    backgroundColor: '#EFF6FF',
  },
  navItemIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navItemIconActive: {
    transform: [{ scale: 1.1 }],
  },
  navItemText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  navItemTextActive: {
    color: '#1D4ED8',
    fontWeight: '900',
  },
});
