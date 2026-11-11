import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Check, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { pickImages } from '@/media/images';
import {
  Avatar,
  AVATAR_PEOPLE,
  AVATAR_PRESETS,
  AVATAR_TONES,
  Button,
  ErrorState,
  Icon,
  LoadingState,
  Notice,
  presetId,
  PressableScale,
  Text,
  useTheme,
} from '@/ui';

import { useAvatarActions } from './useAvatar';
import { useMe } from './useProfile';

const COLUMNS = AVATAR_TONES.length;

/** Choose a character (one tap, saved at once) or a photo from the library. */
export function AvatarScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, spacing } = useTheme();
  const me = useMe();
  const { choosePreset, uploadPhoto, removePhoto } = useAvatarActions();
  const [denied, setDenied] = useState(false);

  if (!me.data) {
    if (me.isError) {
      return (
        <ErrorState
          testID="avatar-load-error"
          code={me.error instanceof ApiError ? me.error.code : 'network'}
          onRetry={() => void me.refetch()}
        />
      );
    }
    return <LoadingState testID="avatar-loading" />;
  }
  const current = me.data;
  const hasPhoto = Boolean(current.avatar_url);
  const gap = spacing.smd;
  const cell = Math.floor((Math.min(width, 520) - spacing.lg * 2 - gap * (COLUMNS - 1)) / COLUMNS);

  const pickPhoto = async () => {
    setDenied(false);
    const result = await pickImages(1).catch(() => ({ status: 'cancelled' as const }));
    if (result.status === 'denied') setDenied(true);
    if (result.status === 'picked' && result.images[0]) uploadPhoto.mutate(result.images[0]);
  };

  const failed =
    choosePreset.isError || removePhoto.isError
      ? t('avatar.error')
      : uploadPhoto.isError
        ? t('avatar.uploadError')
        : null;
  const busy = uploadPhoto.isPending || removePhoto.isPending;

  return (
    <ScrollView
      testID="avatar-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <View style={[styles.center, { gap: spacing.md }]}>
        <Avatar
          testID="avatar-preview"
          name={current.display_name}
          uri={current.avatar_url}
          preset={current.avatar_preset}
          size={128}
          ring
        />
        <View style={[styles.center, { gap: spacing.xs }]}>
          <Text variant="title" style={styles.textCenter}>
            {t('avatar.title')}
          </Text>
          <Text muted style={styles.textCenter}>
            {t('avatar.hint')}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button
          testID="avatar-photo"
          variant="soft"
          icon={ImagePlus}
          label={t(hasPhoto ? 'avatar.changePhoto' : 'avatar.photo')}
          loading={uploadPhoto.isPending}
          disabled={removePhoto.isPending}
          onPress={() => void pickPhoto()}
        />
        {hasPhoto ? (
          <Button
            testID="avatar-remove-photo"
            variant="ghost"
            icon={Trash2}
            label={t('avatar.removePhoto')}
            loading={removePhoto.isPending}
            disabled={uploadPhoto.isPending}
            onPress={() => removePhoto.mutate()}
          />
        ) : null}
      </View>

      {denied ? (
        <Notice
          testID="avatar-denied"
          tone="warning"
          message={t('avatar.denied')}
          actionLabel={t('distance.openSettings')}
          onAction={() => void Linking.openSettings()}
        />
      ) : null}
      {failed ? <Notice testID="avatar-error" tone="warning" message={failed} /> : null}

      <View style={{ gap: spacing.smd }}>
        <Text variant="heading">{t('avatar.illustrations')}</Text>
        <View accessibilityRole="radiogroup" style={[styles.grid, { gap }]}>
          {AVATAR_PEOPLE.flatMap((person, personIndex) =>
            AVATAR_TONES.map((tone) => {
              const id = presetId(person, tone);
              const source = AVATAR_PRESETS[id];
              if (!source) return null;
              const selected = !hasPhoto && current.avatar_preset === id;
              return (
                <PressableScale
                  key={id}
                  testID={`avatar-preset-${id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${t('avatar.presetLabel', { index: personIndex + 1 })}, ${t(`avatar.tones.${tone}`)}`}
                  accessibilityState={{ checked: selected, disabled: busy }}
                  scaleTo={0.92}
                  // A character chosen while a photo is being sent would be overwritten by it.
                  disabled={busy}
                  onPress={() => {
                    if (selected) return;
                    void Haptics.selectionAsync().catch(() => {});
                    choosePreset.mutate({ preset: id, hadPhoto: hasPhoto });
                  }}
                  style={[
                    styles.cell,
                    {
                      width: cell,
                      height: cell,
                      borderRadius: cell / 2,
                      backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Image
                    source={source}
                    style={{ width: cell * 0.78, height: cell * 0.78, marginTop: cell * 0.1 }}
                    contentFit="contain"
                  />
                  {selected ? (
                    <View
                      style={[
                        styles.check,
                        { backgroundColor: colors.primary, borderColor: colors.surface },
                      ]}
                    >
                      <Icon icon={Check} size={14} color="onPrimary" strokeWidth={3} />
                    </View>
                  ) : null}
                </PressableScale>
              );
            }),
          )}
        </View>
      </View>
      <Text variant="caption" muted style={styles.textCenter}>
        Fluent Emoji (Microsoft, MIT)
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
  },
  check: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
