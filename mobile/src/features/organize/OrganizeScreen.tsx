import { useRouter } from 'expo-router';
import { CalendarDays, CloudOff, ListChecks, Plus, Sparkle, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnline } from '@/api/offline';
import { Chip, IconButton, Notice, Text, useTheme } from '@/ui';

import { AgendaView } from './agenda/AgendaView';
import { BudgetView } from './budget/BudgetView';
import { ChoresView } from './chores/ChoresView';
import { ListsView } from './lists/ListsView';

type Section = 'agenda' | 'lists' | 'chores' | 'budget';
const SECTIONS = [
  { key: 'agenda', icon: CalendarDays },
  { key: 'lists', icon: ListChecks },
  { key: 'chores', icon: Sparkle },
  { key: 'budget', icon: Wallet },
] as const;

/** The shared mental load: calendar, lists, chores and budget, in one calm place. */
export function OrganizeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [section, setSection] = useState<Section>('agenda');
  const online = useOnline();

  return (
    <SafeAreaView
      testID="tab-organize"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
        ]}
      >
        <View style={styles.flex}>
          <Text variant="overline" color="primary">
            {t('organize.eyebrow')}
          </Text>
          <Text variant="title">{t('tabs.organize.title')}</Text>
        </View>
        {section === 'agenda' ? (
          <IconButton
            testID="agenda-add"
            icon={Plus}
            variant="primary"
            label={t('organize.agenda.add')}
            onPress={() => router.push('/organize/event/new')}
          />
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={{
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.smd,
        }}
      >
        {SECTIONS.map(({ key, icon }) => (
          <Chip
            key={key}
            testID={`organize-section-${key}`}
            label={t(`organize.sections.${key}`)}
            icon={icon}
            selected={section === key}
            onPress={() => setSection(key)}
          />
        ))}
      </ScrollView>
      {online ? null : (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Notice testID="organize-offline" icon={CloudOff} message={t('organize.offline')} />
        </View>
      )}
      {section === 'agenda' ? (
        <AgendaView />
      ) : section === 'lists' ? (
        <ListsView />
      ) : section === 'chores' ? (
        <ChoresView />
      ) : (
        <BudgetView />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  chips: { flexGrow: 0 },
});
