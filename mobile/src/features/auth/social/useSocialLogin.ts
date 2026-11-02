import { useMutation } from '@tanstack/react-query';

import { api, unwrap } from '@/api';
import { useAuthStore } from '@/auth/authStore';
import i18n from '@/i18n';

import { signInWithApple, signInWithGoogle, type SocialCredentials } from './providers';

export type SocialProvider = 'apple' | 'google';

const PROVIDERS: Record<SocialProvider, () => Promise<SocialCredentials | null>> = {
  apple: signInWithApple,
  google: signInWithGoogle,
};

/** Resolves to true when signed in, false when the user cancelled. */
export function useSocialLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: async (provider: SocialProvider): Promise<boolean> => {
      const credentials = await PROVIDERS[provider]();
      if (!credentials) return false;
      const data = unwrap(
        await api.POST('/api/v1/auth/social/{provider}/', {
          params: { path: { provider } },
          body: {
            id_token: credentials.idToken,
            nonce: credentials.nonce ?? null,
            first_name: credentials.firstName,
            language: i18n.language === 'en' ? 'en' : 'fr',
          },
        }),
      );
      await signIn({ access: data.access, refresh: data.refresh });
      return true;
    },
  });
}
