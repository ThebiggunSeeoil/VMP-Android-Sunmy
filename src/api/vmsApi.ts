import { apiClient, DEFAULT_BACKEND_URL, getBaseApiUrl, setAuthToken } from './client';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../state/useAppStore';

// ─── Cache Configuration ────────────────────────────────────────────────────
export interface CacheConfig {
  enabled: boolean;
  ttlMinutes: number; // 1–60 minutes
}

const DEFAULT_CACHE_CONFIG: CacheConfig = { enabled: true, ttlMinutes: 5 };
let _cacheConfig: CacheConfig = { ...DEFAULT_CACHE_CONFIG };

export interface CacheStatItem {
  serviceId: string;
  count?: number;
  hits: number;
  expiresIn: number;
}

export interface CheckoutStepLog {
  stepNum: number;
  name: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  detail?: string;
}

export interface CheckoutDebugSession {
  id: string;
  timestamp: string;
  rawCode: string;
  passId: string;
  totalDurationMs: number;
  status: boolean;
  message: string;
  steps: CheckoutStepLog[];
}

let _checkoutDebugLogs: CheckoutDebugSession[] = [];

export const checkoutDebugTracker = {
  getLogs: (): CheckoutDebugSession[] => _checkoutDebugLogs,
  addLog: (session: CheckoutDebugSession) => {
    _checkoutDebugLogs = [session, ..._checkoutDebugLogs.slice(0, 19)];
  },
  clearLogs: () => {
    _checkoutDebugLogs = [];
  },
};

export const cacheControl = {
  getConfig(): CacheConfig {
    return { ..._cacheConfig };
  },
  setConfig(config: Partial<CacheConfig>) {
    _cacheConfig = { ..._cacheConfig, ...config };
    AsyncStorage.setItem('vms_cache_config', JSON.stringify(_cacheConfig)).catch(() => {});
  },
  async loadFromStorage() {
    try {
      const saved = await AsyncStorage.getItem('vms_cache_config');
      if (saved) _cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...JSON.parse(saved) };
    } catch {}
  },
  clearAll() {
    vmsApi._entryReasonsCache = {};
    vmsApi._requiredFieldsCache = {};
    vmsApi._houseNumbersCache = {};
  },
  getStats(): { entryReasons: CacheStatItem[]; requiredFields: CacheStatItem[] } {
    const now = Date.now();
    const reasonEntries = Object.entries(vmsApi._entryReasonsCache);
    const fieldEntries = Object.entries(vmsApi._requiredFieldsCache);
    return {
      entryReasons: reasonEntries.map(([id, v]) => ({
        serviceId: id,
        count: v.data.length,
        hits: v.hits || 0,
        expiresIn: Math.max(0, Math.round((v.expiresAt - now) / 1000)), // seconds
      })),
      requiredFields: fieldEntries.map(([id, v]) => ({
        serviceId: id,
        hits: v.hits || 0,
        expiresIn: Math.max(0, Math.round((v.expiresAt - now) / 1000)),
      })),
    };
  },
};
// ────────────────────────────────────────────────────────────────────────────

type CheckInPayload = {
  userId: string;
  service_name_id: string;
  ServiceNameFiled_id: string;
  reason_entry_file_id: string;
  reason_entry?: string;
  number_house?: string;
  name?: string;
  id_number?: string;
  gender?: string;
  vehicle?: string;
  color_vehicle?: string;
  car_number?: string;
  picture_id_card?: string | null;
  picture_car_number?: string | null;
  visitor_qr_code?: string;
  visitor_qr_source?: 'generated_qr' | 'visitor_card';
  guardhouse_id?: string;
};

const appendLocalPhoto = (formData: FormData, key: string, path?: string | null) => {
  if (!path) return;
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  formData.append(key, {
    uri,
    type: 'image/jpeg',
    name: `${key}.jpg`,
  } as any);
};

