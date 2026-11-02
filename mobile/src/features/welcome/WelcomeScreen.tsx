import { useTranslation } from 'react-i18next';

import { BRAND } from '@/config/brand';
import { Button, Card, Screen, Text } from '@/ui';

/** Temporary landing screen (replaced by onboarding/auth in P1). */
export function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="welcome-screen">
      <Card>
        <Text variant="title">{t('welcome.title', { brand: BRAND.name })}</Text>
        <Text muted>{t('welcome.subtitle')}</Text>
      </Card>
      <Button testID="welcome-start" label={t('welcome.start')} onPress={() => undefined} />
    </Screen>
  );
}
