import { useRouter } from 'expo-router';
import { HeartHandshake, PartyPopper } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet } from 'react-native';

import { ApiError } from '@/api';
import { BRAND } from '@/config/brand';
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/ui';

import { joinLink } from './inviteLink';
import {
  useCancelPendingCouple,
  useCouple,
  useCreateCouple,
  useNewInvitation,
  type Couple,
} from './useCouple';

function InvitationCard({ couple }: { couple: Couple }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const renew = useNewInvitation();
  const cancel = useCancelPendingCouple();
  const invitation = couple.invitation as { code: string; expires_at: string } | null;

  if (!invitation) {
    return (
      <Button
        testID="couple-new-code"
        label={t('couple.pending.newCode')}
        loading={renew.isPending}
        onPress={() => renew.mutate(undefined)}
      />
    );
  }

  const expires = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(invitation.expires_at));
  const link = joinLink(invitation.code);

  return (
    <>
      <Card>
        <Text variant="heading">{t('couple.pending.title')}</Text>
        <Text muted>{t('couple.pending.explain')}</Text>
        <Text
          testID="couple-code"
          accessibilityLabel={t('couple.pending.codeLabel', {
            code: invitation.code.split('').join(' '),
          })}
          style={[styles.code, { color: colors.primary }]}
        >
          {invitation.code}
        </Text>
        <Text variant="caption" muted>
          {t('couple.pending.expires', { date: expires })}
        </Text>
      </Card>
      <Button
        testID="couple-share"
        label={t('couple.pending.share')}
        onPress={() =>
          void Share.share({
            message: t('couple.pending.shareMessage', {
              code: invitation.code,
              link,
              brand: BRAND.name,
            }),
          })
        }
      />
      <Text muted>{t('couple.pending.waiting')}</Text>
      <Button
        testID="couple-new-code"
        variant="ghost"
        label={t('couple.pending.newCode')}
        loading={renew.isPending}
        onPress={() => renew.mutate(undefined)}
      />
      <Button
        testID="couple-cancel"
        variant="ghost"
        label={t('couple.pending.cancel')}
        loading={cancel.isPending}
        onPress={() => cancel.mutate(undefined)}
      />
    </>
  );
}

export function CoupleSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const couple = useCouple({ pollWhilePending: true });
  const create = useCreateCouple();

  if (couple.isPending) return <LoadingState testID="couple-loading" />;
  if (couple.isError) {
    const code = couple.error instanceof ApiError ? couple.error.code : 'network';
    return <ErrorState code={code} onRetry={() => void couple.refetch()} />;
  }

  if (couple.data?.status === 'active') {
    return (
      <Screen testID="couple-active">
        <EmptyState
          icon={PartyPopper}
          title={t('couple.active.title')}
          message={t('couple.active.message')}
          actionLabel={t('couple.active.continue')}
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="couple-setup">
      {couple.data?.status === 'pending' ? (
        <InvitationCard couple={couple.data} />
      ) : (
        <>
          <EmptyState
            icon={HeartHandshake}
            title={t('couple.setup.title')}
            message={t('couple.setup.message')}
          />
          <Button
            testID="couple-create"
            label={t('couple.setup.create')}
            loading={create.isPending}
            onPress={() => create.mutate({})}
          />
          <Button
            testID="couple-have-code"
            variant="secondary"
            label={t('couple.setup.haveCode')}
            onPress={() => router.push('/couple/join')}
          />
          {create.isError ? <Text accessibilityRole="alert">{t('errors.generic')}</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 40, lineHeight: 52, fontWeight: '700', letterSpacing: 8, textAlign: 'center' },
});
