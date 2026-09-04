import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BluetoothSppService, BluetoothDeviceItem } from '../../hardware/BluetoothSppScanner';

export interface BluetoothDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected: (device: BluetoothDeviceItem) => void;
  currentAddress?: string;
}

export const BluetoothDeviceModal: React.FC<BluetoothDeviceModalProps> = ({
  visible,
  onClose,
  onConnected,
  currentAddress,
}) => {
  const [devices, setDevices] = useState<BluetoothDeviceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const list = await BluetoothSppService.getPairedDevices();
      setDevices(list);
    } catch (e) {
      console.warn('Failed to get paired devices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadDevices();
    }
  }, [visible]);

  const handleSelectDevice = async (device: BluetoothDeviceItem) => {
    setConnectingAddress(device.address);
    try {
      const res = await BluetoothSppService.connect(device.address);
      if (res.connected) {
        Alert.alert('เชื่อมต่อสำเร็จ 🎉', `เชื่อมต่อสแกนเนอร์ ${device.name || device.address} (โหมด SPP) เรียบร้อยแล้ว`);
        onConnected(device);
        onClose();
      } else {
        Alert.alert('เชื่อมต่อไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อกับอุปกรณ์นี้ได้ โปรดตรวจสอบว่าเปิดเครื่องและอยู่ในโหมด SPP');
      }
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e?.message || 'ไม่สามารถเชื่อมต่ออุปกรณ์ได้');
    } finally {
      setConnectingAddress(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>🔵</Text>
              <View>
                <Text style={styles.headerTitle}>เลือกอุปกรณ์ Bluetooth (SPP)</Text>
                <Text style={styles.headerSub}>แตะชื่ออุปกรณ์เพื่อเชื่อมต่อโหมด Serial Port</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadDevices} disabled={loading}>
              <Text style={styles.refreshBtnText}>{loading ? '...' : '🔄 รีเฟรช'}</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#1D4ED8" />
                <Text style={styles.loadingText}>กำลังค้นหาอุปกรณ์ที่จับคู่แล้ว...</Text>
              </View>
            ) : devices.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyIcon}>📡</Text>
                <Text style={styles.emptyTitle}>ไม่พบอุปกรณ์ที่จับคู่ (Paired Devices)</Text>
                <Text style={styles.emptySub}>
                  กรุณาเข้าไปที่ "การตั้งค่า Android &gt; บลูทูธ" เพื่อจับคู่ (Pair) กับสแกนเนอร์ก่อน จากนั้นกลับมากดรีเฟรชที่นี่
                </Text>
              </View>
            ) : (
              <FlatList
                data={devices}
                keyExtractor={(item) => item.address}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isCurrent = currentAddress === item.address;
                  const isConnecting = connectingAddress === item.address;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.deviceItem,
                        isCurrent && styles.deviceItemActive,
                      ]}
                      onPress={() => handleSelectDevice(item)}
                      disabled={isConnecting}
                      activeOpacity={0.7}
                    >
                      <View style={styles.deviceIconCircle}>
                        <Text style={styles.deviceEmoji}>🖲️</Text>
                      </View>
                      <View style={styles.deviceDetails}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {item.name || 'Unknown Device'}
                        </Text>
                        <Text style={styles.deviceAddress}>{item.address}</Text>
                      </View>
                      {isConnecting ? (
                        <ActivityIndicator size="small" color="#1D4ED8" />
                      ) : isCurrent ? (
                        <View style={styles.connectedBadge}>
                          <Text style={styles.connectedBadgeText}>กำลังใช้งาน</Text>
                        </View>
                      ) : (
                        <View style={styles.connectBtnBadge}>
                          <Text style={styles.connectBtnText}>เชื่อมต่อ</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  headerIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  refreshBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  body: {
    padding: 14,
    minHeight: 220,
    maxHeight: 360,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  deviceItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  deviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceEmoji: {
    fontSize: 18,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '800',
  },
  deviceAddress: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  connectedBadge: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  connectedBadgeText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
  connectBtnBadge: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
});