export const vmsApi = {
  // 0. Extract UUID from any QR string, URL, or JSON
  extractUuid(input: string): string {
    const trimmed = input.trim();
    // Match standard UUID format: 8-4-4-4-12 hex chars
    const uuidMatch = trimmed.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    if (uuidMatch) {
      return uuidMatch[0];
    }
    return trimmed;
  },

  // 1. Authenticate & Obtain JWT Token from backend
  async authenticateBackend(baseUrl?: string) {
    // The PWA bridge authenticates to the backend itself.  Preserve the
    // function for registration callers, but never obtain backend credentials
    // on a SUNMI device.
    if (baseUrl && baseUrl !== getBaseApiUrl()) {
      console.warn('Ignoring direct backend URL; using the PWA proxy instead.');
    }
    setAuthToken(null);
    return null;
  },

  // 2. Register Device from SecurityGuards QR Code
  async registerDeviceWithSecurityGuardQR(qrPayload: string, customBaseUrl?: string) {
    const url = customBaseUrl || getBaseApiUrl();
    const token = await this.authenticateBackend(url);

    const guardUuid = this.extractUuid(qrPayload);

    // Query SecurityGuard details from backend
    const guardData = await this.getSecurityGuardDetail(guardUuid);

    if (!guardData || !guardData.id) {
      throw new Error('ไม่พบข้อมูล SecurityGuard ในระบบ');
    }

    // Extract village/project (guard_company or guard_companys)
    let villageName = 'หมู่บ้าน โรยัลวิว';
    let serviceId = '';
    let ownerName = 'บจก.รักษาความปลอดภัยแอลเอสซีเพิร์ส์';

    if (Array.isArray(guardData.guard_companys) && guardData.guard_companys.length > 0) {
      const firstCompany = guardData.guard_companys[0];
      villageName = firstCompany.service_name || firstCompany.name || villageName;
      serviceId = firstCompany.id || '';
      ownerName = firstCompany.SetOwner?.owner_name || ownerName;
    } else if (guardData.guard_company_detail) {
      villageName = guardData.guard_company_detail.service_name || villageName;
      serviceId = guardData.guard_company_detail.id || '';
    }

    // Extract company / user mapping
    if (guardData.guard_select_userprofile_detail) {
      const profile = guardData.guard_select_userprofile_detail;
      if (profile.mappingUserwithServiceName?.owner_name) {
        ownerName = profile.mappingUserwithServiceName.owner_name;
      }
    }

    // Extract position
    const positionName =
      guardData.guard_position_detail?.guard_position ||
      guardData.guard_position_detail?.name ||
      'อุปกรณ์ส่วนกลาง';

    const fullName = `${guardData.guard_name || 'เครื่องส่วนกลาง'} ${guardData.guard_surename || 'โรยัลวิว'}`.trim();
    const userId =
      guardData.userprofile?.guard_select_profile?.user_id ||
      guardData.guard_select_userprofile_detail?.user_id ||
      guardData.user_id ||
      undefined;

    // PWA resolves the active shift before a check-in, because the shift owns
    // the real guardhouse id and QR-generator configuration. Never synthesize
    // a guardhouse id: it cannot reserve or create a visitor QR correctly.
    const currentShift = userId ? await this.getCurrentShift(userId).catch(() => null) : null;
    const shiftGuardhouse = currentShift?.guardhouse_detail || currentShift?.guardhouse || null;
    const realGuardhouseId = shiftGuardhouse?.id || guardData.guardhouse_id || '';
    const shiftService =
      shiftGuardhouse?.ServiceName?.id ||
      shiftGuardhouse?.guardhouse_location?.id ||
      shiftGuardhouse?.guardhouse_service_name?.id ||
      '';

    return {
      token,
      guard: {
        id: guardData.id,
        userId,
        name: guardData.guard_name || 'เครื่องส่วนกลาง',
        surname: guardData.guard_surename || 'โรยัลวิว',
        fullName,
        companyName: ownerName,
        positionName,
        phone: guardData.guard_phone || '0922231492',
      },
      guardhouse: {
        id: realGuardhouseId,
        name: shiftGuardhouse?.guardhouse_name || `ป้อม ${villageName}`,
        serviceId: shiftService || serviceId || '',
        villageName: shiftGuardhouse?.ServiceName?.service_name || villageName,
        ownerName,
        autoDoorControl: true,
        autoDoorTimeSet: 5,
        enableQrCodeGenerator: shiftGuardhouse?.enable_qr_code_generator === true,
        qrCodeGeneratorMode: (shiftGuardhouse?.qr_code_generator_mode === 'create_new_qr_each_time'
          ? 'create_new_qr_each_time'
          : 'reserve_existing_cards') as 'reserve_existing_cards' | 'create_new_qr_each_time',
      },
    };
  },

  // Device information used for the registration and Settings diagnostics screens.
  // This deliberately returns the backend payload unchanged so it can be inspected
  // without exposing the JWT token used to make the request.
  async getSecurityGuardDetail(guardId: string) {
    const guardUuid = this.extractUuid(guardId);
    const res = await apiClient.get(`/SecurityControls/SecurityGuards/${guardUuid}/`);
    return res.data;
  },

  // Same active-shift endpoint the LIFF PWA uses. Its guardhouse_detail is
  // the authoritative branch configuration for QR Code Generator.
  async getCurrentShift(userId: string) {
    const res = await apiClient.get(
      `/SecurityControls/GuardCalender/get-current-shift-status-by-datetime/?user_id=${encodeURIComponent(userId)}`
    );
    return res.data?.shift || null;
  },

  // Fallback for devices registered before active-shift support existed. This
  // endpoint is also used by the PWA configuration screen and supplies real
  // guardhouse UUIDs (never the legacy `gh-...` device placeholder).
  async getGuardhousesByService(serviceId: string) {
    const proxyUrl = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/guardhouses-by-service/`;
    const res = await axios.get(proxyUrl, {
      params: { service_id: serviceId },
      headers: { Accept: 'application/json' },
      timeout: 15000,
    });
    const data = res.data?.data || res.data?.results || res.data;
    return Array.isArray(data) ? data : [];
  },

  async reserveGeneratedVisitorQr(guardhouseId: string, userId: string) {
    const res = await apiClient.post(
      '/SecurityControls/CheckinCheckOutTransaction/reserve-generated-qr/',
      { guardhouse_id: guardhouseId, userId }
    );
    return res.data;
  },

  // 3. Reasons & Required Fields
  // In-memory cache: { [serviceId]: { data, expiresAt, hits, cachedAt } }
  _entryReasonsCache: {} as Record<string, { data: any[]; expiresAt: number; hits: number; cachedAt: number }>,

  async getEntryReasons(serviceId: string, forceRefresh: boolean = false) {
    const CACHE_TTL_MS = _cacheConfig.ttlMinutes * 60 * 1000;
    const now = Date.now();
    const cached = this._entryReasonsCache[serviceId];
    if (!forceRefresh && _cacheConfig.enabled && cached && now < cached.expiresAt) {
      cached.hits = (cached.hits || 0) + 1;
      return cached.data;
    }
    try {
      const res = await apiClient.get(
        `/SecurityControls/ReasonEntryExits/filter-by-service_name/?service_name=${serviceId}`
      );
      if (!Array.isArray(res.data)) return [];
      // Sort by running_orderby ascending; treat 0 as Infinity so it sinks to the bottom
      const sorted = [...res.data].sort((a, b) => {
        const oa = a.running_orderby === 0 ? Infinity : (a.running_orderby ?? Infinity);
        const ob = b.running_orderby === 0 ? Infinity : (b.running_orderby ?? Infinity);
        return oa - ob;
      });
      // Store in cache only if cache is enabled
      if (_cacheConfig.enabled) {
        this._entryReasonsCache[serviceId] = {
          data: sorted,
          expiresAt: now + CACHE_TTL_MS,
          hits: 0,
          cachedAt: now,
        };
      }
      return sorted;
    } catch (e) {
      return [];
    }
  },

  _requiredFieldsCache: {} as Record<string, { data: any; expiresAt: number; hits: number; cachedAt: number }>,

  async getRequiredFields(serviceId: string, forceRefresh: boolean = false) {
    const CACHE_TTL_MS = _cacheConfig.ttlMinutes * 60 * 1000;
    const now = Date.now();
    const cached = this._requiredFieldsCache[serviceId];
    if (!forceRefresh && _cacheConfig.enabled && cached && now < cached.expiresAt) {
      cached.hits = (cached.hits || 0) + 1;
      return cached.data;
    }
    try {
      const res = await apiClient.get(
        `/SecurityControls/FiledRequire/filter-by-service_name/?service_name=${serviceId}`
      );
      const data = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : {};
      if (_cacheConfig.enabled) {
        this._requiredFieldsCache[serviceId] = {
          data,
          expiresAt: now + CACHE_TTL_MS,
          hits: 0,
          cachedAt: now,
        };
      }
      return data;
    } catch (e) {
      return {};
    }
  },

  _houseNumbersCache: {} as Record<string, { data: string[]; expiresAt: number; hits: number; cachedAt: number }>,

  hasCachedCheckInData(serviceId: string): boolean {
    if (!_cacheConfig.enabled) return false;
    const now = Date.now();
    const r = this._entryReasonsCache[serviceId];
    const f = this._requiredFieldsCache[serviceId];
    return !!(r && now < r.expiresAt && f && now < f.expiresAt);
  },

  // House-number directory used by the LIFF PWA and the Sunmi check-in flow.
  async getHouseNumbers(serviceId: string, forceRefresh: boolean = false) {
    const CACHE_TTL_MS = _cacheConfig.ttlMinutes * 60 * 1000;
    const now = Date.now();
    const cached = this._houseNumbersCache[serviceId];
    if (!forceRefresh && _cacheConfig.enabled && cached && now < cached.expiresAt) {
      cached.hits = (cached.hits || 0) + 1;
      return cached.data;
    }
    try {
      const res = await apiClient.get(
        `/ManageBackend/HouseNumberList/get-by-service-name/?service_name_id=${serviceId}`
      );
      const data = Array.isArray(res.data) ? res.data : res.data?.results || res.data?.data || [];
      const houses = Array.isArray(data)
        ? data.filter((house) => house?.active !== false && house?.house_number).map((house) => house.house_number)
        : [];
      if (_cacheConfig.enabled) {
        this._houseNumbersCache[serviceId] = {
          data: houses,
          expiresAt: now + CACHE_TTL_MS,
          hits: 0,
          cachedAt: now,
        };
      }
      return houses;
    } catch (e) {
      console.warn('Unable to fetch house numbers:', e);
      return [];
    }
  },


  // 4. Check-In & Check-Out
  async submitCheckIn(payload: CheckInPayload) {
    // Same original PWA route: thai-vms.site receives the FormData and is the
    // sole service that forwards it to the backend with its managed token.
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'picture_id_card' || key === 'picture_car_number' || value === undefined || value === null) {
        return;
      }
      formData.append(key, String(value));
    });
    appendLocalPhoto(formData, 'picture_id_card', payload.picture_id_card);
    appendLocalPhoto(formData, 'picture_car_number', payload.picture_car_number);
    formData.append('url', '/SecurityControls/CheckinCheckOutTransaction/');

    const proxyUrl = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/uploadVisitor/`;
    // Do not set Content-Type manually: React Native/Axios supplies the
    // multipart boundary, the same way browser FormData does in the LIFF app.
    const res = await axios.post(proxyUrl, formData, {
      headers: { Accept: 'application/json' },
      timeout: 60000,
    });
    return res.data;
  },

  async createGeneratedPass(payload: CheckInPayload) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'picture_id_card' || key === 'picture_car_number' || value === undefined || value === null) return;
      formData.append(key, String(value));
    });
    appendLocalPhoto(formData, 'picture_id_card', payload.picture_id_card);
    appendLocalPhoto(formData, 'picture_car_number', payload.picture_car_number);
    formData.append('url', '/SecurityControls/CheckinCheckOutTransaction/create-generated-pass/');
    const proxyUrl = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/uploadVisitor/`;
    const res = await axios.post(proxyUrl, formData, { headers: { Accept: 'application/json' }, timeout: 60000 });
    return res.data;
  },

  async getVisitorQRCodeDetail(cardId: string) {
    const cleanCard = cardId.replace(/[^a-zA-Z0-9-]/g, '');
    const res = await apiClient.get(`/SecurityControls/CheckinCheckOutTransaction/?search=${cleanCard}`);
    if (Array.isArray(res.data?.results) && res.data.results.length > 0) {
      return res.data.results[0];
    }
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0];
    }
    return null;
  },

  async submitCheckOut(transactionId: string, payload: any) {
    const url = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/`;
    const res = await axios.patch(
      url,
      {
        url: `/SecurityControls/CheckinCheckOutTransaction/${transactionId}/`,
        payload,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-User-ID': payload.guard_out || 'VisitorBox-03',
        },
        timeout: 10000,
      }
    );
    return res.data;
  },

  extractPassIdFromQR(rawCode: string): string {
    let text = (rawCode || '').trim();
    if (text.startsWith('*+') && text.endsWith('+*')) {
      text = text.substring(2, text.length - 2).trim();
    }
    if (text.includes('pass_exchange?id=')) {
      text = text.split('pass_exchange?id=')[1].split('&')[0];
    } else if (text.includes('id=')) {
      text = text.split('id=')[1].split('&')[0];
    } else if (text.includes('pk=')) {
      text = text.split('pk=')[1].split('&')[0];
    }
    if (text.startsWith('V:') || text.startsWith('v:')) {
      text = text.split(':')[1];
    }
    return text.replace(/[^a-zA-Z0-9-]/g, '').trim();
  },

  async resolveActiveGuardUserId(guardId?: string, fallbackUserId?: string): Promise<string> {
    const isUUID = (str?: string) => Boolean(str && /^[0-9a-fA-F-]{36}$/.test(str));

    if (fallbackUserId && !isUUID(fallbackUserId) && !fallbackUserId.startsWith('guard-')) {
      return fallbackUserId;
    }

    // 1. Check in-memory store guard (instant 0ms)
    try {
      const storeGuard = useAppStore.getState().guard;
      if (storeGuard?.userId && !isUUID(storeGuard.userId) && !storeGuard.userId.startsWith('guard-')) {
        return storeGuard.userId;
      }
    } catch {}

    // 2. Check stored profiles in AsyncStorage
    try {
      const savedProfiles = await AsyncStorage.getItem('vms_guardhouse_profiles');
      if (savedProfiles) {
        const parsed = JSON.parse(savedProfiles);
        const activeProfile = Array.isArray(parsed) ? parsed[0] : null;
        const uid = activeProfile?.guard?.userId;
        if (uid && !isUUID(uid) && !uid.startsWith('guard-')) {
          return uid;
        }
      }
    } catch {}

    return 'VisitorBox-03';
  },

  async updatePassCheckInStatus(passId: string, userId?: string) {
    if (!passId) return { status: false, message: 'ไม่พบ passId สำหรับลงเวลาเข้า' };
    const cleanPassId = this.extractPassIdFromQR(passId);
    const activeUserId = await this.resolveActiveGuardUserId(undefined, userId);
    try {
      const url = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/`;
      const res = await axios.post(
        url,
        {
          url: `/SecurityControls/CheckinCheckOutTransaction/${cleanPassId}/UpdateQRCodeCreateTransactions/`,
          payload: {
            userId: activeUserId,
            CheckInOutStatus: 'CheckIn',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-User-ID': activeUserId,
          },
          timeout: 10000,
        }
      );
      const data = res.data;
      if (data?.status === false || data?.error) {
        return {
          status: false,
          message: data?.message || data?.error || data?.detail || 'เกิดข้อผิดพลาดจาก Backend',
        };
      }
      return data;
    } catch (e: any) {
      console.warn('UpdateQRCodeCreateTransactions error:', e);
      const respData = e?.response?.data;
      const errorMsg =
        respData?.message ||
        respData?.error ||
        respData?.detail ||
        (typeof respData === 'string' ? respData : '') ||
        e?.message ||
        'ไม่สามารถเชื่อมต่อระบบลงเวลาเข้าได้';
      return {
        status: false,
        message: errorMsg,
      };
    }
  },

  async updatePassCheckOutStatus(passId: string, userId?: string) {
    if (!passId) return { status: false, message: 'ไม่พบรหัสบัตรผ่านสำหรับบันทึกออก' };
    const cleanPassId = this.extractPassIdFromQR(passId);
    const activeUserId = await this.resolveActiveGuardUserId(undefined, userId);
    try {
      const url = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/`;
      const res = await axios.post(
        url,
        {
          url: `/SecurityControls/CheckinCheckOutTransaction/${cleanPassId}/UpdateQRCodeCreateTransactions/`,
          payload: {
            userId: activeUserId,
            CheckInOutStatus: 'CheckOut',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-User-ID': activeUserId,
          },
          timeout: 10000,
        }
      );
      const data = res.data;
      if (data?.status === false || data?.error) {
        return {
          status: false,
          message: data?.message || data?.error || data?.detail || '❌ ไม่สามารถทำ Check-out ได้ หรือทำไปแล้ว',
        };
      }
      if (data?.status === true || data?.check_type === 'CheckOut' || data?.transaction_id) {
        return {
          status: true,
          message: data?.message || '✅ ทำรายการ Check-out สำเร็จ',
          data,
        };
      }
      return {
        status: true,
        message: data?.message || '✅ ทำรายการ Check-out สำเร็จ',
        data,
      };
    } catch (e: any) {
      console.warn('updatePassCheckOutStatus error:', e);
      const respData = e?.response?.data;
      const errorMsg =
        respData?.message ||
        respData?.error ||
        respData?.detail ||
        (typeof respData === 'string' ? respData : '') ||
        e?.message ||
        '❌ ไม่สามารถทำ Check-out ได้ หรือทำรายการไปแล้ว';
      return {
        status: false,
        message: errorMsg,
      };
    }
  },

  async processCheckoutQRCode(
    rawCode: string,
    userId?: string,
    guardhouseId?: string,
    isDebug: boolean = false
  ): Promise<{ status: boolean; message: string; data?: any; debugSession?: CheckoutDebugSession }> {
    const t0 = Date.now();
    const steps: CheckoutStepLog[] = [];
    const cleanCode = (rawCode || '').trim();

    if (!cleanCode) {
      const durationMs = Date.now() - t0;
      steps.push({
        stepNum: 1,
        name: 'ตรวจสอบรหัสสแกน',
        durationMs,
        status: 'FAILED',
        detail: 'รหัสเป็นค่าว่าง',
      });
      return { status: false, message: 'กรุณาสแกน QR Code หรือ Barcode' };
    }

    // Step 1: ถอดรหัส Pass ID
    const tStep1Start = Date.now();
    const cleanPassId = this.extractPassIdFromQR(cleanCode);
    const tStep1End = Date.now();
    steps.push({
      stepNum: 1,
      name: 'ถอดรหัส Pass ID',
      durationMs: tStep1End - tStep1Start,
      status: cleanPassId ? 'SUCCESS' : 'FAILED',
      detail: `Pass ID: ${cleanPassId || 'ไม่พบ'}`,
    });

    // Step 2: ค้นหา User ID ของ รปภ.
    const tStep2Start = Date.now();
    const activeUserId = await this.resolveActiveGuardUserId(undefined, userId);
    const tStep2End = Date.now();
    steps.push({
      stepNum: 2,
      name: 'ค้นหา Guard User ID',
      durationMs: tStep2End - tStep2Start,
      status: 'SUCCESS',
      detail: `User ID: ${activeUserId}`,
    });

    let finalStatus = false;
    let finalMessage = '';
    let finalData: any = null;

    // Step 3: ส่งคำขอหลัก UpdateQRCodeCreateTransactions
    const tStep3Start = Date.now();
    const res1 = await this.updatePassCheckOutStatus(cleanPassId, activeUserId);
    const tStep3End = Date.now();
    steps.push({
      stepNum: 3,
      name: 'Endpoint 1: UpdateQRCodeTransactions',
      durationMs: tStep3End - tStep3Start,
      status: res1.status ? 'SUCCESS' : 'FAILED',
      detail: res1.message,
    });

    if (res1.status) {
      finalStatus = true;
      finalMessage = res1.message;
      finalData = res1.data;
    } else {
      // Step 4: Fallback 2 (visitor-pass-token-scan)
      const tStep4Start = Date.now();
      let res2Success = false;
      let res2Msg = '';
      try {
        const url = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/`;
        const res2 = await axios.post(
          url,
          {
            url: `/SecurityControls/CheckinCheckOutTransaction/visitor-pass-token-scan/`,
            payload: {
              token: cleanPassId,
              actionType: 'CheckOut',
              userId: activeUserId,
              guardhouse_id: guardhouseId,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-User-ID': activeUserId,
            },
            timeout: 10000,
          }
        );
        if (res2.data?.status === true || (res2.data && !res2.data.error && !res2.data.detail)) {
          res2Success = true;
          res2Msg = res2.data?.message || '✅ บันทึกออกสำเร็จ';
          finalStatus = true;
          finalMessage = res2Msg;
          finalData = res2.data;
        } else {
          res2Msg = res2.data?.message || res2.data?.error || 'ล้มเหลว';
        }
      } catch (e2: any) {
        res2Msg = e2?.response?.data?.message || e2?.message || 'เชื่อมต่อล้มเหลว';
      }
      const tStep4End = Date.now();
      steps.push({
        stepNum: 4,
        name: 'Endpoint 2: visitor-pass-token-scan',
        durationMs: tStep4End - tStep4Start,
        status: res2Success ? 'SUCCESS' : 'FAILED',
        detail: res2Msg,
      });

      if (!finalStatus) {
        // Step 5: Fallback 3 (CheckinCheckOutTransaction Detail Patch)
        const tStep5Start = Date.now();
        let res3Success = false;
        let res3Msg = '';
        try {
          const foundTx = await this.getVisitorQRCodeDetail(cleanPassId);
          if (foundTx?.id) {
            const patchUrl = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/`;
            const patchRes = await axios.patch(
              patchUrl,
              {
                url: `/SecurityControls/CheckinCheckOutTransaction/${foundTx.id}/`,
                payload: {
                  record_status_inout: 'out',
                  visitor_status: 'completed',
                  checkout_datetime: new Date().toISOString(),
                  guardhouse_out: guardhouseId,
                  guard_out: activeUserId,
                },
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  'X-User-ID': activeUserId,
                },
                timeout: 10000,
              }
            );
            if (patchRes.status === 200 || patchRes.status === 201) {
              res3Success = true;
              res3Msg = '✅ บันทึกออกสำเร็จ (Direct Patch)';
              finalStatus = true;
              finalMessage = res3Msg;
              finalData = patchRes.data;
            }
          }
        } catch (err3: any) {
          res3Msg = err3?.message || 'เชื่อมต่อล้มเหลว';
        }
        const tStep5End = Date.now();
        steps.push({
          stepNum: 5,
          name: 'Endpoint 3: Direct Transaction Patch',
          durationMs: tStep5End - tStep5Start,
          status: res3Success ? 'SUCCESS' : 'FAILED',
          detail: res3Msg || 'ไม่พบ Transaction ID',
        });
      }

      if (!finalStatus) {
        finalMessage = res1.message || '❌ ไม่สามารถทำ Check-out ได้ หรือทำรายการไปแล้ว';
      }
    }

    const totalDurationMs = Date.now() - t0;
    const session: CheckoutDebugSession = {
      id: `chk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      rawCode: cleanCode,
      passId: cleanPassId,
      totalDurationMs,
      status: finalStatus,
      message: finalMessage,
      steps,
    };

    checkoutDebugTracker.addLog(session);

    if (isDebug) {
      console.log('================ [VMS DEBUG CHECKOUT] ================');
      console.log(`📌 Raw Code: ${cleanCode}`);
      console.log(`🔑 Pass ID:  ${cleanPassId}`);
      console.log(`👮 Guard ID: ${activeUserId}`);
      console.log(`⏱️ Total Time: ${totalDurationMs} ms | Status: ${finalStatus ? 'SUCCESS' : 'FAILED'}`);
      console.log('--- Step Breakdown ---');
      steps.forEach((s) => {
        console.log(`  [${s.stepNum}] ${s.name}: ${s.durationMs}ms [${s.status}] (${s.detail || '-'})`);
      });
      console.log('======================================================');
    }

    return {
      status: finalStatus,
      message: finalMessage,
      data: finalData,
      debugSession: session,
    };
  },

  // 4.1 History Transactions
  async getHistoryTransactions(params: {
    service_name: string;
    start_date?: string;
    end_date?: string;
    name?: string;
    id_number?: string;
    vehicle?: string;
    color_vehicle?: string;
    reason_entry_file?: string;
    house_id?: string;
    number_house?: string;
  }): Promise<{
    status: boolean;
    data: any[];
    message?: string;
    fetchMs?: number;
    source?: string;
  }> {
    const fetchStart = Date.now();
    const queryObj: Record<string, string> = {
      service_name: params.service_name,
    };
    if (params.start_date) queryObj.start_date = params.start_date;
    if (params.end_date) queryObj.end_date = params.end_date;
    if (params.name) queryObj.name = params.name;
    if (params.id_number) queryObj.id_number = params.id_number;
    if (params.vehicle) queryObj.vehicle = params.vehicle;
    if (params.color_vehicle) queryObj.color_vehicle = params.color_vehicle;
    if (params.reason_entry_file) queryObj.reason_entry_file = params.reason_entry_file;
    if (params.house_id) queryObj.house_id = params.house_id;
    if (params.number_house) queryObj.number_house = params.number_house;

    const baseQuery = Object.entries(queryObj)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const slimQuery = `${baseQuery}&flat=true&list_only=true`;
    const slimUrl = `/SecurityControls/CheckinCheckOutTransaction/filter-by-request-slim/?${slimQuery}`;

    try {
      const res = await apiClient.get(slimUrl);
      const fetchMs = Date.now() - fetchStart;
      let rawData: any[] = [];
      if (Array.isArray(res.data)) {
        rawData = res.data;
      } else if (Array.isArray(res.data?.data)) {
        rawData = res.data.data;
      } else if (Array.isArray(res.data?.results)) {
        rawData = res.data.results;
      }

      if (rawData.length > 0) {
        return {
          status: true,
          data: rawData.map((item) => ({ ...item, _history_list_only: true })),
          message: 'OK',
          fetchMs,
          source: 'slim',
        };
      }
    } catch (slimErr) {
      console.warn('History slim fetch failed, falling back to legacy filter-by-request:', slimErr);
    }

    try {
      const legacyUrl = `/SecurityControls/CheckinCheckOutTransaction/filter-by-request/?${baseQuery}`;
      const res = await apiClient.get(legacyUrl);
      const fetchMs = Date.now() - fetchStart;
      let rawData: any[] = [];
      if (Array.isArray(res.data)) {
        rawData = res.data;
      } else if (Array.isArray(res.data?.data)) {
        rawData = res.data.data;
      } else if (Array.isArray(res.data?.results)) {
        rawData = res.data.results;
      }

      return {
        status: true,
        data: rawData,
        message: 'OK',
        fetchMs,
        source: 'fallback',
      };
    } catch (legacyErr: any) {
      const fetchMs = Date.now() - fetchStart;
      return {
        status: false,
        data: [],
        message: legacyErr?.message || 'ไม่สามารถโหลดประวัติการเข้า-ออกได้',
        fetchMs,
        source: 'error',
      };
    }
  },

  async getHistoryTransactionDetail(transactionId: string): Promise<any | null> {
    try {
      const res = await apiClient.get(`/SecurityControls/CheckinCheckOutTransaction/${transactionId}/`);
      return res.data?.data || res.data || null;
    } catch (err) {
      console.warn('Fetch history detail failed:', err);
      return null;
    }
  },

  // 5. Barrier Gate Control
  async sendGateCommand(
    command: 'door_open_in' | 'door_open_out',
    guardhouseId?: string,
    serviceId?: string,
    userId?: string,
    options?: {
      houseNo?: string;
      triggerSource?: string;
      guardName?: string;
      guardhouseName?: string;
      serviceName?: string;
    }
  ) {
    const isUuid = (val?: string) =>
      Boolean(val && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val));

    let targetGuardhouseId = guardhouseId || '';

    if (!isUuid(targetGuardhouseId)) {
      if (serviceId) {
        try {
          const list = await this.getGuardhousesByService(serviceId).catch(() => []);
          const matched = list.find((gh: any) => gh?.id === targetGuardhouseId) || list[0];
          if (matched?.id && isUuid(matched.id)) {
            targetGuardhouseId = matched.id;
          } else if (isUuid(serviceId)) {
            targetGuardhouseId = serviceId;
          }
        } catch {
          if (isUuid(serviceId)) {
            targetGuardhouseId = serviceId;
          }
        }
      }
      
      if (!isUuid(targetGuardhouseId) && userId) {
        try {
          const shift = await this.getCurrentShift(userId).catch(() => null);
          const shiftGh = shift?.guardhouse_detail || shift?.guardhouse;
          if (shiftGh?.id && isUuid(shiftGh.id)) {
            targetGuardhouseId = shiftGh.id;
          }
        } catch {}
      }
    }

    if (!isUuid(targetGuardhouseId)) {
      return {
        status: false,
        message: 'ไม่พบรหัสป้อมที่เป็น UUID สำหรับส่งคำสั่งไม้กั้น',
      };
    }

    const activeUserId = await this.resolveActiveGuardUserId(undefined, userId);
    const payload = {
      Guardhouses: targetGuardhouseId,
      guardhouse_id: targetGuardhouseId,
      command,
      house_no: options?.houseNo || '',
      trigger_source: options?.triggerSource || (options?.houseNo ? 'manual_keypad' : 'manual_direct'),
      guard_user_id: activeUserId,
      guard_name: options?.guardName || '',
      guardhouse_name: options?.guardhouseName || '',
      service_name: options?.serviceName || '',
      service_name_id: serviceId || '',
    };

    // Send door command to backend via connect_backend proxy
    try {
      const url = `${(getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '')}/connect_backend/`;
      const res = await axios.post(
        url,
        {
          url: '/SecurityControls/DoorControl/send-door-command/',
          payload,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-User-ID': activeUserId,
          },
          timeout: 10000,
        }
      );

      const data = res.data;
      const isOk =
        data?.status === true ||
        data?.success === true ||
        data?.message === 'Command sent successfully' ||
        data?.result?.success === true;

      let cleanMsg = data?.message || (isOk ? 'ส่งสัญญาณเปิดไม้กั้นเรียบร้อย' : 'ส่งคำสั่งเปิดไม้กั้นไม่สำเร็จ');
      if (typeof cleanMsg === 'string' && (cleanMsg.includes('<html') || cleanMsg.includes('<!doctype'))) {
        cleanMsg = isOk ? 'ส่งสัญญาณเปิดไม้กั้นเรียบร้อย' : 'ไม่สามารถเชื่อมต่อระบบไม้กั้นได้';
      }

      return {
        status: isOk,
        success: isOk,
        message: cleanMsg,
        data: data?.data || data,
      };
    } catch (e: any) {
      console.warn('sendGateCommand error:', e);
      let errMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'ส่งคำสั่งเปิดไม้กั้นไม่สำเร็จ';

      if (typeof errMsg === 'string' && (errMsg.includes('<html') || errMsg.includes('<!doctype'))) {
        errMsg = 'ไม่สามารถติดต่อระบบไม้กั้นได้';
      }

      return {
        status: false,
        success: false,
        message: errMsg,
      };
    }
  },

  getGarbageItems: async (houseNumber?: string, qrCode?: string): Promise<{ status: boolean; message?: string; data: any[] }> => {
    try {
      const baseUrl = (getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
      const cleanHouse = houseNumber ? encodeURIComponent(houseNumber.trim()) : '';
      const cleanQr = qrCode ? encodeURIComponent(qrCode.trim()) : '';
      const targetQuery = `/liff/SecuritySection/?request_check=request_bag_by_housenumber&house_number=${cleanHouse}&row_id=${cleanQr}`;
      
      const url = `${baseUrl}/connect_backend/rovelview/?url=${encodeURIComponent(targetQuery)}`;
      const res = await axios.get(url, {
        headers: { Accept: 'application/json' },
        timeout: 15000,
      });

      const data = res.data;
      if (Array.isArray(data)) {
        return {
          status: true,
          data: data,
        };
      }
      if (data && Array.isArray(data.data)) {
        return {
          status: true,
          data: data.data,
        };
      }
      return {
        status: false,
        message: data?.message || data?.error || 'ไม่พบรายการถุงขยะ/คีย์การ์ดสำหรับบ้านเลขที่นี้',
        data: [],
      };
    } catch (e: any) {
      console.warn('getGarbageItems error:', e);
      return {
        status: false,
        message: e?.response?.data?.message || e?.message || 'ไม่สามารถโหลดข้อมูลถุงขยะ/คีย์การ์ดได้',
        data: [],
      };
    }
  },

  getGarbageItemDetail: async (bagId: number | string): Promise<any | null> => {
    try {
      const baseUrl = (getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
      const targetQuery = `/liff/SecuritySection/?request_check=request_bag_detail&&bag_id=${bagId}`;
      const url = `${baseUrl}/connect_backend/rovelview/?url=${encodeURIComponent(targetQuery)}`;
      const res = await axios.get(url, {
        headers: { Accept: 'application/json' },
        timeout: 15000,
      });
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return null;
    } catch (e: any) {
      console.warn('getGarbageItemDetail error:', e);
      return null;
    }
  },

  deliverGarbageItem: async (
    bagId: number | string,
    photoUri: string,
    profile?: any,
    activeUserId?: string
  ): Promise<{ status: boolean; message?: string; detail?: string; row_id?: number | string }> => {
    try {
      const baseUrl = (getBaseApiUrl() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
      const url = `${baseUrl}/connect_backend/uploadBag/`;
      const formData = new FormData();
      formData.append('bag_id', String(bagId));

      const cleanUri = photoUri.startsWith('file://') ? photoUri : `file://${photoUri}`;
      formData.append('photo', {
        uri: cleanUri,
        type: 'image/jpeg',
        name: `bag_delivery_${bagId}_${Date.now()}.jpg`,
      } as any);

      if (profile) {
        formData.append('profile', typeof profile === 'string' ? profile : JSON.stringify(profile));
      }

      const res = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
          'X-User-ID': activeUserId || 'VisitorBox-03',
        },
        timeout: 30000,
      });

      const data = res.data;
      const isSuccess = data?.status === true || data?.success === true;
      return {
        status: isSuccess,
        row_id: bagId,
        message: data?.message || (isSuccess ? 'ส่งมอบสำเร็จ' : 'ไม่สามารถบันทึกการจ่ายได้'),
        detail: data?.message || data?.detail || '',
      };
    } catch (e: any) {
      console.warn('deliverGarbageItem error:', e);
      return {
        status: false,
        row_id: bagId,
        message: e?.response?.data?.message || e?.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล',
        detail: e?.message || '',
      };
    }
  },
};
