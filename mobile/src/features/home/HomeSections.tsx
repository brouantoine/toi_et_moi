import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/useCouple';
import { usePartner } from '@/features/couple/usePartner';
import { EMOJI } from '@/features/games/art';
import { SectionTitle, StreakBadge } from '@/features/games/GamesScreen';
import { PackCard } from '@/features/games/PackCard';
import {
  useGamesHome,
  useNoteActions,
  useNotes,
  type GamesHome,
  type Note,
} from '@/features/games/useGames';
import {
  Button,
  FadeIn,
  Icon,
  Input,
  Notice,
  PressableScale,
  Sheet,
  Text,
  useTheme,
  type Hue,
} from '@/ui';

type Shortcut = { id: string; image: number; hue: Hue; route?: string; soon?: string };

const SHORTCUTS: readonly Shortcut[] = [
  { id: 'journal', image: EMOJI.camera, hue: 'amber', route: '/memories' },
  { id: 'messages', image: EMOJI.conversation, hue: 'violet', route: '/us' },
  { id: 'coach', image: EMOJI.robot, hue: 'lagoon', route: '/coach' },
  { id: 'calls', image: EMOJI.phone, hue: 'sage', soon: 'home.callsSoon' },
  { id: 'organize', image: EMOJI.calendar, hue: 'red', route: '/organize' },
];

