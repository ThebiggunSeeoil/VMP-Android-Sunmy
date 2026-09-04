import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { BluetoothSppScanner } = NativeModules;

export interface BluetoothDeviceItem {
  name: string;
  address: string;
  type?: number;
}

export interface BluetoothConnectionStatus {
  connected: boolean;
  deviceName?: string;
  address?: string;
}

const eventEmitter = BluetoothSppScanner
  ? new NativeEventEmitter(BluetoothSppScanner)
  : null;

export const BluetoothSppService = {
  /**
   * Check if native module is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!BluetoothSppScanner;
  },

  /**
   * Get list of paired Bluetooth devices on Android
   */
  async getPairedDevices(): Promise<BluetoothDeviceItem[]> {
    if (!this.isAvailable()) return [];
    try {
      const devices = await BluetoothSppScanner.getPairedDevices();
      return Array.isArray(devices) ? devices : [];
    } catch (e) {
      console.warn('getPairedDevices error:', e);
      return [];
    }
  },

  /**
   * Check current SPP connection status
   */
  async isConnected(): Promise<BluetoothConnectionStatus> {
    if (!this.isAvailable()) return { connected: false };
    try {
      return await BluetoothSppScanner.isConnected();
    } catch (e) {
      return { connected: false };
    }
  },

  /**
   * Connect to a Bluetooth device in SPP mode
   */
  async connect(address: string): Promise<BluetoothConnectionStatus> {
    if (!this.isAvailable()) throw new Error('Bluetooth SPP not available on this platform');
    return await BluetoothSppScanner.connect(address);
  },

  /**
   * Disconnect current SPP connection
   */
  async disconnect(): Promise<boolean> {
    if (!this.isAvailable()) return true;
    try {
      return await BluetoothSppScanner.disconnect();
    } catch (e) {
      return true;
    }
  },

  /**
   * Listen to Bluetooth SPP connection status changes
   */
  onStatusChange(callback: (status: BluetoothConnectionStatus) => void) {
    if (!eventEmitter) return { remove: () => {} };
    return eventEmitter.addListener('onBluetoothStatusChange', callback);
  },

  /**
   * Listen specifically to SPP barcode scan events
   */
  onScan(callback: (scannedCode: string) => void) {
    if (!eventEmitter) return { remove: () => {} };
    return eventEmitter.addListener('onBluetoothSppScanned', callback);
  },
};
