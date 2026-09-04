import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

export interface GateControlModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenGate: (direction: 'IN' | 'OUT') => Promise<void> | void;
}

export const GateControlModal: React.FC<GateControlModalProps> = ({
  visible,
  onClose,
  onOpenGate,
}) => {
  const [loadingDirection, setLoadingDirection] = useState<'IN' | 'OUT' | null>(null);

  if (!visible) return null;

  const handlePress = async (direction: 'IN' | 'OUT') => {
    if (loadingDirection) return;
    setLoadingDirection(direction);
    try {
      await onOpenGate(direction);
    } finally {
      setLoadingDirection(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrapper}>
                <Text style={styles.headerIcon}>🚪</Text>
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.title}>จัดการไม้กั้น</Text>
                <Text style={styles.subtitle}>เลือกช่องทางที่ต้องการสั่งเปิด</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Gate Option 1: ขาเข้า (IN) */}
          <TouchableOpacity
            style={[
              styles.gateCard,
              styles.gateCardIn,
              loadingDirection === 'IN' && styles.gateCardActive,
            ]}
            onPress={() => handlePress('IN')}
            activeOpacity={0.85}
            disabled={loadingDirection !== null}
          >
            <View style={[styles.leftAccent, { backgroundColor: '#2563EB' }]} />
            <View style={[styles.gateIconWrapper, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.gateIconSymbol}>➜</Text>
            </View>
            <View style={styles.gateInfo}>
              <Text style={styles.gateTitle}>ขาเข้า</Text>
              <Text style={styles.gateDesc}>เปิดไม้กั้นสำหรับรถเข้าพื้นที่</Text>
            </View>
            <View style={[styles.openPillBtn, { backgroundColor: '#EFF6FF' }]}>
              {loadingDirection === 'IN' ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Text style={[styles.openPillText, { color: '#2563EB' }]}>เปิด</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Gate Option 2: ขาออก (OUT) */}
          <TouchableOpacity
            style={[
              styles.gateCard,
              styles.gateCardOut,
              loadingDirection === 'OUT' && styles.gateCardActive,
            ]}
            onPress={() => handlePress('OUT')}
            activeOpacity={0.85}
            disabled={loadingDirection !== null}
          >
            <View style={[styles.leftAccent, { backgroundColor: '#0284C7' }]} />
            <View style={[styles.gateIconWrapper, { backgroundColor: '#0284C7' }]}>
              <Text style={styles.gateIconSymbol}>➜</Text>
            </View>
            <View style={styles.gateInfo}>
              <Text style={styles.gateTitle}>ขาออก</Text>
              <Text style={styles.gateDesc}>เปิดไม้กั้นสำหรับรถออกจากพื้นที่</Text>
            </View>
            <View style={[styles.openPillBtn, { backgroundColor: '#F0F9FF' }]}>
              {loadingDirection === 'OUT' ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <Text style={[styles.openPillText, { color: '#0284C7' }]}>เปิด</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Footer Note */}
          <View style={styles.footnote}>
            <Text style={styles.footnoteText}>
              ระบบจะไฮไลต์ปุ่มระหว่างส่งคำสั่ง และปิดสถานะให้อัตโนมัติเมื่อส่งคำสั่งเสร็จ
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '900',
  },
  gateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gateCardIn: {
    borderColor: '#DBEAFE',
  },
  gateCardOut: {
    borderColor: '#E0F2FE',
  },
  gateCardActive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#93C5FD',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  gateIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginLeft: 4,
  },
  gateIconSymbol: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  gateInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  gateTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  gateDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  openPillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 54,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  openPillText: {
    fontSize: 14,
    fontWeight: '900',
  },
  footnote: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  footnoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'left',
  },
});
