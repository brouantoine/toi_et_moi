import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ApiError, devDetail } from '@/api';
import { Button, Text } from '@/ui';

import { FormField } from './FormField';
import { FormScreen } from './FormScreen';
import { SocialButtons } from './social/SocialButtons';
import { loginSchema, type LoginForm } from './schemas';
import { useLogin } from './useAuthActions';

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
  const badCredentials = login.error instanceof ApiError && login.error.status === 401;
  const detail = login.error && !badCredentials ? devDetail(login.error) : null;

  return (
    <FormScreen testID="login-screen">
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
        <Text accessibilityRole="alert" testID="login-error" color="danger">
          {serverError}
          {detail ? `\n${detail}` : ''}
        </Text>
      ) : null}
      <Button
        testID="login-submit"
        label={t('auth.login.submit')}
        loading={login.isPending}
        onPress={handleSubmit((form) => login.mutate(form))}
      />
      <SocialButtons />
      <Button
        testID="login-forgot"
        variant="ghost"
        label={t('auth.login.forgot')}
        onPress={() => router.push('/forgot-password')}
      />
      <Button
        testID="login-to-register"
        variant="ghost"
        label={t('auth.login.noAccount')}
        // Replace, not push: switching between sign in and sign up never piles screens up.
        onPress={() => router.replace('/register')}
      />
    </FormScreen>
  );
}
