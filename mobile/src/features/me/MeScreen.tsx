import { useRouter } from 'expo-router';
import {
  Bell,
  Crown,
  FileText,
  HeartHandshake,
  LifeBuoy,
  MapPin,
  Pencil,
  Shield,
  Smile,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { useSignOut } from '@/auth/useSignOut';
import { useCouple } from '@/features/couple/useCouple';
import { legalUrl } from '@/features/premium/PremiumScreen';
import { isPlusActive } from '@/features/premium/purchases';
import {
  Avatar,
  Button,
  Card,
  Icon,
  ListRow,
  Notice,
  PressableScale,
  Screen,
  Text,
  useTheme,
} from '@/ui';

import { useMe } from './useProfile';

export function MeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const me = useMe();
  const signOut = useSignOut();
  const plusUntil = useCouple({ enabled: false }).data?.plus_until;
  const [openedAt] = useState(() => Date.now());
  const plusActive = isPlusActive(plusUntil, openedAt);
  const open = (page: 'privacy' | 'terms' | 'support') => () =>
    void Linking.openURL(legalUrl(page, i18n.language)).catch(() => {});
  return (
    <Screen testID="tab-me" wash>
      {me.data ? (
        <PressableScale
          testID="me-avatar"
          accessibilityRole="button"
          accessibilityLabel={t('avatar.edit')}
          onPress={() => router.push('/settings/avatar')}
          style={[styles.header, { gap: spacing.smd, paddingTop: spacing.sm }]}
        >
          <View>
            <Avatar
              name={me.data.display_name}
              uri={me.data.avatar_url}
              preset={me.data.avatar_preset}
              size={112}
              ring
            />
            <View
              style={[styles.edit, { backgroundColor: colors.text, borderColor: colors.surface }]}
            >
              <Icon icon={Pencil} size={14} color="background" strokeWidth={2.4} />
            </View>
          </View>
          <Text variant="title" style={styles.name}>
            {me.data.display_name}
          </Text>
        </PressableScale>
      ) : (
        <Text variant="title">{t('tabs.me.title')}</Text>
      )}
      {me.isError && !me.data ? (
        <Notice
          testID="me-error"
          tone="warning"
          message={t('errors.network')}
          actionLabel={t('common.retry')}
          onAction={() => void me.refetch()}
        />
      ) : null}
      <Card>
        <ListRow
          testID="me-avatar-row"
          icon={Smile}
          label={t('me.avatar')}
          hint={t('me.avatarHint')}
          onPress={() => router.push('/settings/avatar')}
        />
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
      <Card>
        <ListRow
          testID="me-plus"
          icon={Crown}
          label={t('me.plus')}
          hint={
            plusActive && plusUntil
              ? t('me.plusActive', {
                  date: new Intl.DateTimeFormat(i18n.language, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(plusUntil)),
                })
              : t('me.plusHint')
          }
          onPress={() => router.push('/premium')}
        />
      </Card>
      <Card>
        <ListRow testID="me-help" icon={LifeBuoy} label={t('me.help')} onPress={open('support')} />
        <ListRow
          testID="me-privacy"
          icon={Shield}
          label={t('legal.privacy')}
          onPress={open('privacy')}
        />
        <ListRow
          testID="me-terms"
          icon={FileText}
          label={t('legal.terms')}
          onPress={open('terms')}
        />
      </Card>
      <Button
        testID="me-sign-out"
        variant="ghost"
        label={t('me.signOut')}
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
      <Button
        testID="me-delete-account"
        variant="ghost"
        label={t('me.delete')}
        onPress={() => router.push('/settings/delete-account')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  name: { textAlign: 'center' },
  edit: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
