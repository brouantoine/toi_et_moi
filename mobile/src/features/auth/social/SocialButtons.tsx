import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api';
import { Button, Text, useTheme } from '@/ui';
import { MIN_TOUCH_TARGET } from '@/ui/tokens';

import { isAppleAvailable, isGoogleConfigured } from './providers';
import { useSocialLogin } from './useSocialLogin';

/** Apple (iOS, native button per Apple guidelines) and Google sign-in, when available. */
export function SocialButtons() {
  const { t } = useTranslation();
  const { scheme, radii, spacing } = useTheme();
  const social = useSocialLogin();
  const [apple, setApple] = useState(false);
  const google = isGoogleConfigured();

  useEffect(() => {
    let mounted = true;
    void isAppleAvailable().then((available) => mounted && setApple(available));
    return () => {
      mounted = false;
    };
  }, []);

  if (!apple && !google) return null;

  const errorCode = social.error instanceof ApiError ? social.error.code : null;
  const errorText = social.error
    ? t(`auth.social.errors.${errorCode ?? 'generic'}`, { defaultValue: t('errors.generic') })
    : null;

  return (
    <View style={{ gap: spacing.md }} testID="social-buttons">
      <Text muted style={styles.center}>
        {t('auth.social.or')}
      </Text>
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          testID="social-apple"
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radii.pill}
          style={styles.apple}
          onPress={() => social.mutate('apple')}
        />
      ) : null}
      {google ? (
        <Button
          testID="social-google"
          variant="secondary"
          label={t('auth.social.google')}
          loading={social.isPending && social.variables === 'google'}
          onPress={() => social.mutate('google')}
        />
      ) : null}
      {errorText ? (
        <Text accessibilityRole="alert" testID="social-error">
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  apple: { height: MIN_TOUCH_TARGET, width: '100%' },
});
