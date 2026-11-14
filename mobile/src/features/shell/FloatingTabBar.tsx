import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon, useReducedMotion, useTheme } from '@/ui';

import { TABS } from './tabs';

/** Props React Navigation gives a custom tab bar (derived: expo-router does not re-export them). */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const FLOATING_BAR_HEIGHT = 64;
const BAR_PADDING_TOP = 8;
const BAR_MIN_BOTTOM = 16;

/** Total height the floating bar takes at the bottom of a tab screen. */
export function floatingTabBarHeight(bottomInset: number): number {
  return FLOATING_BAR_HEIGHT + BAR_PADDING_TOP + Math.max(bottomInset, BAR_MIN_BOTTOM);
}

/** Android resizes the window for the keyboard: hide the bar so nothing floats above it. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}
type ItemProps = {
  name: string;
  label: string | undefined;
  focused: boolean;
  onSelect: () => void;
  onLongPress: () => void;
};

/**
 * One tab: no background shape. Selected = the icon fills in and pops slightly.
 * It switches on release, like every button: switching on touch-down swapped the screen
 * while the finger was still down, Android lost the release, and the NEXT tap anywhere
 * was swallowed (found on device, 2026-11-14).
 */
function TabItem({ name, label, focused, onSelect, onLongPress }: ItemProps) {
  const reduced = useReducedMotion();
  const tab = TABS.find((item) => item.name === name);
  const [pop] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    if (reduced) {
      pop.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(pop, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 28,
      bounciness: 10,
    }).start();
  }, [focused, pop, reduced]);

  if (!tab) return null;
  return (
    <Pressable
      testID={`tabbar-${name}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onSelect}
      onLongPress={onLongPress}
      hitSlop={{ top: 12, bottom: 12 }}
      style={styles.item}
    >
      <Animated.View
        style={{
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
        }}
      >
        <Icon
          icon={tab.icon}
          size={27}
          color={focused ? 'text' : 'textMuted'}
          filled={focused}
          strokeWidth={focused ? 2 : 1.9}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Floating pill tab bar (reference capture): rounded bar with a soft shadow and icons
 * only. Names are announced to screen readers through each tab's title.
 */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const { colors, elevation, radii, spacing } = useTheme();
  const keyboardShown = useKeyboardShown();
  if (keyboardShown) return null;
  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingHorizontal: spacing.lg,
        paddingTop: BAR_PADDING_TOP,
        paddingBottom: Math.max(insets.bottom, BAR_MIN_BOTTOM),
      }}
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
            borderWidth: StyleSheet.hairlineWidth,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <TabItem
              key={route.key}
              name={route.name}
              label={descriptors[route.key]?.options.title}
              focused={focused}
              onSelect={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  void Haptics.selectionAsync().catch(() => {});
                  navigateToTab(route.key);
                }
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'stretch', borderCurve: 'continuous' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
