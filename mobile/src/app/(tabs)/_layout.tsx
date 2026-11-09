import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useRealtimeSync } from '@/api/useRealtimeSync';
import { refreshPushRegistration } from '@/notifications/push';
import { useNotificationResponses } from '@/notifications/responses';
import { useApplyProfileLanguage } from '@/features/me/useProfile';
import { FloatingTabBar } from '@/features/shell/FloatingTabBar';
import { TABS } from '@/features/shell/tabs';
import { useTheme } from '@/ui';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  useApplyProfileLanguage();
  useRealtimeSync();
  useNotificationResponses();
  useEffect(() => {
    void refreshPushRegistration();
  }, []);
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map(({ name }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(`tabs.${name}.label`),
          }}
        />
      ))}
    </Tabs>
  );
}
