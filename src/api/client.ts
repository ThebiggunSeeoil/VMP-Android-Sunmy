import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SUNMI talks only to the same PWA bridge used by LIFF.  The bridge owns the
// backend URL and its service token, so no device needs direct access to CGS.
export const DEFAULT_BACKEND_URL = 'https://thai-vms.site';

let currentBaseUrl = DEFAULT_BACKEND_URL;
let authToken: string | null = null;

export const apiClient = axios.create({
  baseURL: `${currentBaseUrl}/connect_backend/`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const setBaseApiUrl = (url: string) => {
  let cleanUrl = url.trim().replace(/\/+$/, '');
  // Migrate existing installations that previously stored the direct API URL.
  if (!cleanUrl || cleanUrl.includes('myapi.thai-connects.site')) {
    cleanUrl = DEFAULT_BACKEND_URL;
  }
  cleanUrl = cleanUrl.replace(/\/connect_backend$/, '');
  currentBaseUrl = cleanUrl;
  apiClient.defaults.baseURL = `${cleanUrl}/connect_backend/`;
  AsyncStorage.setItem('vms_backend_url', cleanUrl).catch(() => {});
};

export const getBaseApiUrl = () => currentBaseUrl;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    AsyncStorage.setItem('vms_jwt_token', token).catch(() => {});
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    AsyncStorage.removeItem('vms_jwt_token').catch(() => {});
  }
};

export const getAuthToken = () => authToken;

// Convert normal API calls into the contract expected by the LIFF/PWA bridge:
// GET  /connect_backend/?url=/Remote/Path/?query=...
// POST /connect_backend/  { url: '/Remote/Path/', payload: {...} }
// This ensures thai-vms.site is the only system that connects to the backend.
apiClient.interceptors.request.use(async (config) => {
  const backendPath = config.url || '';
  const method = (config.method || 'get').toLowerCase();

  if (!backendPath.startsWith('http')) {
    config.url = `${currentBaseUrl.replace(/\/+$/, '')}/connect_backend/`;
    if (method === 'get') {
      config.params = { ...(config.params || {}), url: backendPath };
    } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
      config.data = { url: backendPath, payload: config.data || {} };
      config.headers['Content-Type'] = 'application/json';
    }
  }
  return config;
});

// Authentication and retry are handled by the PWA bridge's service account.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
