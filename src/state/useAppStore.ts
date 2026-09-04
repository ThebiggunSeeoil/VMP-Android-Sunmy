import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultLiteConfig, defaultNormalConfig, PerformanceConfig } from '../hardware/PerformanceMode';
import { getBaseApiUrl, setBaseApiUrl, DEFAULT_BACKEND_URL, setAuthToken } from '../api/client';

export interface GuardhouseInfo {
  id: string;
  name: string;
  serviceId: string;
  villageName: string;
  ownerName: string;
  autoDoorControl: boolean;
  autoDoorTimeSet: number;
  enableQrCodeGenerator?: boolean;
  qrCodeGeneratorMode?: 'reserve_existing_cards' | 'create_new_qr_each_time';
}

export type VisitorPassIssueMethod = 'generated' | 'visitor_card' | 'ask';
export type InnerPrinterPayloadMode = 'legacy' | 'short_token' | 'hybrid';

export interface SecurityGuardInfo {
  id: string;
  userId?: string;
  name: string;
  surname: string;
  fullName: string;
  companyName: string;
  positionName: string;
  phone?: string;
}

export interface GuardhouseSettings {
  isLiteMode?: boolean;
  showPhotoPreview?: boolean;
  visitorPassIssueMethod?: VisitorPassIssueMethod;
  innerPrinterPayloadMode?: InnerPrinterPayloadMode;
  requireHouseForGate?: boolean;
  enableGateControl?: boolean;
  autoCheckIn?: boolean;
  debugMode?: boolean;
  bluetoothScannerMode?: 'SPP' | 'HID';
  bluetoothScannerDevice?: { name: string; address: string } | null;
}

/** Profile ของแต่ละป้อมที่ลงทะเบียนบน device นี้ */
export interface GuardhouseProfile {
  profileId: string;            // unique key (guardhouse.id)
  guardhouse: GuardhouseInfo;
  guard: SecurityGuardInfo;
  token: string | null;
  passcodeHash: string | null;  // SHA256 hex hash ของ 4-digit PIN
  apiUrl: string;
  lastUsed: number;             // timestamp สำหรับเรียงลำดับ
  biometricEnabled: boolean;    // user เปิดใช้ fingerprint ไว้หรือไม่
  settings?: GuardhouseSettings; // config แยกตามป้อม
}

const PROFILES_KEY = 'vms_guardhouse_profiles';
const MAX_ATTEMPTS = 5;

