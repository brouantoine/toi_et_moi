/** Auth business logic (screens stay presentational). */
import { useMutation } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';

import { api, ApiError, unwrap } from '@/api';
import { useAuthStore } from '@/auth/authStore';
import i18n from '@/i18n';

import type { ForgotPasswordForm, LoginForm, RegisterForm } from './schemas';

export function deviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}

function currentLanguage(): 'fr' | 'en' {
  return i18n.language === 'en' ? 'en' : 'fr';
}

/** Maps server validation errors to a form field and an i18n key. */
export function registerFieldError(
  error: unknown,
): { field: keyof RegisterForm; key: string } | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const body = (error.body ?? {}) as Record<string, unknown>;
  if (body.email) return { field: 'email', key: 'auth.errors.emailTaken' };
  if (body.password) return { field: 'password', key: 'auth.errors.passwordWeak' };
  if (body.timezone) return null;
  return null;
}

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: async (form: LoginForm) =>
      unwrap(
        await api.POST('/api/v1/auth/token/', {
          body: { email: form.email.trim(), password: form.password },
        }),
      ),
    onSuccess: (tokens) => signIn({ access: tokens.access, refresh: tokens.refresh }),
  });
}

export function useRegister() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: async (form: RegisterForm) =>
      unwrap(
        await api.POST('/api/v1/auth/register/', {
          body: {
            email: form.email.trim(),
            password: form.password,
            first_name: form.firstName.trim(),
            language: currentLanguage(),
            timezone: deviceTimezone(),
            is_adult: form.isAdult,
          },
        }),
      ),
    onSuccess: (data) => signIn({ access: data.access, refresh: data.refresh }),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (form: ForgotPasswordForm) => {
      unwrap(
        await api.POST('/api/v1/auth/password-reset/', { body: { email: form.email.trim() } }),
      );
    },
  });
}
