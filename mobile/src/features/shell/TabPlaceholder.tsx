import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen, Text } from '@/ui';

type Props = { icon: LucideIcon; tab: string; children?: ReactNode };

/** Temporary content of a tab until its feature lands: title + kind empty state. */
export function TabPlaceholder({ icon, tab, children }: Props) {
  const { t } = useTranslation();
  return (
    <Screen testID={`tab-${tab}`}>
      <Text variant="title">{t(`tabs.${tab}.title`)}</Text>
      <EmptyState
        icon={icon}
        title={t(`tabs.${tab}.emptyTitle`)}
        message={t(`tabs.${tab}.emptyMessage`)}
      />
      {children}
    </Screen>
  );
}
