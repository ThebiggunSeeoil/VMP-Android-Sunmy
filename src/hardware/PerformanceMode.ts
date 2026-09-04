import { Platform } from 'react-native';

export interface PerformanceConfig {
  isLiteMode: boolean;
  enableAnimations: boolean;
  enableShadows: boolean;
  enableGradients: boolean;
  maxImageDimension: number;
  imageQuality: number;
  autoPrintReceipt: boolean;
  autoOpenGateSeconds: number;
}

export const defaultLiteConfig: PerformanceConfig = {
  isLiteMode: true,
  enableAnimations: false,
  enableShadows: false,
  enableGradients: false,
  maxImageDimension: 800,
  imageQuality: 0.6,
  autoPrintReceipt: true,
  autoOpenGateSeconds: 5,
};

export const defaultNormalConfig: PerformanceConfig = {
  isLiteMode: false,
  enableAnimations: true,
  enableShadows: true,
  enableGradients: true,
  maxImageDimension: 1280,
  imageQuality: 0.8,
  autoPrintReceipt: true,
  autoOpenGateSeconds: 5,
};
