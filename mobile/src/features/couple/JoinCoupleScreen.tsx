import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Screen, Text } from '@/ui';

import { isValidCode, normalizeCode } from './inviteLink';
import { usePendingInvite } from './pendingInvite';
import { joinErrorKey, useJoinCouple } from './useCouple';

export function JoinCoupleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const pending = usePendingInvite();
  const [code, setCode] = useState(() => normalizeCode(params.code ?? pending.code ?? ''));
  const [touched, setTouched] = useState(false);
  const join = useJoinCouple();

  const invalid = touched && !isValidCode(code);

  const submit = () => {
    setTouched(true);
    if (!isValidCode(code)) return;
    join.mutate(normalizeCode(code), {
      onSuccess: () => {
        pending.set(null);
        router.replace('/');
      },
    });
  };

  return (
    <Screen testID="join-screen">
      <Text variant="title">{t('couple.join.title')}</Text>
      <Text muted>{t('couple.join.explain')}</Text>
      <Input
        testID="join-code"
        label={t('couple.join.codeLabel')}
        value={code}
        onChangeText={(value) => setCode(normalizeCode(value).slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={7}
        error={invalid ? t('couple.join.invalidFormat') : undefined}
      />
      {join.isError ? (
        <Text accessibilityRole="alert" testID="join-error">
          {t(joinErrorKey(join.error))}
        </Text>
      ) : null}
      <Button
        testID="join-submit"
        label={t('couple.join.submit')}
        loading={join.isPending}
        onPress={submit}
      />
    </Screen>
  );
}
