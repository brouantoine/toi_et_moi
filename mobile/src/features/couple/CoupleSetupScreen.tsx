import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { Check, Copy, HeartHandshake, PartyPopper, QrCode, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Share, StyleSheet, View } from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';

import { ApiError } from '@/api';
import { useSignOut } from '@/auth/useSignOut';
import { BRAND } from '@/config/brand';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  palettes,
  Screen,
  Text,
  useTheme,
} from '@/ui';

import {
  useCancelPendingCouple,
  useCouple,
  useCreateCouple,
  useNewInvitation,
  type Couple,
} from './useCouple';

/** Scanners need dark-on-white whatever the theme: always the light ink and paper. */
const QR_INK = palettes.light.text;
const QR_PAPER = palettes.light.surface;

type Invitation = NonNullable<Couple['invitation']>;

/** Opens the system share sheet with the web link (works even without the app). */
function shareInvitation(invitation: Invitation, t: TFunction) {
  void Share.share({
    message: t('couple.pending.shareMessage', {
      code: invitation.code,
      link: invitation.share_url,
      brand: BRAND.name,
    }),
  }).catch(() => {});
}

function InvitationCard({ couple }: { couple: Couple }) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const renew = useNewInvitation();
  const cancel = useCancelPendingCouple();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const invitation = couple.invitation;

  // Cancelling makes the code already sent useless: ask first.
  const confirmCancel = () =>
    Alert.alert(t('couple.pending.cancelTitle'), t('couple.pending.cancelMessage'), [
      { text: t('couple.pending.cancelKeep'), style: 'cancel' },
      {
        text: t('couple.pending.cancelConfirm'),
        style: 'destructive',
        onPress: () => cancel.mutate(undefined),
      },
    ]);
  const failed =
    renew.isError || cancel.isError ? (
      <Notice testID="couple-pending-error" tone="warning" message={t('errors.generic')} />
    ) : null;
  const cancelButton = (
    <Button
      testID="couple-cancel"
      variant="ghost"
      label={t('couple.pending.cancel')}
      loading={cancel.isPending}
      onPress={confirmCancel}
    />
  );

  // The code expired (48 h): say so, and offer a fresh one in one tap.
  if (!invitation) {
    return (
      <>
        <Card testID="couple-code-expired">
          <Text variant="heading">{t('couple.pending.expiredTitle')}</Text>
          <Text muted>{t('couple.pending.expiredMessage')}</Text>
        </Card>
        {failed}
        <Button
          testID="couple-new-code"
          size="lg"
          label={t('couple.pending.newCode')}
          loading={renew.isPending}
          onPress={() => renew.mutate(undefined)}
        />
        {cancelButton}
      </>
    );
  }

  const expires = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(invitation.expires_at));

  const copy = async () => {
    await Clipboard.setStringAsync(invitation.code).catch(() => false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
  };

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
        {showQr ? (
          <View
            testID="couple-qr"
            accessible
            accessibilityLabel={t('couple.pending.qrLabel')}
            style={[
              styles.qr,
              {
                backgroundColor: QR_PAPER,
                borderRadius: radii.lg,
                padding: spacing.md,
                marginTop: spacing.sm,
              },
            ]}
          >
            <QRCodeSvg
              value={invitation.share_url}
              size={184}
              color={QR_INK}
              backgroundColor={QR_PAPER}
            />
          </View>
        ) : null}
      </Card>
      <Button
        testID="couple-share"
        icon={Send}
        size="lg"
        label={t('couple.pending.share')}
        onPress={() => shareInvitation(invitation, t)}
      />
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.flex}>
          <Button
            testID="couple-copy"
            variant="soft"
            icon={copied ? Check : Copy}
            label={copied ? t('couple.pending.copied') : t('couple.pending.copy')}
            onPress={() => void copy()}
          />
        </View>
        <View style={styles.flex}>
          <Button
            testID="couple-qr-toggle"
            variant="soft"
            icon={QrCode}
            label={showQr ? t('couple.pending.hideQr') : t('couple.pending.showQr')}
            onPress={() => setShowQr((value) => !value)}
          />
        </View>
      </View>
      <Text muted>{t('couple.pending.waiting')}</Text>
      {failed}
      <Button
        testID="couple-new-code"
        variant="ghost"
        label={t('couple.pending.newCode')}
        loading={renew.isPending}
        onPress={() => renew.mutate(undefined)}
      />
      {cancelButton}
    </>
  );
}

export function CoupleSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const couple = useCouple({ pollWhilePending: true });
  const create = useCreateCouple();
  const signOut = useSignOut();
  // Asked right away: the days counter and the anniversaries need it (optional).
  const [startDate, setStartDate] = useState<string | null>(null);

  if (couple.isPending) return <LoadingState testID="couple-loading" />;
  if (couple.isError) {
    const code = couple.error instanceof ApiError ? couple.error.code : 'network';
    // Never a dead end: a person stuck offline here can still sign out.
    return (
      <Screen testID="couple-error">
        <ErrorState code={code} error={couple.error} onRetry={() => void couple.refetch()} />
        <Button
          testID="couple-sign-out"
          variant="ghost"
          label={t('me.signOut')}
          loading={signOut.isPending}
          onPress={() => signOut.mutate()}
        />
      </Screen>
    );
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
          <DateField
            testID="couple-setup-start-date"
            label={t('couple.setup.startDate')}
            value={startDate}
            onChange={setStartDate}
            maximumDate={new Date()}
            clearable
          />
          <Button
            testID="couple-create"
            icon={Send}
            size="lg"
            label={t('couple.setup.create')}
            loading={create.isPending}
            onPress={() =>
              create.mutate(
                { startDate },
                {
                  // One tap: the space is created and the share sheet opens right away.
                  onSuccess: (created) => {
                    if (created?.invitation) shareInvitation(created.invitation, t);
                  },
                },
              )
            }
          />
          <Button
            testID="couple-have-code"
            variant="secondary"
            label={t('couple.setup.haveCode')}
            onPress={() => router.push('/couple/join')}
          />
          {create.isError ? (
            <Notice testID="couple-create-error" tone="warning" message={t('errors.generic')} />
          ) : null}
        </>
      )}
      <Button
        testID="couple-sign-out"
        variant="ghost"
        label={t('me.signOut')}
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 40, lineHeight: 52, fontWeight: '700', letterSpacing: 8, textAlign: 'center' },
  qr: { alignSelf: 'center', borderCurve: 'continuous' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});
