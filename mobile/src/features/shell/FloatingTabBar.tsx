import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, PressableScale, useTheme } from '@/ui';

import { TABS } from './tabs';

/** Props React Navigation gives a custom tab bar (derived: expo-router does not re-export them). */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const FLOATING_BAR_HEIGHT = 64;
const ITEM_HEIGHT = 48;

/**
 * Floating pill tab bar (reference capture): white rounded bar with a soft shadow,
 * icons only, the active tab sits on a soft grey pill. Names are announced to
 * screen readers through each tab's title.
 */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const { colors, elevation, radii, spacing } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.background,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            height: FLOATING_BAR_HEIGHT,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            boxShadow: elevation.raised,
            borderColor: colors.border,
            borderWidth: elevation.hairline ? StyleSheet.hairlineWidth : 0,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS.find((item) => item.name === route.name);
          const options = descriptors[route.key]?.options;
          if (!tab || !options) return null;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync().catch(() => {});
              navigateToTab(route.key);
            }
          };
          return (
            <PressableScale
              key={route.key}
              testID={`tabbar-${route.name}`}
              accessibilityRole="tab"
              accessibilityLabel={options.title}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              scaleTo={0.9}
              style={[
                styles.item,
                {
                  borderRadius: radii.pill,
                  backgroundColor: focused ? colors.surfaceMuted : 'transparent',
                },
              ]}
            >
              <Icon
                icon={tab.icon}
                size={26}
                color={focused ? 'text' : 'textMuted'}
                filled={focused && route.name !== 'memories'}
                strokeWidth={focused ? 2.2 : 1.9}
              />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderCurve: 'continuous',
  },
  item: {
    flex: 1,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
