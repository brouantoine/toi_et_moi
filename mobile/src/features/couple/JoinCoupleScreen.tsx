import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardPaste } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormScreen } from '@/features/auth/FormScreen';
import { Button, Input, Text } from '@/ui';

import { extractCode, isValidCode, normalizeCode } from './inviteLink';
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
  const [pasteEmpty, setPasteEmpty] = useState(false);

  /** Accepts the bare code, the link or the whole shared message. */
  const paste = async () => {
    const found = extractCode(await Clipboard.getStringAsync().catch(() => ''));
    setPasteEmpty(!found);
    if (found) setCode(found);
  };

  // Opened straight from an invitation link there is nothing behind: going "home" would
  // reopen this screen while the code is pending, so drop it and show the setup screen.
  const leave = () => {
    pending.set(null);
    if (router.canGoBack()) router.back();
    else router.replace('/couple');
  };

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
    <FormScreen testID="join-screen" onBack={leave}>
      <Text variant="title">{t('couple.join.title')}</Text>
      <Text muted>{t('couple.join.explain')}</Text>
      <Input
        testID="join-code"
        label={t('couple.join.codeLabel')}
        value={code}
        onChangeText={(value) => setCode(normalizeCode(value).slice(0, 6))}
        onSubmitEditing={submit}
        returnKeyType="go"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={7}
        error={invalid ? t('couple.join.invalidFormat') : undefined}
      />
      <Button
        testID="join-paste"
        variant="soft"
        icon={ClipboardPaste}
        label={t('couple.join.paste')}
        onPress={() => void paste()}
      />
      {pasteEmpty ? (
        <Text variant="caption" muted testID="join-paste-empty">
          {t('couple.join.pasteEmpty')}
        </Text>
      ) : null}
      {join.isError ? (
        <Text accessibilityRole="alert" testID="join-error" color="danger">
          {t(joinErrorKey(join.error))}
        </Text>
      ) : null}
      <Button
        testID="join-submit"
        label={t('couple.join.submit')}
        loading={join.isPending}
        onPress={submit}
      />
    </FormScreen>
  );
}
