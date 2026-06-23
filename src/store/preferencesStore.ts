/**
 * 端末・ユーザーの表示設定（テーマ・言語など）を保持する Zustand ストア。
 * AsyncStorage に永続化し、アプリ再起動後も維持する。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguagePref, ThemePref } from '@/types/models';

interface PreferencesState {
  theme: ThemePref;
  language: LanguagePref;
  /** AI利用同意（OCR等）。未同意ならOCRを使わせない。 */
  aiConsent: boolean;
  /** ATT/UMP 同意フローを表示済みか。 */
  trackingPrompted: boolean;
  setTheme: (theme: ThemePref) => void;
  setLanguage: (language: LanguagePref) => void;
  setAiConsent: (consent: boolean) => void;
  setTrackingPrompted: (prompted: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'auto',
      aiConsent: false,
      trackingPrompted: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAiConsent: (aiConsent) => set({ aiConsent }),
      setTrackingPrompted: (trackingPrompted) => set({ trackingPrompted }),
    }),
    {
      name: 'webudget-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
