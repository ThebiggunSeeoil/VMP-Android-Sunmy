import React from 'react';
import { requireNativeComponent, ViewProps, View, Text, StyleSheet } from 'react-native';

interface NativeCameraScannerProps extends ViewProps {
  isActive?: boolean;
  torch?: boolean;
  onBarcodeScanned?: (event: { nativeEvent: { code: string } }) => void;
}

const NativeCameraScanner = requireNativeComponent<NativeCameraScannerProps>('CameraScannerView');

interface CameraScannerViewProps {
  onScan: (code: string) => void;
  isActive?: boolean;
  torch?: boolean;
  style?: any;
}

export const CameraScannerView: React.FC<CameraScannerViewProps> = ({
  onScan,
  isActive = true,
  torch = false,
  style,
}) => {
  const handleScanned = (event: { nativeEvent: { code: string } }) => {
    const code = event.nativeEvent.code;
    if (code) {
      onScan(code);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <NativeCameraScanner
        style={StyleSheet.absoluteFillObject}
        isActive={isActive}
        torch={torch}
        onBarcodeScanned={handleScanned}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderRadius: 16,
  },
});
