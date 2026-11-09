import { useRouter } from 'expo-router';
import { Bell, HeartHandshake, MapPin, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useSignOut } from '@/auth/useSignOut';
import { Button, Card, ListRow, Screen, Text } from '@/ui';

import { useMe } from './useProfile';

export function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const signOut = useSignOut();
  return (
    <Screen testID="tab-me">
      <Text variant="title">{t('tabs.me.title')}</Text>
      {me.data ? <Text muted>{me.data.display_name}</Text> : null}
      <Card>
        <ListRow
          testID="me-profile"
          icon={UserRound}
          label={t('me.profile')}
          hint={t('me.profileHint')}
          onPress={() => router.push('/settings/profile')}
        />
        <ListRow
          testID="me-couple"
          icon={HeartHandshake}
          label={t('me.couple')}
          hint={t('me.coupleHint')}
          onPress={() => router.push('/settings/couple')}
        />
        <ListRow
          testID="me-distance"
          icon={MapPin}
          label={t('me.distance')}
          hint={t('me.distanceHint')}
          onPress={() => router.push('/distance')}
        />
        <ListRow
          testID="me-notifications"
          icon={Bell}
          label={t('notifications.settings.title')}
          hint={t('notifications.settings.hint')}
          onPress={() => router.push('/settings/notifications')}
        />
      </Card>
      <Text variant="caption" muted>
        {t('tabs.me.emptyMessage')}
      </Text>
      <Button
        testID="me-sign-out"
        variant="ghost"
        label={t('me.signOut')}
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}
