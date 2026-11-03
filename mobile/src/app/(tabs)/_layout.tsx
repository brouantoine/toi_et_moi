import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApplyProfileLanguage } from '@/features/me/useProfile';
import { TABS } from '@/features/shell/tabs';
import { Icon, useTheme } from '@/ui';

const TAB_BAR_HEIGHT = 66;

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useApplyProfileLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Explicit height including the bottom safe area: on devices without a home
        // indicator the default bar was too short and clipped the labels.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 4,
        },
        tabBarItemStyle: { paddingBottom: insets.bottom > 0 ? 0 : 4 },
        // iOS tab label size; explicit line height so descenders (j, g) are never clipped.
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: '600', flexShrink: 0 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map(({ name, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(`tabs.${name}.label`),
            tabBarButtonTestID: `tabbar-${name}`,
            tabBarIcon: ({ focused }) => (
              <Icon icon={icon} size={24} color={focused ? 'primary' : 'textMuted'} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
