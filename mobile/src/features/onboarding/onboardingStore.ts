/** "Onboarding already seen" flag, persisted on the device (not sensitive: AsyncStorage). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'nd.onboarding.v1';

type OnboardingState = {
  status: 'loading' | 'unseen' | 'seen';
  hydrate: () => Promise<void>;
  complete: () => Promise<void>;
};

export const useOnboarding = create<OnboardingState>((set) => ({
  status: 'loading',
  hydrate: async () => {
    try {
      set({ status: (await AsyncStorage.getItem(KEY)) === 'done' ? 'seen' : 'unseen' });
    } catch {
      set({ status: 'unseen' });
    }
  },
  complete: async () => {
    set({ status: 'seen' });
    try {
      await AsyncStorage.setItem(KEY, 'done');
    } catch {
      // Not critical: worst case the onboarding is shown once more.
    }
  },
}));
