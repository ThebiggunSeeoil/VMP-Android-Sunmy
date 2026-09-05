import React, { useEffect, useState } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator, Image, Text } from 'react-native';

import { WorksTabScreen } from './src/screens/works/WorksTabScreen';
import { ScanOnboardingScreen } from './src/screens/auth/ScanOnboardingScreen';
import { SetPasscodeScreen } from './src/screens/auth/SetPasscodeScreen';
import { PasscodeLoginScreen } from './src/screens/auth/PasscodeLoginScreen';
import { SelectProfileScreen } from './src/screens/auth/SelectProfileScreen';
import { CheckInScreen } from './src/screens/guard/CheckInScreen';
import { CheckOutScreen } from './src/screens/guard/CheckOutScreen';
import { GuardQrPassRequestScreen } from './src/screens/guard/GuardQrPassRequestScreen';
import { GuardQrPassRequestStatusScreen } from './src/screens/guard/GuardQrPassRequestStatusScreen';
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { SunmiPrinterService } from './src/hardware/SunmiPrinter';
import { useAppStore, GuardhouseProfile } from './src/state/useAppStore';
import { cacheControl } from './src/api/vmsApi';

const LOGO_IMG = require('./src/assets/images/logo-1.png');

type Screen =
  | 'loading'
  | 'onboarding'
  | 'set_passcode'
  | 'passcode_login'
  | 'select_profile'
  | 'main'
  | 'checkin'
  | 'checkout'
  | 'guard_qr_request'
  | 'guard_qr_request_status'
  | 'settings';

export default function App() {
  const { initFromStorage, isRegistered, setPrinterConnected } = useAppStore();

  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [screenParams, setScreenParams] = useState<any>({});

  useEffect(() => {
    // Load saved cache preferences FIRST (await so _cacheConfig is ready before screens mount)
    cacheControl.loadFromStorage().then(() => {
      // Printer init can run in parallel (non-blocking)
      SunmiPrinterService.init().then(() => {
        SunmiPrinterService.isConnected().then((c) => setPrinterConnected(c));
      });
    });

    const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 800));

    Promise.all([initFromStorage(), minLoadingTime]).then(([initResult]) => {
      const { status, profiles } = initResult as { status: string; profiles: GuardhouseProfile[] };
      if (status === 'no_profile') {
        setCurrentScreen('onboarding');
      } else if (profiles.length === 1) {
        // Single profile → go straight to passcode login
        setScreenParams({ profileId: profiles[0].profileId });
        setCurrentScreen('passcode_login');
      } else {
        // Multiple profiles → let user pick
        setCurrentScreen('select_profile');
      }
    });
  }, []);

  const navigation = {
    navigate: (screenName: string, params?: any) => {
      setScreenParams(params || {});
      switch (screenName) {
        case 'MainHub':         return setCurrentScreen('main');
        case 'ScanOnboarding':  return setCurrentScreen('onboarding');
        case 'SetPasscode':     return setCurrentScreen('set_passcode');
        case 'PasscodeLogin':   return setCurrentScreen('passcode_login');
        case 'SelectProfile':   return setCurrentScreen('select_profile');
        case 'CheckIn':         return setCurrentScreen('checkin');
        case 'CheckOut':        return setCurrentScreen('checkout');
        case 'GuardQrPassRequest': return setCurrentScreen('guard_qr_request');
        case 'GuardQrPassRequestStatus': return setCurrentScreen('guard_qr_request_status');
        case 'Settings':
          useAppStore.getState().setActiveTab('settings');
          return setCurrentScreen('main');
      }
    },
    replace: (screenName: string, params?: any) => {
      navigation.navigate(screenName, params);
    },
    goBack: () => {
      setCurrentScreen('main');
    },
  };

  if (currentScreen === 'loading') {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.loadingCard}>
          <Image source={LOGO_IMG} style={styles.loadingLogo} resizeMode="contain" />
        </View>
        <Text style={styles.loadingAppName}>VMP</Text>
        <Text style={styles.loadingAppTagline}>VISITOR MANAGEMENT POS</Text>

        <View style={styles.loadingSpinnerWrap}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingStatusText}>กำลังเตรียมความพร้อมระบบ...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {currentScreen === 'onboarding' && (
        <ScanOnboardingScreen navigation={navigation} />
      )}
      {currentScreen === 'set_passcode' && (
        <SetPasscodeScreen navigation={navigation} profileId={screenParams.profileId} />
      )}
      {currentScreen === 'passcode_login' && (
        <PasscodeLoginScreen navigation={navigation} profileId={screenParams.profileId} />
      )}
      {currentScreen === 'select_profile' && (
        <SelectProfileScreen navigation={navigation} />
      )}
      {currentScreen === 'main' && (
        <WorksTabScreen navigation={navigation} />
      )}
      {currentScreen === 'checkin' && (
        <CheckInScreen navigation={navigation} />
      )}
      {currentScreen === 'checkout' && (
        <CheckOutScreen navigation={navigation} route={{ params: screenParams }} />
      )}
      {currentScreen === 'guard_qr_request' && <GuardQrPassRequestScreen navigation={navigation} />}
      {currentScreen === 'guard_qr_request_status' && <GuardQrPassRequestStatusScreen navigation={navigation} />}
      {currentScreen === 'settings' && (
        <SettingsScreen navigation={navigation} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: 140,
    height: 140,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    padding: 12,
  },
  loadingLogo: {
    width: '100%',
    height: '100%',
  },
  loadingAppName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 20,
  },
  loadingAppTagline: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  loadingSpinnerWrap: {
    marginTop: 32,
    alignItems: 'center',
  },
  loadingStatusText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
});
