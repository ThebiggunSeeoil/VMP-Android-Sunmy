import React, { useRef } from 'react';
import {
  requireNativeComponent,
  ViewProps,
  UIManager,
  findNodeHandle,
  StyleSheet,
  View,
} from 'react-native';

interface NativePhotoCaptureProps extends ViewProps {
  isActive?: boolean;
  onPhotoTaken?: (event: { nativeEvent: { path: string } }) => void;
  onCameraError?: (event: { nativeEvent: { message: string } }) => void;
  onCameraReady?: () => void;
}

const NativePhotoCapture = requireNativeComponent<NativePhotoCaptureProps>('PhotoCaptureView');

export interface PhotoCaptureViewRef {
  takePhoto: () => void;
}

interface PhotoCaptureViewProps {
  isActive?: boolean;
  onPhotoTaken: (path: string) => void;
  onError?: (message: string) => void;
  onReady?: () => void;
  style?: any;
  viewRef?: React.RefObject<any>;
}

export const PhotoCaptureView: React.FC<PhotoCaptureViewProps> = ({
  isActive = true,
  onPhotoTaken,
  onError,
  onReady,
  style,
  viewRef,
}) => {
  const internalRef = useRef<any>(null);
  const ref = viewRef || internalRef;

  return (
    <View style={[styles.container, style]}>
      <NativePhotoCapture
        ref={ref}
        style={StyleSheet.absoluteFillObject}
        isActive={isActive}
        onPhotoTaken={(e) => onPhotoTaken(e.nativeEvent.path)}
        onCameraError={(e) => onError?.(e.nativeEvent.message)}
        onCameraReady={onReady}
      />
    </View>
  );
};

/**
 * Trigger the native takePhoto command on a PhotoCaptureView ref.
 */
export const takePhoto = (viewRef: React.RefObject<any>) => {
  const handle = findNodeHandle(viewRef.current);
  if (handle) {
    const config = UIManager.getViewManagerConfig('PhotoCaptureView');
    const commandId = config?.Commands?.takePhoto ?? 1;
    UIManager.dispatchViewManagerCommand(
      handle,
      commandId,
      []
    );
  }
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
});
