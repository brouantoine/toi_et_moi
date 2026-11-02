import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState, Screen, Text } from '@/ui';

import { FormField } from './FormField';
import { forgotPasswordSchema, type ForgotPasswordForm } from './schemas';
import { useRequestPasswordReset } from './useAuthActions';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const request = useRequestPasswordReset();
  const { control, handleSubmit } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  if (request.isSuccess) {
    return (
      <Screen testID="forgot-sent">
        <EmptyState
          icon={MailCheck}
          title={t('auth.forgot.sentTitle')}
          message={t('auth.forgot.sentMessage')}
        />
        <Link href="/login">
          <Text muted>{t('auth.forgot.backToLogin')}</Text>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen testID="forgot-screen">
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
      {request.isError ? <Text accessibilityRole="alert">{t('errors.generic')}</Text> : null}
      <Button
        testID="forgot-submit"
        label={t('auth.forgot.submit')}
        loading={request.isPending}
        onPress={handleSubmit((form) => request.mutate(form))}
      />
    </Screen>
  );
}
