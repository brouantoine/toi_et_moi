import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api';
import { Button, Screen, Text } from '@/ui';

import { FormField } from './FormField';
import { loginSchema, type LoginForm } from './schemas';
import { useLogin } from './useAuthActions';

export function LoginScreen() {
  const { t } = useTranslation();
  const login = useLogin();
  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const serverError =
    login.error instanceof ApiError && login.error.status === 401
      ? t('auth.errors.badCredentials')
      : login.error
        ? t(`errors.${login.error instanceof ApiError ? login.error.code : 'network'}`, {
            defaultValue: t('errors.generic'),
          })
        : null;

  return (
    <Screen testID="login-screen">
      <Text variant="title">{t('auth.login.title')}</Text>
      <FormField
        control={control}
        name="email"
        label={t('auth.fields.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        testID="login-email"
      />
      <FormField
        control={control}
        name="password"
        label={t('auth.fields.password')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        testID="login-password"
      />
      {serverError ? (
        <Text accessibilityRole="alert" testID="login-error">
          {serverError}
        </Text>
      ) : null}
      <Button
        testID="login-submit"
        label={t('auth.login.submit')}
        loading={login.isPending}
        onPress={handleSubmit((form) => login.mutate(form))}
      />
      <Link href="/forgot-password" testID="login-forgot">
        <Text muted>{t('auth.login.forgot')}</Text>
      </Link>
      <Link href="/register" testID="login-to-register">
        <Text muted>{t('auth.login.noAccount')}</Text>
      </Link>
    </Screen>
  );
}
