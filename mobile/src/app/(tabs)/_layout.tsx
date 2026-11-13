import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useRealtimeSync } from '@/api/useRealtimeSync';
import { CallWatcher } from '@/features/calls/CallWatcher';
import { identify } from '@/features/premium/purchases';
import { refreshPushRegistration } from '@/notifications/push';
import { useNotificationResponses } from '@/notifications/responses';
import { useApplyProfileLanguage, useMe, useSyncDeviceTimezone } from '@/features/me/useProfile';
import { useRefreshPositionOnOpen } from '@/features/distance/useDistance';
import { FloatingTabBar } from '@/features/shell/FloatingTabBar';
import { TABS } from '@/features/shell/tabs';
import { useTheme } from '@/ui';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  useApplyProfileLanguage();
  useSyncDeviceTimezone();
  useRealtimeSync();
  useNotificationResponses();
  useRefreshPositionOnOpen();
  useEffect(() => {
    void refreshPushRegistration();
  }, []);
  // Store purchases are tied to this person, so the server can give Plus to the couple.
  const myId = useMe().data?.id;
  useEffect(() => {
    if (myId != null) void identify(myId).catch(() => {});
  }, [myId]);
  return (
    <>
      <CallWatcher />
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
    </>
  );
}
