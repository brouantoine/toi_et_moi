import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { elapsedParts, HomeSections } from '@/features/home/HomeSections';
import { PremiumScreen } from '@/features/premium/PremiumScreen';
import i18n from '@/i18n';
import { palettes } from '@/ui';
import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { GamesScreen } from '../GamesScreen';
import { PackListScreen } from '../PackListScreen';
import { DrawingView } from '../Drawing';
import { PlayScreen } from '../PlayScreen';
import { isGamesHome, type Pack, type PackDetail, type PackItem } from '../useGames';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));

const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);
const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);
const ART = 'http://api.test/static/games/art/eyes.webp';

function pack(fields: Partial<Pack> = {}): Pack {
  return {
    id: 'vie-quotidienne',
    kind: 'never',
    kind_name: 'Je n’ai jamais',
    title: 'Vie quotidienne',
    art: ART,
    topics: ['lifestyle'],
    tags: [],
    adult: false,
    premium: false,
    locked: false,
    position: 0,
    total: 2,
    mine: 0,
    theirs: 0,
    state: 'new',
    similarity: null,
    ...fields,
  };
}

function item(fields: Partial<PackItem> = {}): PackItem {
  return {
    id: 'vie-quotidienne.1',
    text: 'Je n’ai jamais pris de train de nuit.',
    options: [
      { name: 'Je n’ai jamais !', art: null },
      { name: 'J’ai déjà !', art: null },
    ],
    mine: null,
    partner_answered: false,
    theirs: null,
    match: null,
    ...fields,
  };
}

const given = (choice: number | null, extra: Partial<PackItem['mine']> = {}) => ({
  choice,
  text: '',
  drawing: [],
  photo_url: null,
  skipped: false,
  ...extra,
});

function detail(fields: Partial<PackDetail> = {}): PackDetail {
  return {
    ...pack(),
    mode: 'choice',
    items: [item(), item({ id: 'vie-quotidienne.2', text: 'Je n’ai jamais dormi dehors.' })],
    ...fields,
  };
}

const me = { id: 1, display_name: 'Antoine', language: 'fr' };
const couple = {
  id: 3,
  status: 'active',
  start_date: '2026-08-02',
  accent: 'rouge',
  members: [
    { id: 1, display_name: 'Antoine', avatar_url: null },
    { id: 2, display_name: 'Sam', avatar_url: null },
  ],
};
const home = {
  daily: [pack(), pack({ id: 'qui-cuisine', kind: 'most_likely', title: 'Qui cuisine ?' })],
  your_turn: [pack({ id: 'argent', kind: 'agree', state: 'your_turn', theirs: 2 })],
  your_turn_count: 1,
  waiting_count: 2,
  done_count: 0,
  topics: [
    { slug: 'travel', name: 'Voyage', adult: false, locked: false, total: 6, done: 3, percent: 50 },
    {
      slug: 'intimacy',
      name: 'Sexe et amour',
      adult: true,
      locked: true,
      total: 6,
      done: 0,
      percent: 0,
    },
  ],
  kinds: [{ slug: 'never', name: 'Je n’ai jamais', total: 22 }],
  adult: { mine: false, partner: false },
  streak: { count: 4, today_done: false },
  stats: {
    days_together: 100,
    answered_percent: 4,
    answered: 3,
    memories: 2,
    events: 5,
    messages: 40,
    notes: 1,
  },
};

function backend(
  opts: {
    detail?: PackDetail | (() => PackDetail);
    answered?: PackItem;
    list?: Pack[];
    hidden?: number;
  } = {},
) {
  return mockFetch().mockImplementation(async (input) => {
    const url = urlOf(input);
    if (url.includes('/games/answers/')) return jsonResponse(opts.answered ?? item(), 201);
    if (url.includes('/games/home/')) return jsonResponse(home);
    if (url.includes('/games/packs/?') || url.endsWith('/games/packs/'))
      return jsonResponse({ packs: opts.list ?? [pack()], adult_hidden: opts.hidden ?? 0 });
    if (url.includes('/games/packs/')) {
      const current = typeof opts.detail === 'function' ? opts.detail() : opts.detail;
      return jsonResponse(current ?? detail());
    }
    if (url.includes('/notes/')) {
      return methodOf(input) === 'POST'
        ? jsonResponse({ id: 9, text: 'Fleurs', color: 'sage', author: 'me' }, 201)
        : jsonResponse([{ id: 1, text: 'Je t’aime', color: 'red', author: 'you' }]);
    }
    if (url.endsWith('/me/')) return jsonResponse(me);
    if (url.endsWith('/couple/')) return jsonResponse(couple);
    return jsonResponse({}, 404);
  });
}

