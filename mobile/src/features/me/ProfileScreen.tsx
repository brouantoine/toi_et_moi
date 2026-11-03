import { getCalendars } from 'expo-localization';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api';
import { Button, DateField, ErrorState, Input, LoadingState, Screen, Segmented, Text } from '@/ui';

import { useMe, useUpdateMe, type Me } from './useProfile';

type Language = 'fr' | 'en';

function ProfileForm({ me }: { me: Me }) {
  const { t } = useTranslation();
  const update = useUpdateMe();
  const [firstName, setFirstName] = useState(me.first_name);
  const [nickname, setNickname] = useState(me.nickname ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(me.birth_date ?? null);
  const [language, setLanguage] = useState<Language>(me.language === 'en' ? 'en' : 'fr');
  const deviceTz = getCalendars()[0]?.timeZone ?? null;
  const [timezone, setTimezone] = useState(me.timezone ?? 'UTC');

  const firstNameError = firstName.trim() ? undefined : t('auth.errors.firstNameRequired');

  const save = () => {
    if (firstNameError) return;
    update.mutate({
      first_name: firstName.trim(),
      nickname: nickname.trim(),
      birth_date: birthDate,
      language,
      timezone,
    });
  };

  return (
    <Screen testID="profile-screen">
      <Text variant="title">{t('profile.title')}</Text>
      <Input
        testID="profile-first-name"
        label={t('auth.fields.firstName')}
        value={firstName}
        onChangeText={setFirstName}
        error={firstNameError}
        autoComplete="given-name"
      />
      <Input
        testID="profile-nickname"
        label={t('profile.nickname')}
        hint={t('profile.nicknameHint')}
        value={nickname}
        onChangeText={setNickname}
        maxLength={60}
      />
      <DateField
        testID="profile-birth-date"
        label={t('profile.birthDate')}
        value={birthDate}
        onChange={setBirthDate}
        maximumDate={new Date()}
        clearable
      />
      <Segmented
        testID="profile-language"
        label={t('profile.language')}
        value={language}
        onChange={setLanguage}
        options={[
          { value: 'fr', label: 'Français' },
          { value: 'en', label: 'English' },
        ]}
      />
      <Text variant="label">{t('profile.timezone')}</Text>
      <Text muted testID="profile-timezone">
        {timezone}
      </Text>
      {deviceTz && deviceTz !== timezone ? (
        <Button
          testID="profile-use-device-tz"
          variant="ghost"
          label={t('profile.useDeviceTimezone', { tz: deviceTz })}
          onPress={() => setTimezone(deviceTz)}
        />
      ) : null}
      {update.isError ? (
        <Text accessibilityRole="alert" testID="profile-error">
          {t(
            update.error instanceof ApiError && update.error.status === 400
              ? 'profile.invalid'
              : 'errors.generic',
          )}
        </Text>
      ) : null}
      {update.isSuccess ? (
        <Text accessibilityLiveRegion="polite" testID="profile-saved">
          {t('common.saved')}
        </Text>
      ) : null}
      <Button
        testID="profile-save"
        label={t('common.save')}
        loading={update.isPending}
        onPress={save}
      />
    </Screen>
  );
}

export function ProfileScreen() {
  const me = useMe();
  if (me.isPending) return <LoadingState />;
  if (me.isError || !me.data) {
    return (
      <ErrorState
        code={me.error instanceof ApiError ? me.error.code : 'network'}
        onRetry={() => void me.refetch()}
      />
    );
  }
  return <ProfileForm me={me.data} />;
}
