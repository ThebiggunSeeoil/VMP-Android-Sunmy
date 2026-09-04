import { NativeModules, NativeEventEmitter, DeviceEventEmitter, Platform } from 'react-native';

const { SunmiScanner } = NativeModules;
const eventEmitter = new NativeEventEmitter(SunmiScanner);

export const SunmiScannerService = {
  /**
   * Listen to hardware orange laser button broadcast on Sunmi devices
   */
  onScan(callback: (code: string) => void) {
    return eventEmitter.addListener('onBarcodeScanned', callback);
  },

  /**
   * Listen to hardware physical keys (VOLUME_UP, VOLUME_DOWN) from MainActivity
   */
  onHardwareKey(callback: (key: 'VOLUME_UP' | 'VOLUME_DOWN') => void) {
    const sub = DeviceEventEmitter.addListener('onHardwareKeyPress', (key: 'VOLUME_UP' | 'VOLUME_DOWN') => {
      console.log('SunmiScannerService received onHardwareKeyPress:', key);
      callback(key);
    });
    return sub;
  },

  /**
   * Open the Sunmi Camera Scanner for Sunmi devices without side laser buttons
   */
  async openCameraScanner(): Promise<string> {
    if (Platform.OS !== 'android') return '';
    try {
      if (SunmiScanner?.openCameraScanner) {
        return await SunmiScanner.openCameraScanner();
      } else if (SunmiScanner?.startScan) {
        await SunmiScanner.startScan();
        return '';
      }
    } catch (e) {
      console.warn('Camera scanner launch error:', e);
    }
    return '';
  },
};

