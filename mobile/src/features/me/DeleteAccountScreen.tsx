import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { api, unwrap } from '@/api';
import { queryPersister } from '@/api/queryClient';
import { useAuthStore } from '@/auth/authStore';
import { stopBackgroundUpdates } from '@/features/distance/background';
import { forget as forgetPurchases, MANAGE_URL } from '@/features/premium/purchases';
import { forgetThisPhone } from '@/notifications/push';
import { Button, Card, Icon, Input, Notice, Screen, Text, useTheme } from '@/ui';

const WORD = { fr: 'SUPPRIMER', en: 'DELETE' } as const;

/**
 * Deleting the account, for good (App Store 5.1.1(v)): what disappears, the reminder
 * that a store subscription is cancelled in the store, then a typed confirmation.
 */
export function DeleteAccountScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const client = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);
  const word = i18n.language === 'en' ? WORD.en : WORD.fr;
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toUpperCase() === word;

  const remove = useMutation({
    mutationFn: async () => {
      await forgetThisPhone().catch(() => {});
      // The schema tool drops DELETE bodies; the server requires this one (typed confirmation).
      unwrap(await api.DELETE('/api/v1/me/', { body: { confirm: typed.trim() } as never }));
      await stopBackgroundUpdates().catch(() => {});
      await forgetPurchases().catch(() => {});
      client.clear();
      await queryPersister.removeClient();
      await signOut();
    },
  });

  return (
    <Screen testID="delete-account-screen">
      <Text variant="title">{t('deleteAccount.title')}</Text>
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.smd, alignItems: 'flex-start' }}>
          <Icon icon={AlertTriangle} size={22} color="danger" />
          <Text style={{ flex: 1 }}>{t('deleteAccount.what')}</Text>
        </View>
        <Text muted>{t('deleteAccount.partner')}</Text>
        <Text muted>{t('deleteAccount.subscription')}</Text>
        <Button
          testID="delete-account-manage"
          variant="ghost"
          label={t('premium.manage')}
          onPress={() => void Linking.openURL(MANAGE_URL).catch(() => {})}
        />
      </Card>
      <Input
        testID="delete-account-confirm"
        label={t('deleteAccount.typeLabel', { word })}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {remove.isError ? (
        <Notice testID="delete-account-error" tone="warning" message={t('deleteAccount.error')} />
      ) : null}
      <Button
        testID="delete-account-submit"
        size="lg"
        variant="primary"
        label={t('deleteAccount.submit')}
        disabled={!matches}
        loading={remove.isPending}
        onPress={() => remove.mutate()}
      />
    </Screen>
  );
}
