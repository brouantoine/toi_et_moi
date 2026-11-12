import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { useMessageActions, useMessages, type Message } from '@/features/messages/useMessages';
import { IconButton, Text, useTheme } from '@/ui';

const SHOWN = 4;

function preview(message: Message, t: (key: string) => string): string {
  if (message.kind === 'voice') return t('calls.chat.voice');
  if (message.kind === 'photo') return t('calls.chat.photo');
  return message.text;
}

/**
 * The conversation over the video, see-through but readable: the last messages and a
 * field to answer, without leaving the call.
 */
export function CallChat({ partnerName }: { partnerName: string }) {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const { messages } = useMessages();
  const { sendText } = useMessageActions();
  const [text, setText] = useState('');
  const latest = messages.slice(0, SHOWN).reverse();

  const send = () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    void sendText(clean).catch(() => setText((current) => current || clean));
  };

  return (
    <View
      testID="call-chat"
      style={[
        styles.panel,
        { backgroundColor: colors.scrim, borderRadius: radii.xl, padding: spacing.smd, gap: 6 },
      ]}
    >
      {latest.map((message) => (
        <Text key={message.id} numberOfLines={2} style={{ color: colors.onScrim }}>
          <Text style={[styles.who, { color: colors.onScrim }]}>
            {message.author === 'me' ? t('calls.chat.me') : partnerName}
            {' : '}
          </Text>
          {preview(message, t)}
        </Text>
      ))}
      <View style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          testID="call-chat-input"
          accessibilityLabel={t('calls.chat.label')}
          placeholder={t('calls.chat.placeholder')}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
          style={[
            styles.input,
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.pill,
              paddingHorizontal: spacing.md,
            },
          ]}
        />
        <IconButton
          testID="call-chat-send"
          icon={Send}
          variant="primary"
          label={t('calls.chat.send')}
          disabled={!text.trim()}
          onPress={send}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch' },
  who: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 44 },
});
