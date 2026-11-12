import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { ApiError } from '@/api';
import { legalUrl } from '@/features/premium/PremiumScreen';
import { Button, Text, ToggleRow } from '@/ui';

import { FormField } from './FormField';
import { FormScreen } from './FormScreen';
import { SocialButtons } from './social/SocialButtons';
import { registerSchema, type RegisterForm } from './schemas';
import { registerFieldError, useRegister } from './useAuthActions';

export function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const register = useRegister();
  const { control, handleSubmit, setError } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', email: '', password: '', isAdult: false },
  });

  const onSubmit = handleSubmit((form) =>
    register.mutate(form, {
      onError: (error) => {
        const fieldError = registerFieldError(error);
        if (fieldError) setError(fieldError.field, { message: fieldError.key });
      },
    }),
  );

  const generalError =
    register.error && !registerFieldError(register.error)
      ? t(`errors.${register.error instanceof ApiError ? register.error.code : 'network'}`, {
          defaultValue: t('errors.generic'),
        })
      : null;

  return (
    <FormScreen testID="register-screen">
      <Text variant="title">{t('auth.register.title')}</Text>
      <Text muted>{t('auth.register.subtitle')}</Text>
      <FormField
        control={control}
        name="firstName"
        label={t('auth.fields.firstName')}
        autoComplete="given-name"
        textContentType="givenName"
        testID="register-first-name"
      />
      <FormField
        control={control}
        name="email"
        label={t('auth.fields.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        testID="register-email"
      />
      <FormField
        control={control}
        name="password"
        label={t('auth.fields.password')}
        hint={t('auth.register.passwordHint')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        testID="register-password"
      />
      <Controller
        control={control}
        name="isAdult"
        render={({ field, fieldState }) => (
          <View>
            <ToggleRow
              testID="register-adult"
              label={t('auth.fields.isAdult')}
              value={field.value}
              onChange={field.onChange}
            />
            {fieldState.error?.message ? (
              <Text variant="caption" color="danger" testID="register-adult-error">
                {t(fieldState.error.message)}
              </Text>
            ) : null}
          </View>
        )}
      />
      {generalError ? (
        <Text accessibilityRole="alert" testID="register-error" color="danger">
          {generalError}
        </Text>
      ) : null}
      <Button
        testID="register-submit"
        label={t('auth.register.submit')}
        loading={register.isPending}
        onPress={onSubmit}
      />
      <SocialButtons />
      <Text testID="register-consent" variant="caption" muted style={{ textAlign: 'center' }}>
        {t('legal.consent')}{' '}
        <Text
          variant="caption"
          color="primary"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(legalUrl('terms', i18n.language)).catch(() => {})}
        >
          {t('legal.terms')}
        </Text>
        {' · '}
        <Text
          variant="caption"
          color="primary"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(legalUrl('privacy', i18n.language)).catch(() => {})}
        >
          {t('legal.privacy')}
        </Text>
      </Text>
      <Button
        testID="register-to-login"
        variant="ghost"
        label={t('auth.register.haveAccount')}
        onPress={() => router.replace('/login')}
      />
    </FormScreen>
  );
}
