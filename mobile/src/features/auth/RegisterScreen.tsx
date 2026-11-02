import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api';
import { Button, Screen, Text } from '@/ui';

import { FormField } from './FormField';
import { registerSchema, type RegisterForm } from './schemas';
import { registerFieldError, useRegister } from './useAuthActions';

export function RegisterScreen() {
  const { t } = useTranslation();
  const register = useRegister();
  const { control, handleSubmit, setError } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', email: '', password: '' },
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
    <Screen testID="register-screen">
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
      {generalError ? (
        <Text accessibilityRole="alert" testID="register-error">
          {generalError}
        </Text>
      ) : null}
      <Button
        testID="register-submit"
        label={t('auth.register.submit')}
        loading={register.isPending}
        onPress={onSubmit}
      />
      <Link href="/login" testID="register-to-login">
        <Text muted>{t('auth.register.haveAccount')}</Text>
      </Link>
    </Screen>
  );
}
