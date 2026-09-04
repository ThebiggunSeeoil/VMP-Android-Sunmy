import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';

export interface ResultStatusModalProps {
  visible: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  autoCloseSeconds?: number;
  buttonText?: string;
  debugSession?: {
    totalDurationMs: number;
    passId?: string;
    steps?: Array<{
      stepNum: number;
      name: string;
      durationMs: number;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      detail?: string;
    }>;
  } | null;
  onClose: () => void;
}

export const ResultStatusModal: React.FC<ResultStatusModalProps> = ({
  visible,
  type = 'success',
  title,
  message,
  autoCloseSeconds = 3,
  buttonText = 'ตกลง',
  debugSession,
  onClose,
}) => {
  const [countdown, setCountdown] = useState(autoCloseSeconds);

  useEffect(() => {
    if (!visible) return;
    setCountdown(autoCloseSeconds);

    if (autoCloseSeconds <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, autoCloseSeconds]);

  if (!visible) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';

  const iconBg = isSuccess
    ? '#DCFCE7'
    : isError
    ? '#FEE2E2'
    : isWarning
    ? '#FEF3C7'
    : '#EFF6FF';

  const iconBorder = isSuccess
    ? '#86EFAC'
    : isError
    ? '#FCA5A5'
    : isWarning
    ? '#FDE68A'
    : '#BFDBFE';

  const iconColor = isSuccess
    ? '#16A34A'
    : isError
    ? '#DC2626'
    : isWarning
    ? '#D97706'
    : '#2563EB';

  const iconSymbol = isSuccess
    ? '✓'
    : isError
    ? '✕'
    : isWarning
    ? '⚠️'
    : 'ℹ️';

  const btnBg = isSuccess
    ? '#16A34A'
    : isError
    ? '#DC2626'
    : isWarning
    ? '#D97706'
    : '#2563EB';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Boolean(debugSession) && styles.cardDebug]}>
          {/* Status Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: iconBg, borderColor: iconBorder }]}>
            <Text style={[styles.iconText, { color: iconColor }]}>{iconSymbol}</Text>
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Debug Timing & Step Breakdown (When debugMode is active) */}
          {debugSession && (
            <View style={styles.debugSessionBox}>
              <View style={styles.debugSessionHeader}>
                <Text style={styles.debugSessionIcon}>⏱️</Text>
                <Text style={styles.debugSessionTitle}>
                  เวลารวม: <Text style={styles.debugTotalTime}>{debugSession.totalDurationMs} ms</Text>
                </Text>
              </View>
              {debugSession.steps && debugSession.steps.length > 0 && (
                <View style={styles.debugStepsList}>
                  {debugSession.steps.map((step, idx) => {
                    const isStepOk = step.status === 'SUCCESS';
                    return (
                      <View key={idx} style={styles.debugStepRow}>
                        <Text style={styles.debugStepNum}>{step.stepNum}.</Text>
                        <View style={styles.debugStepNameCol}>
                          <Text style={styles.debugStepName}>{step.name}</Text>
                          {step.detail ? (
                            <Text style={styles.debugStepDetail} numberOfLines={1}>
                              {step.detail}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.debugBadge,
                            isStepOk ? styles.debugBadgeSuccess : styles.debugBadgeFailed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.debugBadgeText,
                              isStepOk ? styles.debugTextSuccess : styles.debugTextFailed,
                            ]}
                          >
                            {step.durationMs}ms {isStepOk ? '✓' : '✕'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Countdown indicator */}
          {autoCloseSeconds > 0 && (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>
                จะปิดอัตโนมัติใน {countdown} วินาที
              </Text>
            </View>
          )}

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: btnBg }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 330,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  iconText: {
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
  },
  countdownBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 18,
  },
  countdownText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  btn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cardDebug: {
    maxWidth: 350,
  },
  debugSessionBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  debugSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  debugSessionIcon: {
    fontSize: 14,
  },
  debugSessionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  debugTotalTime: {
    fontWeight: '900',
    color: '#1D4ED8',
  },
  debugStepsList: {
    gap: 6,
  },
  debugStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  debugStepNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    width: 14,
  },
  debugStepNameCol: {
    flex: 1,
  },
  debugStepName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  debugStepDetail: {
    fontSize: 9.5,
    color: '#64748B',
  },
  debugBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  debugBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  debugBadgeFailed: {
    backgroundColor: '#FEE2E2',
  },
  debugBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  debugTextSuccess: {
    color: '#16A34A',
  },
  debugTextFailed: {
    color: '#DC2626',
  },
});
