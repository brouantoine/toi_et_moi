import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api';
import { Button, DateField, ErrorState, Input, LoadingState, Screen, Text } from '@/ui';

import { AccentPicker } from './AccentPicker';
import {
  useCouple,
  useCoupleAccent,
  useSetAccent,
  useUpdateCouple,
  type Couple,
} from './useCouple';

const CURRENCY_RE = /^[A-Z]{3}$/;

function CoupleInfoForm({ couple }: { couple: Couple }) {
  const { t } = useTranslation();
  const update = useUpdateCouple();
  const [startDate, setStartDate] = useState<string | null>(couple.start_date ?? null);
  const [currency, setCurrency] = useState(couple.currency ?? 'EUR');
  const currencyError = CURRENCY_RE.test(currency) ? undefined : t('coupleInfo.currencyInvalid');

  const partners = couple.members.map((m) => m.display_name).join(' & ');
  const accent = useCoupleAccent();
  const setAccent = useSetAccent();

  return (
    <Screen testID="couple-info-screen">
      <Text variant="title">{t('coupleInfo.title')}</Text>
      <Text muted>{partners}</Text>
      <AccentPicker value={accent} onChange={setAccent} />
      <DateField
        testID="couple-start-date"
        label={t('coupleInfo.startDate')}
        value={startDate}
        onChange={setStartDate}
        maximumDate={new Date()}
        clearable
      />
      <Input
        testID="couple-currency"
        label={t('coupleInfo.currency')}
        hint={t('coupleInfo.currencyHint')}
        value={currency}
        onChangeText={(v) =>
          setCurrency(
            v
              .toUpperCase()
              .replace(/[^A-Z]/g, '')
              .slice(0, 3),
          )
        }
        autoCapitalize="characters"
        autoCorrect={false}
        error={currencyError}
      />
      {update.isError ? (
        <Text accessibilityRole="alert">
          {t(update.error instanceof ApiError ? `errors.${update.error.code}` : 'errors.generic', {
            defaultValue: t('errors.generic'),
          })}
        </Text>
      ) : null}
      {update.isSuccess ? (
        <Text accessibilityLiveRegion="polite" testID="couple-saved">
          {t('common.saved')}
        </Text>
      ) : null}
      <Button
        testID="couple-save"
        label={t('common.save')}
        loading={update.isPending}
        onPress={() => {
          if (!currencyError) update.mutate({ start_date: startDate, currency });
        }}
      />
    </Screen>
  );
}

export function CoupleInfoScreen() {
  const couple = useCouple();
  if (couple.isPending) return <LoadingState />;
  if (couple.isError || !couple.data) {
    return (
      <ErrorState
        code={couple.error instanceof ApiError ? couple.error.code : 'not_found'}
        onRetry={() => void couple.refetch()}
      />
    );
  }
  return <CoupleInfoForm couple={couple.data} />;
}
