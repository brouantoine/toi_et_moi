import { useRouter } from 'expo-router';
import { Bell, HeartHandshake, MapPin, Pencil, Smile, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSignOut } from '@/auth/useSignOut';
import { Avatar, Button, Card, Icon, ListRow, PressableScale, Screen, Text, useTheme } from '@/ui';

import { useMe } from './useProfile';

export function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const me = useMe();
  const signOut = useSignOut();
  return (
    <Screen testID="tab-me" wash>
      {me.data ? (
        <PressableScale
          testID="me-avatar"
          accessibilityRole="button"
          accessibilityLabel={t('avatar.edit')}
          onPress={() => router.push('/settings/avatar')}
          style={styles.header}
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
          <Text variant="title">{me.data.display_name}</Text>
        </PressableScale>
      ) : (
        <Text variant="title">{t('tabs.me.title')}</Text>
      )}
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

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 12, paddingTop: 8 },
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
