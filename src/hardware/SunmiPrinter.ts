import { NativeModules } from 'react-native';

const { SunmiPrinter } = NativeModules;

export interface VisitorSlipData {
  title?: string;
  serviceName?: string;
  villageName?: string;
  dateStr?: string;
  timeStr?: string;
  guardhouse?: string;
  reason?: string;
  houseNo?: string;
  licensePlate?: string;
  vehicleType?: string;
  qrPayload?: string;
  legacyQrPayload?: string;
  barcodePayload?: string;
  payloadMode?: 'legacy' | 'short_token' | 'hybrid';
  passId?: string;
  validUntil?: string;
  validHours?: number;
  checkoutRequired?: boolean;
  allowLateCheckout?: boolean;
  visitorName?: string;
  note?: string;
}

export interface PrinterStatusResult {
  isConnected: boolean;
  status: 'NORMAL' | 'OUT_OF_PAPER' | 'COVER_OPEN' | 'OVERHEAT' | 'UPDATING' | 'DISCONNECTED' | 'ERROR';
  code: number;
  message: string;
}

export interface PrintSlipResult {
  success: boolean;
  status: 'SUCCESS' | 'OUT_OF_PAPER' | 'COVER_OPEN' | 'OVERHEAT' | 'DISCONNECTED' | 'ERROR';
  message: string;
}

export const SunmiPrinterService = {
  /**
   * Check if Sunmi Printer AIDL Service is connected
   */
  async isConnected(): Promise<boolean> {
    if (!SunmiPrinter) return false;
    try {
      return await SunmiPrinter.isConnected();
    } catch {
      return false;
    }
  },

  /**
   * Get real-time printer hardware and paper status
   */
  async getPrinterStatus(): Promise<PrinterStatusResult> {
    if (!SunmiPrinter) {
      return {
        isConnected: false,
        status: 'DISCONNECTED',
        code: -1,
        message: 'ไม่ได้เชื่อมต่อกับเครื่องพิมพ์ Sunmi',
      };
    }
    try {
      const res = await SunmiPrinter.getPrinterStatus();
      return {
        isConnected: res?.isConnected ?? false,
        status: res?.status || 'NORMAL',
        code: res?.code ?? 1,
        message: res?.message || 'เครื่องพิมพ์พร้อมใช้งาน',
      };
    } catch (e: any) {
      return {
        isConnected: false,
        status: 'ERROR',
        code: -2,
        message: e?.message || 'ไม่สามารถตรวจสอบสถานะเครื่องพิมพ์ได้',
      };
    }
  },

  /**
   * Initialize and reset printer
   */
  async init(): Promise<boolean> {
    if (!SunmiPrinter) return false;
    try {
      return await SunmiPrinter.printerInit();
    } catch {
      return false;
    }
  },

  /**
   * Print text line
   * @param align 0: Left, 1: Center, 2: Right
   * @param fontSize Default 24
   */
  async printText(
    text: string,
    align: number = 0,
    fontSize: number = 24,
    isBold: boolean = false,
    isUnderline: boolean = false
  ): Promise<boolean> {
    if (!SunmiPrinter) return false;
    try {
      return await SunmiPrinter.printText(text + '\n', align, fontSize, isBold, isUnderline);
    } catch (e) {
      console.warn('SunmiPrinter printText error:', e);
      return false;
    }
  },

  /**
   * Print 2D QR Code
   */
  async printQRCode(data: string, moduleSize: number = 8, errorLevel: number = 2): Promise<boolean> {
    if (!SunmiPrinter) return false;
    try {
      return await SunmiPrinter.printQRCode(data, moduleSize, errorLevel);
    } catch (e) {
      console.warn('SunmiPrinter printQRCode error:', e);
      return false;
    }
  },

  /**
   * Feed n lines
   */
  async lineWrap(n: number = 1): Promise<boolean> {
    if (!SunmiPrinter) return false;
    try {
      return await SunmiPrinter.lineWrap(n);
    } catch {
      return false;
    }
  },

  /**
   * Direct Thermal Slip Printer for Sunmi V2 Pro / V2 Plus (Fastest, zero Canvas/Bitmap overhead)
   */
  async printVisitorSlip(slipData: VisitorSlipData): Promise<PrintSlipResult> {
    if (!SunmiPrinter) {
      console.warn('SunmiPrinter NativeModule not available');
      return {
        success: false,
        status: 'DISCONNECTED',
        message: 'SunmiPrinter NativeModule not available',
      };
    }
    try {
      const res = await SunmiPrinter.printVisitorSlip(slipData);
      if (typeof res === 'boolean') {
        return res
          ? { success: true, status: 'SUCCESS', message: 'พิมพ์สลิปสำเร็จ' }
          : { success: false, status: 'ERROR', message: 'ไม่สามารถพิมพ์สลิปได้' };
      }
      if (res && typeof res === 'object') {
        return {
          success: res.success !== false,
          status: res.status || (res.success ? 'SUCCESS' : 'ERROR'),
          message: res.message || (res.success ? 'พิมพ์สำเร็จ' : 'พิมพ์ไม่สำเร็จ'),
        };
      }
      return { success: true, status: 'SUCCESS', message: 'พิมพ์สลิปสำเร็จ' };
    } catch (e: any) {
      console.error('Failed to print visitor slip:', e);
      const msg = e?.message || '';
      const isPaperOut = msg.toLowerCase().includes('paper') || msg.toLowerCase().includes('out_of_paper');
      return {
        success: false,
        status: isPaperOut ? 'OUT_OF_PAPER' : 'ERROR',
        message: isPaperOut ? 'กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่' : (msg || 'ไม่สามารถพิมพ์สลิปได้'),
      };
    }
  },
};
