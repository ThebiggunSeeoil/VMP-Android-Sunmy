import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { PhotoCaptureView, takePhoto } from './PhotoCaptureView';

interface PhotoCaptureModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  captureType?: 'id_card' | 'car_number';
  showPreview?: boolean;
  onClose: () => void;
  onCapture: (filePath: string) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  visible,
  title = '📷 ถ่ายรูป',
  subtitle = 'วางเอกสารให้อยู่ในกรอบ',
  captureType = 'id_card',
  showPreview = true,
  onClose,
  onCapture,
}) => {
  const isCarNumberCapture = captureType === 'car_number';
  const guideColor = isCarNumberCapture ? '#F59E0B' : '#3B82F6';
  const cameraRef = useRef<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  React.useEffect(() => {
    setCameraReady(false);
  }, [visible, preview]);

  const handleShutter = () => {
    setCapturing(true);
    setError(null);
    takePhoto(cameraRef);
  };

  const handlePhotoTaken = (path: string) => {
    setCapturing(false);
    if (showPreview) {
      setPreview(path);
    } else {
      onCapture(path);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onCapture(preview);
      setPreview(null);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setError(null);
  };

  const handleClose = () => {
    setPreview(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>

        {/* Live Camera Preview (hidden when showing photo preview) */}
        {visible && !preview && (
          <PhotoCaptureView
            viewRef={cameraRef}
            isActive={visible && !preview}
            style={StyleSheet.absoluteFillObject}
            onPhotoTaken={handlePhotoTaken}
            onError={(msg) => {
              setCapturing(false);
              setError(msg);
            }}
            onReady={() => setCameraReady(true)}
          />
        )}

        {!preview && !cameraReady && (
          <View style={styles.cameraLoading} pointerEvents="none">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.cameraLoadingTitle}>กำลังเปิดกล้อง...</Text>
            <Text style={styles.cameraLoadingSub}>กำลังเตรียมกล้องสำหรับถ่ายรูปเอกสาร</Text>
          </View>
        )}

        {/* Photo Preview (after capture) */}
        {preview && (
          <Image
            source={{ uri: `file://${preview}` }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.liveDot, isCarNumberCapture && styles.plateLiveDot]} />
            <Text style={[styles.liveText, isCarNumberCapture && styles.plateLiveText]}>
              {preview ? 'ตรวจสอบรูป' : isCarNumberCapture ? 'PLATE CAMERA' : 'ID CARD CAMERA'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Title Area */}
        <View style={styles.titleArea} pointerEvents="none">
          <Text style={[styles.title, isCarNumberCapture && styles.plateGuideText]}>{title}</Text>
          <Text style={[styles.subtitle, isCarNumberCapture && styles.plateGuideSubtext]}>
            {preview ? 'พอใจกับรูปหรือไม่?' : subtitle}
          </Text>
        </View>

        {/* Viewfinder frame (only in camera mode) */}
        {!preview && (
          <View style={styles.viewfinderArea} pointerEvents="none">
            <View style={[styles.frame, isCarNumberCapture && styles.plateFrame]}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: guideColor }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: guideColor }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: guideColor }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: guideColor }]} />
            </View>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {!preview ? (
            /* Camera mode: shutter button */
            <View style={styles.shutterRow}>
              <TouchableOpacity style={styles.cancelTextBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={styles.cancelTextBtnText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shutterBtn, capturing && styles.shutterBtnCapturing]}
                onPress={handleShutter}
                activeOpacity={0.8}
                disabled={capturing}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              <View style={{ width: 60 }} />
            </View>
          ) : (
            /* Preview mode: retake or confirm */
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
                <Text style={styles.retakeBtnText}>🔄 ถ่ายใหม่</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Text style={styles.confirmBtnText}>✅ ใช้รูปนี้</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingTop: 32,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  plateLiveDot: {
    backgroundColor: '#F59E0B',
  },
  plateLiveText: {
    color: '#FCD34D',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  titleArea: {
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    justifyContent: 'center',
    zIndex: 5,
  },
  cameraLoadingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },
  cameraLoadingSub: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  plateGuideText: {
    color: '#FCD34D',
  },
  plateGuideSubtext: {
    color: '#FDE68A',
  },
  viewfinderArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  frame: {
    width: SCREEN_WIDTH * 0.82,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  plateFrame: {
    height: SCREEN_WIDTH * 0.86,
    width: SCREEN_WIDTH * 0.56,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#3B82F6',
  },
  cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.9)',
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  bottomBar: {
    backgroundColor: '#0F172A',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelTextBtn: {
    width: 60,
    alignItems: 'center',
  },
  cancelTextBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBtnCapturing: {
    backgroundColor: 'rgba(59,130,246,0.4)',
    borderColor: '#3B82F6',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  retakeBtnText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 1.5,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