function Shortcuts() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hues, radii, spacing } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.smd }}
    >
      {SHORTCUTS.map((item) => (
        <PressableScale
          key={item.id}
          testID={`shortcut-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={
            item.soon ? `${t(`home.${item.id}`)}, ${t('home.soon')}` : t(`home.${item.id}`)
          }
          onPress={() =>
            item.route
              ? router.push(item.route as never)
              : Alert.alert(t('home.soonTitle'), t(item.soon ?? ''))
          }
          style={[
            styles.shortcut,
            { backgroundColor: hues[item.hue].bg, borderRadius: radii.xl, padding: spacing.smd },
          ]}
        >
          <Image source={item.image} style={styles.shortcutArt} contentFit="contain" />
          <Text variant="caption" style={styles.bold} numberOfLines={1}>
            {t(`home.${item.id}`)}
          </Text>
          {item.soon ? (
            <Text variant="caption" style={{ color: hues[item.hue].fg }} numberOfLines={1}>
              {t('home.soon')}
            </Text>
          ) : null}
        </PressableScale>
      ))}
    </ScrollView>
  );
}

function PremiumCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, radii, spacing } = useTheme();
  return (
    <PressableScale
      testID="home-premium"
      accessibilityRole="button"
      accessibilityLabel={`${t('home.premiumTitle')}. ${t('home.premiumText')}`}
      onPress={() => router.push('/premium')}
      style={[
        styles.premium,
        {
          backgroundColor: colors.primarySoft,
          borderRadius: radii.xl,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <Image source={EMOJI.crown} style={styles.shortcutArt} contentFit="contain" />
      <View style={styles.flex}>
        <Text variant="label" color="onPrimarySoft">
          {t('home.premiumTitle')}
        </Text>
        <Text variant="caption">{t('home.premiumText')}</Text>
      </View>
      <View
        style={[styles.premiumCta, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
      >
        <Text variant="caption" color="primary" style={styles.bold}>
          {t('home.premiumCta')}
        </Text>
        <Icon icon={ChevronRight} size={16} color="primary" strokeWidth={2.4} />
      </View>
    </PressableScale>
  );
}

type NoteColor = NonNullable<Note['color']>;

const NOTE_COLORS: readonly NoteColor[] = ['amber', 'red', 'sage', 'lagoon', 'violet'];

/** Spoken name of each note colour (the couple-colour names, already translated). */
const NOTE_COLOR_NAMES: Record<NoteColor, string> = {
  amber: 'ambre',
  red: 'rouge',
  sage: 'sauge',
  lagoon: 'lagon',
  violet: 'violet',
};

function NotesSection() {
  const { t } = useTranslation();
  const { colors, hues, radii, spacing } = useTheme();
  const { notes } = useNotes();
  const { add, remove } = useNoteActions();
  const partner = usePartner();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [color, setColor] = useState<NoteColor>('amber');

  const save = () =>
    add.mutate(
      { text: text.trim(), color },
      {
        onSuccess: () => {
          setText('');
          setOpen(false);
        },
      },
    );
  const confirmDelete = (note: Note) =>
    Alert.alert(t('notes.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => remove.mutate(note.id),
      },
    ]);
  // A tap reads the whole note (the card cuts it); my own notes can be deleted from there.
  const openNote = (note: Note) =>
    Alert.alert(
      note.author === 'me' ? t('notes.fromMe') : (partner?.display_name ?? t('notes.title')),
      note.text,
      note.author === 'me'
        ? [
            { text: t('common.close'), style: 'cancel' },
            {
              text: t('memories.detail.deleteConfirm'),
              style: 'destructive',
              onPress: () => confirmDelete(note),
            },
          ]
        : [{ text: t('common.close') }],
    );

  return (
    <View style={{ gap: spacing.smd }}>
      <SectionTitle title={t('notes.title')} hint={notes.length ? undefined : t('notes.empty')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.smd,
          paddingVertical: spacing.xs,
        }}
      >
        <PressableScale
          testID="note-create"
          accessibilityRole="button"
          accessibilityLabel={t('notes.create')}
          onPress={() => setOpen(true)}
          style={[
            styles.note,
            styles.center,
            { backgroundColor: colors.surfaceMuted, borderRadius: radii.xl, gap: spacing.xs },
          ]}
        >
          <Icon icon={Plus} size={28} color="text" strokeWidth={2.2} />
          <Text variant="label">{t('notes.create')}</Text>
        </PressableScale>
        {notes.map((note, index) => (
          <PressableScale
            key={note.id}
            testID={`note-${note.id}`}
            accessibilityRole="button"
            accessibilityLabel={note.text}
            onPress={() => openNote(note)}
            onLongPress={() => {
              if (note.author === 'me') confirmDelete(note);
            }}
            style={[
              styles.note,
              {
                backgroundColor: hues[note.color ?? 'amber'].bg,
                borderRadius: radii.xl,
                padding: spacing.md,
                transform: [{ rotate: index % 2 ? '1.5deg' : '-1.5deg' }],
              },
            ]}
          >
            <Text numberOfLines={5} style={{ color: hues[note.color ?? 'amber'].fg }}>
              {note.text}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('notes.newTitle')}
        testID="note-sheet"
      >
        <Input
          testID="note-text"
          label={t('notes.title')}
          placeholder={t('notes.placeholder')}
          value={text}
          onChangeText={setText}
          maxLength={280}
          multiline
        />
        <View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.smd }]}>
          {NOTE_COLORS.map((item) => (
            <PressableScale
              key={item}
              testID={`note-color-${item}`}
              accessibilityRole="radio"
              accessibilityLabel={`${t('notes.color')} ${t(`coupleInfo.colors.${NOTE_COLOR_NAMES[item]}`)}`}
              accessibilityState={{ checked: color === item }}
              onPress={() => setColor(item)}
              style={[
                styles.swatch,
                {
                  backgroundColor: hues[item].bg,
                  borderColor: color === item ? hues[item].fg : 'transparent',
                },
              ]}
            >
              <View />
            </PressableScale>
          ))}
        </View>
        {add.isError ? <Notice tone="warning" message={t('notes.error')} /> : null}
        <Button
          testID="note-save"
          label={t('notes.add')}
          disabled={!text.trim()}
          loading={add.isPending}
          onPress={save}
        />
      </Sheet>
    </View>
  );
}

/** Whole days, then h/min/s since the start date: a live "together for" counter. */
export function elapsedParts(startIso: string, now: number) {
  const [y, m, d] = startIso.split('-').map(Number);
  const start = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function TogetherTimer({ start }: { start: string }) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parts = elapsedParts(start, now);
  const cells: [number, string][] = [
    [parts.days, t('home.unitDays')],
    [parts.hours, t('home.unitHours')],
    [parts.minutes, t('home.unitMinutes')],
    [parts.seconds, t('home.unitSeconds')],
  ];
  return (
    <View
      testID="together-timer"
      style={[
        styles.widget,
        { backgroundColor: colors.surfaceMuted, borderRadius: radii.xl, padding: spacing.md },
      ]}
    >
      <Text variant="caption" muted style={styles.bold}>
        {t('home.togetherSince')}
      </Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {cells.map(([value, unit]) => (
          <View key={unit} style={styles.center}>
            <Text variant="heading" color="primary" style={styles.tabular}>
              {String(value).padStart(2, '0')}
            </Text>
            <Text variant="overline" muted>
              {unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type StatTile = { key: keyof GamesHome['stats']; label: string; image: number; hue: Hue };

const STATS: readonly StatTile[] = [
  { key: 'days_together', label: 'days', image: EMOJI.ring, hue: 'red' },
  { key: 'answered', label: 'answered', image: EMOJI.conversation, hue: 'amber' },
  { key: 'memories', label: 'memories', image: EMOJI.camera, hue: 'sage' },
  { key: 'events', label: 'events', image: EMOJI.calendar, hue: 'lagoon' },
  { key: 'messages', label: 'messages', image: EMOJI.heart, hue: 'violet' },
  { key: 'notes', label: 'notes', image: EMOJI.memo, hue: 'amber' },
];

function StatsGrid({ stats }: { stats: GamesHome['stats'] }) {
  const { t, i18n } = useTranslation();
  const { hues, radii, spacing } = useTheme();
  const format = new Intl.NumberFormat(i18n.language);
  return (
    <View style={{ gap: spacing.smd }}>
      <SectionTitle title={t('home.statsTitle')} />
      <View style={[styles.grid, { gap: spacing.smd }]}>
        {STATS.map((tile) => (
          <View
            key={tile.key}
            testID={`stat-${tile.key}`}
            accessible
            accessibilityLabel={`${stats[tile.key] ?? 0} ${t(`home.stats.${tile.label}`)}`}
            style={[
              styles.stat,
              { backgroundColor: hues[tile.hue].bg, borderRadius: radii.xl, padding: spacing.md },
            ]}
          >
            <Image source={tile.image} style={styles.statArt} contentFit="contain" />
            <Text variant="display" style={[styles.tabular, { color: hues[tile.hue].fg }]}>
              {format.format(stats[tile.key] ?? 0)}
            </Text>
            <Text variant="caption" style={[styles.bold, { color: hues[tile.hue].fg }]}>
              {t(`home.stats.${tile.label}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Everything under the couple on the home: shortcuts, today's activities, premium,
 * notes, "your turn", the live counter and the couple's numbers. Each block hides
 * itself when it has nothing to show.
 */
export function HomeSections() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { home } = useGamesHome();
  const couple = useCouple({ enabled: false });
  const start = couple.data?.start_date;
  return (
    <>
      <FadeIn delay={60}>
        <Shortcuts />
      </FadeIn>
      {home?.daily?.length ? (
        <FadeIn delay={120}>
          <View testID="home-daily" style={{ gap: spacing.smd }}>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <View style={styles.flex}>
                <SectionTitle title={t('games.dailyTitle')} hint={t('games.dailyHint')} />
              </View>
              {home.streak ? <StreakBadge streak={home.streak} /> : null}
            </View>
            {home.daily.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </View>
        </FadeIn>
      ) : null}
      <PremiumCard />
      <NotesSection />
      {home?.your_turn?.length ? (
        <View testID="home-your-turn" style={{ gap: spacing.smd }}>
          <SectionTitle title={t('games.yourTurnTitle')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.lg }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.smd }}
          >
            {home.your_turn.map((pack) => (
              <PackCard key={pack.id} pack={pack} width={300} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {start ? <TogetherTimer start={start} /> : null}
      {home?.stats ? <StatsGrid stats={home.stats} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  tabular: { fontVariant: ['tabular-nums'] },
  shortcut: { width: 96, height: 104, justifyContent: 'space-between', borderCurve: 'continuous' },
  shortcutArt: { width: 44, height: 44 },
  premium: { flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' },
  premiumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    gap: 2,
  },
  note: { width: 150, height: 150, borderCurve: 'continuous' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  widget: { gap: 8, borderCurve: 'continuous' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexBasis: '47%', flexGrow: 1, gap: 2, borderCurve: 'continuous' },
  statArt: { width: 44, height: 44, alignSelf: 'flex-end' },
});