/** Simple SHA256-like hash using djb2 (ไม่ต้องใช้ library ภายนอก) */
function hashPin(pin: string, salt: string): string {
  const str = salt + pin + 'VMS_SUNMI_SALT_2025';
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

interface AppState {
  isRegistered: boolean;
  guardhouse: GuardhouseInfo | null;
  guard: SecurityGuardInfo | null;
  config: PerformanceConfig;
  showPhotoPreview: boolean;
  visitorPassIssueMethod: VisitorPassIssueMethod;
  innerPrinterPayloadMode: InnerPrinterPayloadMode;
  requireHouseForGate: boolean;
  enableGateControl: boolean;
  autoCheckIn: boolean;
  debugMode: boolean;
  bluetoothScannerMode: 'SPP' | 'HID';
  bluetoothScannerDevice: { name: string; address: string } | null;
  printerConnected: boolean;
  apiUrl: string;
  activeTab: 'works' | 'history' | 'patrol' | 'worktime' | 'settings';

  // Multi-profile
  profiles: GuardhouseProfile[];
  activeProfileId: string | null;
  loginAttempts: number;        // retry counter ปัจจุบัน

  initFromStorage: () => Promise<{ status: 'no_profile' | 'has_profiles'; profiles: GuardhouseProfile[] }>;
  completeRegistration: (
    guard: SecurityGuardInfo,
    guardhouse: GuardhouseInfo,
    token?: string | null,
    apiUrl?: string,
  ) => Promise<{ profileId: string }>;
  savePasscode: (profileId: string, pin: string) => Promise<void>;
  verifyPasscode: (profileId: string, pin: string) => boolean;
  enableBiometric: (profileId: string, enabled: boolean) => Promise<void>;
  loginWithProfile: (profileId: string) => void;
  switchProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => Promise<void>;
  resetRegistration: () => Promise<void>;
  incrementLoginAttempt: () => number;
  resetLoginAttempts: () => void;
  setLiteMode: (isLite: boolean) => void;
  setShowPhotoPreview: (showPreview: boolean) => void;
  setVisitorPassIssueMethod: (method: VisitorPassIssueMethod) => void;
  setInnerPrinterPayloadMode: (mode: InnerPrinterPayloadMode) => void;
  setRequireHouseForGate: (requireHouse: boolean) => void;
  setEnableGateControl: (enableGateControl: boolean) => void;
  setAutoCheckIn: (autoCheckIn: boolean) => void;
  setDebugMode: (debugMode: boolean) => void;
  setBluetoothScannerMode: (mode: 'SPP' | 'HID') => void;
  setBluetoothScannerDevice: (device: { name: string; address: string } | null) => void;
  updateGuardhouse: (guardhouse: GuardhouseInfo) => Promise<void>;
  setPrinterConnected: (connected: boolean) => void;
  setApiUrl: (url: string) => void;
  setActiveTab: (tab: 'works' | 'history' | 'patrol' | 'worktime' | 'settings') => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isRegistered: false,
  guardhouse: null,
  guard: null,
  config: defaultLiteConfig,
  showPhotoPreview: true,
  visitorPassIssueMethod: 'generated',
  // This branch uses the same setting currently selected in its PWA: a short
  // token is printed as both QR and Code128 barcode whenever available.
  innerPrinterPayloadMode: 'short_token',
  requireHouseForGate: false,
  enableGateControl: true,
  autoCheckIn: true,
  debugMode: false,
  bluetoothScannerMode: 'SPP',
  bluetoothScannerDevice: null,
  printerConnected: false,
  apiUrl: DEFAULT_BACKEND_URL,
  activeTab: 'works',
  profiles: [],
  activeProfileId: null,
  loginAttempts: 0,

  initFromStorage: async () => {
    try {
      // Load backend URL
      const savedApiUrl = await AsyncStorage.getItem('vms_backend_url');
      if (savedApiUrl) {
        setBaseApiUrl(savedApiUrl);
        set({ apiUrl: getBaseApiUrl() });
      } else {
        setBaseApiUrl(DEFAULT_BACKEND_URL);
        set({ apiUrl: DEFAULT_BACKEND_URL });
      }

      const savedShowPhotoPreview = await AsyncStorage.getItem('vms_show_photo_preview');
      if (savedShowPhotoPreview !== null) {
        set({ showPhotoPreview: savedShowPhotoPreview !== 'false' });
      }

      const savedVisitorPassMethod = await AsyncStorage.getItem('vms_visitor_pass_issue_method');
      if (savedVisitorPassMethod === 'generated' || savedVisitorPassMethod === 'visitor_card' || savedVisitorPassMethod === 'ask') {
        set({ visitorPassIssueMethod: savedVisitorPassMethod });
      }

      const savedPrinterPayloadMode = await AsyncStorage.getItem('vms_inner_printer_pass_payload_mode');
      if (savedPrinterPayloadMode === 'legacy' || savedPrinterPayloadMode === 'short_token' || savedPrinterPayloadMode === 'hybrid') {
        set({ innerPrinterPayloadMode: savedPrinterPayloadMode });
      }

      const savedRequireHouse = await AsyncStorage.getItem('vms_require_house_for_gate');
      if (savedRequireHouse !== null) {
        set({ requireHouseForGate: savedRequireHouse === 'true' });
      }

      const savedEnableGateControl = await AsyncStorage.getItem('vms_enable_gate_control');
      if (savedEnableGateControl !== null) {
        set({ enableGateControl: savedEnableGateControl !== 'false' });
      }

      const savedAutoCheckIn = await AsyncStorage.getItem('vms_auto_checkin');
      if (savedAutoCheckIn !== null) {
        set({ autoCheckIn: savedAutoCheckIn !== 'false' });
      }

      const savedBtMode = await AsyncStorage.getItem('vms_bluetooth_scanner_mode');
      if (savedBtMode === 'SPP' || savedBtMode === 'HID') {
        set({ bluetoothScannerMode: savedBtMode });
      }

      const savedBtDevice = await AsyncStorage.getItem('vms_bluetooth_scanner_device');
      if (savedBtDevice) {
        try {
          set({ bluetoothScannerDevice: JSON.parse(savedBtDevice) });
        } catch {}
      }

      // Load profiles
      const profilesJson = await AsyncStorage.getItem(PROFILES_KEY);
      if (profilesJson) {
        const profiles: GuardhouseProfile[] = JSON.parse(profilesJson);
        if (profiles.length > 0) {
          // Sort by lastUsed desc
          profiles.sort((a, b) => b.lastUsed - a.lastUsed);
          set({ profiles });
          return { status: 'has_profiles', profiles };
        }
      }

      // Legacy: migrate single guard/guardhouse to profile
      const savedGuard = await AsyncStorage.getItem('vms_device_guard');
      const savedGh = await AsyncStorage.getItem('vms_device_guardhouse');
      const savedToken = await AsyncStorage.getItem('vms_jwt_token');
      if (savedGuard && savedGh) {
        const guard = JSON.parse(savedGuard);
        const guardhouse = JSON.parse(savedGh);
        const legacyProfile: GuardhouseProfile = {
          profileId: guardhouse.id,
          guard,
          guardhouse,
          token: savedToken || null,
          passcodeHash: null,
          apiUrl: savedApiUrl || DEFAULT_BACKEND_URL,
          lastUsed: Date.now(),
          biometricEnabled: false,
        };
        const profiles = [legacyProfile];
        await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
        set({ profiles });
        return { status: 'has_profiles', profiles };
      }

      return { status: 'no_profile', profiles: [] };
    } catch (e) {
      console.warn('Storage init error:', e);
      return { status: 'no_profile', profiles: [] };
    }
  },

  completeRegistration: async (guard, guardhouse, token, apiUrlOverride) => {
    const profileId = guardhouse.id;
    const apiUrl = apiUrlOverride || getBaseApiUrl();

    const currentSettings: GuardhouseSettings = {
      isLiteMode: get().config.isLiteMode,
      showPhotoPreview: get().showPhotoPreview,
      visitorPassIssueMethod: get().visitorPassIssueMethod,
      innerPrinterPayloadMode: get().innerPrinterPayloadMode,
      requireHouseForGate: get().requireHouseForGate,
      enableGateControl: get().enableGateControl,
      autoCheckIn: get().autoCheckIn,
      debugMode: get().debugMode,
    };

    const newProfile: GuardhouseProfile = {
      profileId,
      guard,
      guardhouse,
      token: token || null,
      passcodeHash: null,  // จะถูก set ใน SetPasscodeScreen
      apiUrl,
      lastUsed: Date.now(),
      biometricEnabled: false,
      settings: currentSettings,
    };

    const existing = get().profiles;
    // Replace หาก profileId เดิมมีอยู่ (re-register)
    const updated = existing.filter(p => p.profileId !== profileId);
    updated.unshift(newProfile);

    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    if (token) setAuthToken(token);

    set({
      profiles: updated,
      activeProfileId: profileId,
      guard,
      guardhouse,
      apiUrl,
    });

    return { profileId };
  },

  savePasscode: async (profileId, pin) => {
    const profiles = get().profiles;
    const targetId = profileId || (profiles.length === 1 ? profiles[0].profileId : '');
    const updated = profiles.map(p => {
      if (p.profileId === targetId || (profiles.length === 1 && (!p.profileId || !targetId))) {
        const effectiveId = p.profileId || targetId || 'default_profile';
        return { ...p, profileId: effectiveId, passcodeHash: hashPin(pin, effectiveId) };
      }
      return p;
    });
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    set({ profiles: updated });
  },

  verifyPasscode: (profileId, pin) => {
    const profiles = get().profiles;
    let profile = profiles.find(p => p.profileId === profileId);
    if (!profile && profiles.length === 1) {
      profile = profiles[0];
    }
    if (!profile || !profile.passcodeHash) return false;
    const effectiveId = profile.profileId || profileId || 'default_profile';
    return hashPin(pin, effectiveId) === profile.passcodeHash;
  },

  enableBiometric: async (profileId, enabled) => {
    const profiles = get().profiles;
    const updated = profiles.map(p =>
      p.profileId === profileId ? { ...p, biometricEnabled: enabled } : p
    );
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    set({ profiles: updated });
  },

  loginWithProfile: (profileId) => {
    const profile = get().profiles.find(p => p.profileId === profileId);
    if (!profile) return;

    // Update lastUsed
    const profiles = get().profiles.map(p =>
      p.profileId === profileId ? { ...p, lastUsed: Date.now() } : p
    );
    AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)).catch(() => {});

    if (profile.token) setAuthToken(profile.token);
    setBaseApiUrl(profile.apiUrl);

    // Apply per-guardhouse isolated settings
    const settings = profile.settings || {};
    const showPhotoPreview = settings.showPhotoPreview !== undefined ? settings.showPhotoPreview : true;
    const visitorPassIssueMethod = settings.visitorPassIssueMethod || 'generated';
    const innerPrinterPayloadMode = settings.innerPrinterPayloadMode || 'short_token';
    const requireHouseForGate = settings.requireHouseForGate !== undefined ? settings.requireHouseForGate : false;
    const enableGateControl = settings.enableGateControl !== undefined ? settings.enableGateControl : true;
    const autoCheckIn = settings.autoCheckIn !== undefined ? settings.autoCheckIn : true;
    const debugMode = settings.debugMode !== undefined ? settings.debugMode : false;
    const isLite = settings.isLiteMode !== undefined ? settings.isLiteMode : true;

    set({
      guard: profile.guard,
      guardhouse: profile.guardhouse,
      apiUrl: profile.apiUrl,
      activeProfileId: profileId,
      isRegistered: true,
      profiles,
      showPhotoPreview,
      visitorPassIssueMethod,
      innerPrinterPayloadMode,
      requireHouseForGate,
      enableGateControl,
      autoCheckIn,
      debugMode,
      config: isLite ? defaultLiteConfig : defaultNormalConfig,
      loginAttempts: 0,
      activeTab: 'works',
    });
  },

  switchProfile: (profileId) => {
    // เปลี่ยน active profile แต่ไม่ login (ยังต้อง verify passcode)
    set({ activeProfileId: profileId, loginAttempts: 0 });
  },

  deleteProfile: async (profileId) => {
    const updated = get().profiles.filter(p => p.profileId !== profileId);
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    set({ profiles: updated });
  },

  resetRegistration: async () => {
    try {
      await AsyncStorage.removeItem(PROFILES_KEY);
      await AsyncStorage.removeItem('vms_device_guard');
      await AsyncStorage.removeItem('vms_device_guardhouse');
      await AsyncStorage.removeItem('vms_jwt_token');
    } catch {}
    setAuthToken(null);
    set({
      guard: null,
      guardhouse: null,
      isRegistered: false,
      profiles: [],
      activeProfileId: null,
      loginAttempts: 0,
      activeTab: 'works',
    });
  },

  incrementLoginAttempt: () => {
    const next = get().loginAttempts + 1;
    set({ loginAttempts: next });
    return next;
  },

  resetLoginAttempts: () => set({ loginAttempts: 0 }),

  setLiteMode: (isLite) => {
    const config = isLite ? defaultLiteConfig : defaultNormalConfig;
    set({ config });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), isLiteMode: isLite } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
  },

  setShowPhotoPreview: (showPreview) => {
    set({ showPhotoPreview: showPreview });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), showPhotoPreview: showPreview } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_show_photo_preview', String(showPreview)).catch(() => {});
  },

  setVisitorPassIssueMethod: (visitorPassIssueMethod) => {
    set({ visitorPassIssueMethod });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), visitorPassIssueMethod } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_visitor_pass_issue_method', visitorPassIssueMethod).catch(() => {});
  },

  setInnerPrinterPayloadMode: (innerPrinterPayloadMode) => {
    set({ innerPrinterPayloadMode });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), innerPrinterPayloadMode } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_inner_printer_pass_payload_mode', innerPrinterPayloadMode).catch(() => {});
  },

  setRequireHouseForGate: (requireHouseForGate) => {
    set({ requireHouseForGate });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), requireHouseForGate } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_require_house_for_gate', String(requireHouseForGate)).catch(() => {});
  },

  setEnableGateControl: (enableGateControl) => {
    set({ enableGateControl });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), enableGateControl } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_enable_gate_control', String(enableGateControl)).catch(() => {});
  },

  setAutoCheckIn: (autoCheckIn) => {
    set({ autoCheckIn });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), autoCheckIn } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_auto_checkin', String(autoCheckIn)).catch(() => {});
  },

  setDebugMode: (debugMode) => {
    set({ debugMode });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), debugMode } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_debug_mode', String(debugMode)).catch(() => {});
  },

  setBluetoothScannerMode: (bluetoothScannerMode) => {
    set({ bluetoothScannerMode });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), bluetoothScannerMode } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    AsyncStorage.setItem('vms_bluetooth_scanner_mode', bluetoothScannerMode).catch(() => {});
  },

  setBluetoothScannerDevice: (bluetoothScannerDevice) => {
    set({ bluetoothScannerDevice });
    const { activeProfileId, profiles } = get();
    if (activeProfileId) {
      const updated = profiles.map(p =>
        p.profileId === activeProfileId
          ? { ...p, settings: { ...(p.settings || {}), bluetoothScannerDevice } }
          : p
      );
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated)).catch(() => {});
      set({ profiles: updated });
    }
    if (bluetoothScannerDevice) {
      AsyncStorage.setItem('vms_bluetooth_scanner_device', JSON.stringify(bluetoothScannerDevice)).catch(() => {});
    } else {
      AsyncStorage.removeItem('vms_bluetooth_scanner_device').catch(() => {});
    }
  },

  updateGuardhouse: async (guardhouse) => {
    await AsyncStorage.setItem('vms_device_guardhouse', JSON.stringify(guardhouse));
    set({ guardhouse });
  },

  setPrinterConnected: (printerConnected) => set({ printerConnected }),

  setApiUrl: (url) => {
    setBaseApiUrl(url);
    set({ apiUrl: getBaseApiUrl() });
  },

  setActiveTab: (activeTab) => set({ activeTab }),
}));
