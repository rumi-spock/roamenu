import * as AsyncStorageModule from '@react-native-async-storage/async-storage';
import { File as ExpoFile } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import type { MenuPreference, MenuScanResult, SharedMenu } from './menu-domain';

const authTokenKey = 'roamenu-mobile-auth-token';
type StorageApi = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
const AsyncStorage = AsyncStorageModule.default as unknown as StorageApi;

export type UserProfile = {
  userId: string;
  displayName: string;
  foodPreferences: MenuPreference[];
};

function normaliseBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export class MenuApi {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = normaliseBaseUrl(baseUrl);
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  async mockLogin(displayName: string): Promise<{ token?: string; profile?: UserProfile; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mobile-auth/mock`, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const data = await response.json() as { token?: string; profile?: UserProfile; error?: string };
      return response.ok ? data : { error: data.error ?? 'Unable to start mock login.' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  async passwordLogin(email: string, password: string): Promise<{ token?: string; profile?: UserProfile | null; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mobile-auth/password/login`, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json() as { accessToken?: string; profile?: UserProfile | null; error?: string };
      return response.ok && data.accessToken ? { token: data.accessToken, profile: data.profile } : { error: data.error ?? 'Unable to sign in.' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  async passwordRegister(email: string, password: string, displayName: string): Promise<{ token?: string; profile?: UserProfile; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mobile-auth/password/register`, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await response.json() as { accessToken?: string; profile?: UserProfile; error?: string };
      return response.ok && data.accessToken ? { token: data.accessToken, profile: data.profile } : { error: data.error ?? 'Unable to create your account.' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'X-Client': 'mobile',
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    };
  }

  async scanMenu(imageUri: string, language: string): Promise<MenuScanResult> {
    try {
      const formData = new FormData();
      formData.append('menu', new ExpoFile(imageUri));
      formData.append('language', language);
      const response = await expoFetch(`${this.baseUrl}/api/menu-scan`, {
        method: 'POST',
        body: formData,
        headers: this.headers(),
      });
      const data = await response.json() as MenuScanResult;
      return response.ok ? data : { sourceLanguage: '', currency: null, sections: [], items: [], code: data.code, error: data.error ?? 'Failed to scan menu.' };
    } catch (error) {
      return { sourceLanguage: '', currency: null, sections: [], items: [], error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  async getProfile(): Promise<{ profile?: UserProfile | null; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/profile`, { headers: this.headers() });
      const data = await response.json() as { profile?: UserProfile | null; error?: string };
      return response.ok ? data : { error: data.error ?? 'Unable to load your profile.' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  async saveProfile(displayName: string, foodPreferences: MenuPreference[]): Promise<{ profile?: UserProfile; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/profile`, {
        method: 'PUT',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, foodPreferences }),
      });
      const data = await response.json() as { profile?: UserProfile; error?: string };
      return response.ok ? data : { error: data.error ?? 'Unable to save your preferences.' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  async deleteProfile(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/profile`, {
        method: 'DELETE',
        headers: this.headers(),
      });
      const data = await response.json() as { success?: boolean; error?: string };
      return response.ok && data.success ? { success: true } : { success: false, error: data.error ?? 'Unable to delete your account.' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }

  async createMenuShare(menu: SharedMenu): Promise<{ shareId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/menu-shares`, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(menu),
      });
      const data = await response.json() as { shareId?: string; error?: string };
      return response.ok ? data : { error: data.error ?? 'Unable to create a share link.' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network request failed.' };
    }
  }
}

export async function loadAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(authTokenKey);
}

export async function saveAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(authTokenKey, token);
}