async function lastPost(fetchMock: ReturnType<typeof backend>) {
  const call = await waitFor(() => {
    const found = fetchMock.mock.calls.filter(([i]) => methodOf(i) === 'POST').pop();
    expect(found).toBeTruthy();
    return found!;
  });
  return requestBody(call[0]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

describe('helpers', () => {
  it('knows a valid home and elapsed time', () => {
    expect(isGamesHome(home)).toBe(true);
    expect(isGamesHome({ date: '2026-11-07' })).toBe(false);
    // A home cached before packs existed (questions without tags) is ignored.
    expect(isGamesHome({ ...home, daily: [{ id: 'travel-1' }] })).toBe(false);
    const start = new Date(2026, 7, 2).getTime();
    expect(elapsedParts('2026-08-02', start + (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });
});

describe('GamesScreen', () => {
  it('lists kinds, today’s packs, filters with counts and topics', async () => {
    backend();
    await renderWithProviders(<GamesScreen />);
    expect(await screen.findByTestId('kind-never')).toBeTruthy();
    expect(screen.getByTestId('pack-vie-quotidienne')).toBeTruthy();
    expect(screen.getByTestId('pack-qui-cuisine')).toBeTruthy();
    expect(screen.getByLabelText('Voyage, 3 sur 6 terminés')).toBeTruthy();
    expect(screen.getByLabelText('Sexe et amour, Verrouillé')).toBeTruthy();
    expect(screen.getByText('À toi de jouer (1)')).toBeTruthy();
    expect(screen.getByText('Répondu (2)')).toBeTruthy();
    expect(screen.getByLabelText(/^Série de 4 jours\. Jouez tous les deux/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('topic-travel'));
    expect(routerMock().push).toHaveBeenCalledWith('/games/list?topic=travel');
    await fireEvent.press(screen.getByTestId('pack-vie-quotidienne'));
    expect(routerMock().push).toHaveBeenCalledWith('/games/vie-quotidienne');
    await fireEvent.press(screen.getByTestId('games-search'));
    expect(routerMock().push).toHaveBeenCalledWith('/games/list?search=1');
  });

  it('sends a locked premium pack to the premium screen', async () => {
    backend();
    const { PackCard } = jest.requireActual('../PackCard');
    await renderWithProviders(<PackCard pack={pack({ locked: true, premium: true })} />);
    expect(await screen.findByText('Débloquer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pack-vie-quotidienne'));
    expect(routerMock().push).toHaveBeenCalledWith('/premium');
  });
});

describe('PackListScreen', () => {
  it('shows packs with their badges and the 18+ gate when some are hidden', async () => {
    backend({
      list: [pack({ tags: [{ slug: 'money', name: 'Argent' }] })],
      hidden: 2,
    });
    await renderWithProviders(<PackListScreen />);
    expect(await screen.findByTestId('pack-vie-quotidienne')).toBeTruthy();
    expect(screen.getByText('Argent')).toBeTruthy();
    expect(screen.getByTestId('adult-gate')).toBeTruthy();
  });
});

describe('PlayScreen', () => {
  it('answers item by item with the progress, in one tap', async () => {
    let answered = false;
    const fetchMock = backend({
      answered: item({ mine: given(1) }),
      detail: () => {
        const fresh = detail();
        if (!answered) return fresh;
        return { ...fresh, mine: 1, items: [item({ mine: given(1) }), fresh.items[1]!] };
      },
    });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    expect(await screen.findByText('Je n’ai jamais · 1 / 2')).toBeTruthy();
    answered = true;
    await fireEvent.press(screen.getByTestId('option-1'));
    expect(await lastPost(fetchMock)).toEqual({
      question: 'vie-quotidienne.1',
      choice: 1,
      skipped: false,
    });
    expect(await screen.findByText('Je n’ai jamais · 2 / 2')).toBeTruthy();
  });

  it('sends a locked pack to premium instead of letting me answer', async () => {
    backend({ detail: detail({ locked: true, premium: true }) });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    expect(await screen.findByTestId('pack-locked')).toBeTruthy();
    expect(screen.queryByTestId('option-0')).toBeNull();
    await fireEvent.press(screen.getByTestId('pack-unlock'));
    expect(routerMock().push).toHaveBeenCalledWith('/premium');
  });

  it('shows a calm message for a kind of game this version cannot play', async () => {
    backend({ detail: detail({ mode: 'video' as PackDetail['mode'] }) });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    expect(await screen.findByTestId('pack-unsupported')).toBeTruthy();
  });

  it('keeps the drawing paper white in night mode and survives a malformed drawing', async () => {
    const strokes = [{ c: 0, w: 8, p: [10, 10, 500, 500] }];
    await renderWithProviders(
      <>
        <DrawingView testID="good" strokes={strokes} size={100} />
        <DrawingView testID="bad" strokes={null} size={100} />
        <DrawingView testID="partial" strokes={[{ c: 1 }, ...strokes]} size={100} />
      </>,
      'dark',
    );
    expect(screen.getByTestId('good')).toHaveStyle({ backgroundColor: palettes.light.surface });
    expect(screen.getByTestId('bad')).toBeTruthy();
    expect(screen.getByTestId('partial')).toBeTruthy();
  });

  it('can skip an item', async () => {
    const fetchMock = backend({ answered: item({ mine: given(null, { skipped: true }) }) });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    await fireEvent.press(await screen.findByTestId('answer-skip'));
    expect(await lastPost(fetchMock)).toEqual({ question: 'vie-quotidienne.1', skipped: true });
  });

  it('puts both avatars on "who is most likely" and says the partner already played', async () => {
    backend({
      detail: detail({
        kind: 'most_likely',
        kind_name: 'Qui est le plus ?',
        items: [
          item({
            text: 'Qui cuisine ?',
            partner_answered: true,
            options: [
              { name: 'Moi', art: null },
              { name: 'Toi', art: null },
            ],
          }),
        ],
      }),
    });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    expect(await screen.findByTestId('partner-answered')).toBeTruthy();
    expect((await screen.findAllByLabelText('Antoine')).length).toBeGreaterThan(0);
    expect((await screen.findAllByLabelText('Sam')).length).toBeGreaterThan(0);
  });

  it('sends a written answer for a conversation', async () => {
    const fetchMock = backend({
      detail: detail({ kind: 'conversation', mode: 'text', items: [item({ options: [] })] }),
    });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    await fireEvent.changeText(await screen.findByTestId('answer-text'), ' Zanzibar ');
    await fireEvent.press(screen.getByTestId('answer-send'));
    expect(await lastPost(fetchMock)).toEqual({
      question: 'vie-quotidienne.1',
      text: 'Zanzibar',
      skipped: false,
    });
  });

  it('waits for the partner once I finished, without showing their answers', async () => {
    backend({
      detail: detail({
        state: 'waiting',
        mine: 2,
        items: [
          item({ mine: given(0), partner_answered: false }),
          item({ id: 'vie-quotidienne.2', mine: given(1) }),
        ],
      }),
    });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    expect(await screen.findByTestId('pack-waiting')).toBeTruthy();
    expect(screen.queryByTestId('similarity')).toBeNull();
  });

  it('shows the similarity and both answers once we both finished', async () => {
    backend({
      detail: detail({
        state: 'done',
        mine: 2,
        theirs: 2,
        similarity: 50,
        items: [
          item({ mine: given(0), theirs: given(0), match: true }),
          item({ id: 'vie-quotidienne.2', mine: given(1), theirs: given(0), match: false }),
        ],
      }),
    });
    await renderWithProviders(<PlayScreen packId="vie-quotidienne" />);
    expect(await screen.findByLabelText('50 % de réponses en commun')).toBeTruthy();
    expect(screen.getByTestId('result-vie-quotidienne.2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pack-talk'));
    expect(routerMock().push).toHaveBeenCalledWith('/us');
  });
});

describe('home sections', () => {
  it('shows activities, notes, your turn, the counter and the numbers', async () => {
    backend();
    await renderWithProviders(<HomeSections />);
    expect(await screen.findByTestId('home-daily')).toBeTruthy();
    expect(screen.getByTestId('home-your-turn')).toBeTruthy();
    expect(await screen.findByText('Je t’aime')).toBeTruthy();
    expect(screen.getByTestId('stat-days_together')).toHaveTextContent(/100/);
    expect(screen.getByLabelText('40 Messages échangés')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('shortcut-coach'));
    expect(routerMock().push).toHaveBeenCalledWith('/coach');
    await fireEvent.press(screen.getByTestId('shortcut-journal'));
    expect(routerMock().push).toHaveBeenCalledWith('/memories');
    await fireEvent.press(screen.getByTestId('home-premium'));
    expect(routerMock().push).toHaveBeenCalledWith('/premium');
  });

  it('adds a note from the sheet', async () => {
    const fetchMock = backend();
    await renderWithProviders(<HomeSections />);
    await fireEvent.press(await screen.findByTestId('note-create'));
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Fleurs');
    await fireEvent.press(screen.getByTestId('note-color-sage'));
    await fireEvent.press(screen.getByTestId('note-save'));
    expect(await lastPost(fetchMock)).toEqual({ text: 'Fleurs', color: 'sage' });
  });
});

describe('PremiumScreen', () => {
  it('says plainly that purchases open with the installed app, with the legal links', async () => {
    backend();
    await renderWithProviders(<PremiumScreen />);
    expect(await screen.findByText('Sam n’a pas à payer')).toBeTruthy();
    expect(screen.getByTestId('premium-not-yet')).toBeTruthy();
    expect(screen.queryByTestId('premium-continue')).toBeNull();
    expect(screen.getByTestId('premium-terms')).toBeTruthy();
    expect(screen.getByTestId('premium-privacy')).toBeTruthy();
    expect(screen.getByTestId('premium-eula')).toBeTruthy();
  });
});
