import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useApplyProfileLanguage } from '@/features/me/useProfile';
import { TABS } from '@/features/shell/tabs';
import { Icon, useTheme } from '@/ui';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  useApplyProfileLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
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
