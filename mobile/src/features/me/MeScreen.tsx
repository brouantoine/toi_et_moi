import { UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useSignOut } from '@/auth/useSignOut';
import { TabPlaceholder } from '@/features/shell/TabPlaceholder';
import { Button } from '@/ui';

export function MeScreen() {
  const { t } = useTranslation();
  const signOut = useSignOut();
  return (
    <TabPlaceholder icon={UserRound} tab="me">
      <Button
        testID="me-sign-out"
        variant="ghost"
        label={t('me.signOut')}
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </TabPlaceholder>
  );
}
