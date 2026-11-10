import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AVATAR_PRESETS } from './avatarPresets';
import { Text } from './Text';
import { useTheme } from './theme';

type Props = {
  name: string;
  /** Uploaded photo: wins over everything else. */
  uri?: string | null;
  /** Illustrated avatar id (see avatarPresets), used when there is no photo. */
  preset?: string | null;
  size?: number;
  /** White ring that lifts the avatar off a tinted surface. */
  ring?: boolean;
  testID?: string;
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const picked = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1);
  const letters = picked.map((p) => (p ? (Array.from(p)[0] ?? '').toUpperCase() : ''));
  return letters.join('') || '?';
}

/** Photo, else illustrated avatar, else initials: always a clean circle. */
export function Avatar({ name, uri, preset, size = 48, ring = false, testID }: Props) {
  const { colors, elevation } = useTheme();
  const border = ring ? Math.max(2, Math.round(size / 24)) : 0;
  const inner = size - border * 2;
  const shape = { width: inner, height: inner, borderRadius: inner / 2 };
  const illustration = !uri && preset ? AVATAR_PRESETS[preset] : undefined;
  const fontSize = Math.round(inner * 0.4);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: border,
          backgroundColor: ring ? colors.surface : 'transparent',
          boxShadow: ring ? elevation.card : undefined,
        },
      ]}
    >
      <View
        style={[
          styles.center,
          styles.clip,
          shape,
          { backgroundColor: illustration ? colors.surfaceMuted : colors.secondary },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={shape} contentFit="cover" cachePolicy="memory-disk" />
        ) : illustration ? (
          <Image
            source={illustration}
            style={{ width: inner * 0.82, height: inner * 0.82, marginTop: inner * 0.12 }}
            contentFit="contain"
          />
        ) : (
          <Text
            importantForAccessibility="no"
            style={{
              color: colors.onSecondary,
              fontSize,
              lineHeight: Math.round(fontSize * 1.2),
              fontWeight: '700',
              includeFontPadding: false,
            }}
          >
            {initials(name)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
});
