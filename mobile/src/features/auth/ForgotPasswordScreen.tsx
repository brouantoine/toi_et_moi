import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState, Text } from '@/ui';

import { FormField } from './FormField';
import { FormScreen } from './FormScreen';
import { forgotPasswordSchema, type ForgotPasswordForm } from './schemas';
import { useRequestPasswordReset } from './useAuthActions';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const request = useRequestPasswordReset();
  // Usually opened from the sign-in screen: going back avoids a second copy of it.
  const backToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));
  const { control, handleSubmit } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  if (request.isSuccess) {
    return (
      <FormScreen testID="forgot-sent" onBack={backToLogin}>
        <EmptyState
          icon={MailCheck}
          title={t('auth.forgot.sentTitle')}
          message={t('auth.forgot.sentMessage')}
        />
        <Button
          testID="forgot-back-to-login"
          variant="soft"
          label={t('auth.forgot.backToLogin')}
          onPress={backToLogin}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen testID="forgot-screen">
      <Text variant="title">{t('auth.forgot.title')}</Text>
      <Text muted>{t('auth.forgot.subtitle')}</Text>
      <FormField
        control={control}
        name="email"
        label={t('auth.fields.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        testID="forgot-email"
      />
      {request.isError ? (
        <Text accessibilityRole="alert" color="danger" testID="forgot-error">
          {t('errors.generic')}
        </Text>
      ) : null}
      <Button
        testID="forgot-submit"
        label={t('auth.forgot.submit')}
        loading={request.isPending}
        onPress={handleSubmit((form) => request.mutate(form))}
      />
    </FormScreen>
  );
}
