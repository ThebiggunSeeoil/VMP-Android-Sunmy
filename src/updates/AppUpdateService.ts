import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { DEFAULT_UPDATE_METADATA_URL } from '../config/update';

const { AppUpdater } = NativeModules;
const STORAGE_KEY = 'vmp_update_metadata_url';

export type InstalledVersion = {
  versionCode: number;
  versionName: string;
  applicationId: string;
};

export type RemoteUpdateInfo = {
  versionCode?: number;
  versionName: string;
  apkUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
  fileName?: string;
};

export type UpdateCheckResult = {
  installed: InstalledVersion;
  remote: RemoteUpdateInfo | null;
  hasUpdate: boolean;
  metadataUrl: string;
  message: string;
};

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubReleasePayload = {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
};

function cleanVersionName(value: string | undefined): string {
  return (value || '').trim().replace(/^v/i, '');
}

function compareVersionNames(remoteVersion: string, installedVersion: string): number {
  const remoteParts = cleanVersionName(remoteVersion).split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  const installedParts = cleanVersionName(installedVersion).split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  const maxLength = Math.max(remoteParts.length, installedParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const remotePart = remoteParts[i] || 0;
    const installedPart = installedParts[i] || 0;
    if (remotePart > installedPart) return 1;
    if (remotePart < installedPart) return -1;
  }

  return 0;
}

function normalizeRemotePayload(payload: any): RemoteUpdateInfo {
  const githubPayload = payload as GitHubReleasePayload;
  const apkAsset = Array.isArray(githubPayload.assets)
    ? githubPayload.assets.find((asset) => {
        const name = asset.name || '';
        return name.toLowerCase().endsWith('.apk') && !!asset.browser_download_url;
      })
    : null;

  if (apkAsset?.browser_download_url) {
    return {
      versionName: cleanVersionName(githubPayload.tag_name || githubPayload.name),
      apkUrl: apkAsset.browser_download_url,
      releaseNotes: githubPayload.body || '',
      publishedAt: githubPayload.published_at,
      fileName: apkAsset.name || undefined,
    };
  }

  return {
    versionCode: typeof payload.versionCode === 'number' ? payload.versionCode : undefined,
    versionName: cleanVersionName(payload.versionName || payload.tagName || payload.tag_name),
    apkUrl: payload.apkUrl || payload.apk_url || payload.downloadUrl || payload.download_url,
    releaseNotes: payload.releaseNotes || payload.release_notes || payload.body || '',
    publishedAt: payload.publishedAt || payload.published_at,
    fileName: payload.fileName || payload.file_name,
  };
}

function isRemoteNewer(remote: RemoteUpdateInfo, installed: InstalledVersion): boolean {
  if (typeof remote.versionCode === 'number') {
    return remote.versionCode > installed.versionCode;
  }
  return compareVersionNames(remote.versionName, installed.versionName) > 0;
}

export const AppUpdateService = {
  async getMetadataUrl(): Promise<string> {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEY);
    return savedUrl?.trim() || DEFAULT_UPDATE_METADATA_URL;
  },

  async setMetadataUrl(url: string): Promise<string> {
    const normalizedUrl = url.trim() || DEFAULT_UPDATE_METADATA_URL;
    await AsyncStorage.setItem(STORAGE_KEY, normalizedUrl);
    return normalizedUrl;
  },

  async getInstalledVersion(): Promise<InstalledVersion> {
    if (Platform.OS !== 'android' || !AppUpdater) {
      return {
        versionCode: 0,
        versionName: '0.0.0',
        applicationId: 'unknown',
      };
    }
    return AppUpdater.getInstalledVersion();
  },

  async checkForUpdate(metadataUrl?: string): Promise<UpdateCheckResult> {
    const url = (metadataUrl || (await this.getMetadataUrl())).trim();
    const installed = await this.getInstalledVersion();
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json, application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`เช็กอัปเดตไม่สำเร็จ (${response.status})`);
    }

    const payload = await response.json();
    const remote = normalizeRemotePayload(payload);

    if (!remote.versionName || !remote.apkUrl) {
      throw new Error('ข้อมูล update ไม่ครบ ต้องมี versionName และไฟล์ APK');
    }

    const hasUpdate = isRemoteNewer(remote, installed);
    return {
      installed,
      remote,
      hasUpdate,
      metadataUrl: url,
      message: hasUpdate
        ? `พบเวอร์ชันใหม่ ${remote.versionName}`
        : `ใช้เวอร์ชันล่าสุดแล้ว (${installed.versionName})`,
    };
  },

  async canInstallUnknownApps(): Promise<boolean> {
    if (Platform.OS !== 'android' || !AppUpdater) return false;
    return AppUpdater.canInstallUnknownApps();
  },

  async openUnknownAppsSettings(): Promise<boolean> {
    if (Platform.OS !== 'android' || !AppUpdater) return false;
    return AppUpdater.openUnknownAppsSettings();
  },

  async downloadAndInstall(remote: RemoteUpdateInfo): Promise<{ filePath: string; message: string }> {
    if (Platform.OS !== 'android' || !AppUpdater) {
      throw new Error('รองรับการติดตั้ง APK เฉพาะ Android เท่านั้น');
    }

    const fallbackName = `vmp-${remote.versionName || 'update'}.apk`;
    return AppUpdater.downloadAndInstallApk(remote.apkUrl, remote.fileName || fallbackName);
  },
};
