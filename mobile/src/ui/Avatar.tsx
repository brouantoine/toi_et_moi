import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

type Props = { name: string; uri?: string | null; size?: number; testID?: string };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const picked = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1);
  const letters = picked.map((p) => (p ? (Array.from(p)[0] ?? '').toUpperCase() : ''));
  return letters.join('') || '?';
}

export function Avatar({ name, uri, size = 48, testID }: Props) {
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.base, shape, { backgroundColor: colors.secondary }]}
    >
      {uri ? (
        <Image source={{ uri }} style={shape} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <Text
          variant="label"
          style={{ color: colors.onSecondary, fontSize: size * 0.38 }}
          importantForAccessibility="no"
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
