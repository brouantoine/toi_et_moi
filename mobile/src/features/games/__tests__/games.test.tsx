import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { elapsedParts, HomeSections } from '@/features/home/HomeSections';
import { PremiumScreen } from '@/features/premium/PremiumScreen';
import i18n from '@/i18n';
import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { GamesScreen } from '../GamesScreen';
import { answerLabel, QuestionScreen } from '../QuestionScreen';
import { isGamesHome, topicOf, type Question } from '../useGames';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));

const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);
const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);

function question(fields: Partial<Question> = {}): Question {
  return {
    id: 'travel-1',
    topic: 'travel',
    kind: 'this_or_that',
    text: 'Voyage organisé ou à l’aventure ?',
    options: ['Organisé', 'À l’aventure'],
    adult: false,
    state: 'new',
    mine: null,
    theirs: null,
    match: null,
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
  daily: [question(), question({ id: 'food-1', topic: 'food', text: 'Sucré ou salé ?' })],
  your_turn: [question({ id: 'money-1', topic: 'money', kind: 'agree', state: 'your_turn' })],
  your_turn_count: 1,
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
  kinds: [{ slug: 'this_or_that', name: 'Ça ou ça ?', total: 20 }],
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

function backend(questions: Question[], answered?: Question) {
  return mockFetch().mockImplementation(async (input) => {
    const url = urlOf(input);
    if (url.includes('/games/answers/')) return jsonResponse(answered ?? questions[0], 201);
    if (url.includes('/games/home/')) return jsonResponse(home);
    if (url.includes('/games/questions/')) return jsonResponse(questions);
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

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

describe('helpers', () => {
  const names = { me: 'Antoine', partner: 'Sam' };

  it('puts answers into words, "who is most likely" as a first name', () => {
    expect(answerLabel(question(), { choice: 1 }, 'me', names)).toBe('À l’aventure');
    const likely = question({ kind: 'most_likely', options: ['Moi', 'Toi'] });
    expect(answerLabel(likely, { choice: 0 }, 'me', names)).toBe('Antoine');
    expect(answerLabel(likely, { choice: 1 }, 'me', names)).toBe('Sam');
    expect(answerLabel(likely, { choice: 0 }, 'partner', names)).toBe('Sam');
    expect(answerLabel(likely, { choice: 1 }, 'partner', names)).toBe('Antoine');
    const talk = question({ kind: 'conversation', options: [] });
    expect(answerLabel(talk, { text: 'Zanzibar' }, 'partner', names)).toBe('Zanzibar');
  });

  it('knows a question’s topic, a valid home and elapsed time', () => {
    expect(topicOf('knowyou-12')).toBe('knowyou');
    expect(isGamesHome(home)).toBe(true);
    expect(isGamesHome({ date: '2026-11-07' })).toBe(false);
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
  it('lists kinds, today’s pair and topics with their progress', async () => {
    backend([]);
    await renderWithProviders(<GamesScreen />);
    expect(await screen.findByTestId('kind-this_or_that')).toBeTruthy();
    expect(screen.getByTestId('question-travel-1')).toBeTruthy();
    expect(screen.getByTestId('question-food-1')).toBeTruthy();
    expect(screen.getByLabelText('Voyage, 3 sur 6 terminées')).toBeTruthy();
    expect(screen.getByLabelText('Sexe et amour, Verrouillé')).toBeTruthy();
    expect(screen.getByText('À toi de jouer (1)')).toBeTruthy();
    expect(screen.getByLabelText(/^Série de 4 jours\. Jouez tous les deux/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('topic-travel'));
    expect(routerMock().push).toHaveBeenCalledWith('/games/list?topic=travel');
    await fireEvent.press(screen.getByTestId('question-travel-1'));
    expect(routerMock().push).toHaveBeenCalledWith('/games/travel-1');
  });
});

describe('QuestionScreen', () => {
  it('answers in one tap and then waits for the other', async () => {
    const waiting = question({ state: 'waiting', mine: { choice: 1, text: '' } });
    const fetchMock = backend([question()], waiting);
    await renderWithProviders(<QuestionScreen questionId="travel-1" />);
    await fireEvent.press(await screen.findByTestId('question-option-1'));
    const post = await waitFor(() => {
      const call = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'POST');
      expect(call).toBeTruthy();
      return call![0];
    });
    expect(await requestBody(post)).toEqual({ question: 'travel-1', choice: 1 });
  });

  it('never shows the other’s answer before mine', async () => {
    backend([question({ state: 'your_turn' })]);
    await renderWithProviders(<QuestionScreen questionId="travel-1" />);
    expect(await screen.findByTestId('question-hidden-hint')).toBeTruthy();
    expect(screen.queryByTestId('question-reveal')).toBeNull();
  });

  it('shows my answer while waiting, then both with a gentle outcome', async () => {
    backend([question({ state: 'waiting', mine: { choice: 0, text: '' } })]);
    await renderWithProviders(<QuestionScreen questionId="travel-1" />);
    expect(await screen.findByTestId('question-waiting')).toBeTruthy();
    expect(screen.getByText('Organisé')).toBeTruthy();

    backend([
      question({
        state: 'done',
        mine: { choice: 0, text: '' },
        theirs: { choice: 1, text: '' },
        match: false,
      }),
    ]);
    await renderWithProviders(<QuestionScreen questionId="travel-1" />);
    expect(await screen.findByTestId('question-differ')).toBeTruthy();
    expect(screen.getByText('À l’aventure')).toBeTruthy();
  });

  it('sends a written answer for a conversation', async () => {
    const talk = question({ kind: 'conversation', options: [] });
    const fetchMock = backend([talk], {
      ...talk,
      state: 'waiting',
      mine: { choice: null, text: 'Zanzibar' },
    });
    await renderWithProviders(<QuestionScreen questionId="travel-1" />);
    await fireEvent.changeText(await screen.findByTestId('question-text'), ' Zanzibar ');
    await fireEvent.press(screen.getByTestId('question-send'));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'POST')).toBe(true),
    );
    const post = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'POST')![0];
    expect(await requestBody(post)).toEqual({ question: 'travel-1', text: 'Zanzibar' });
  });
});

describe('home sections', () => {
  it('shows activities, notes, your turn, the counter and the numbers', async () => {
    backend([]);
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
    const fetchMock = backend([]);
    await renderWithProviders(<HomeSections />);
    await fireEvent.press(await screen.findByTestId('note-create'));
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Fleurs');
    await fireEvent.press(screen.getByTestId('note-color-sage'));
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'POST')).toBe(true),
    );
    const post = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'POST')![0];
    expect(await requestBody(post)).toEqual({ text: 'Fleurs', color: 'sage' });
  });
});

describe('PremiumScreen', () => {
  it('offers one purchase for two and says purchases are not open yet', async () => {
    backend([]);
    await renderWithProviders(<PremiumScreen />);
    expect(await screen.findByText('Sam n’a pas à payer')).toBeTruthy();
    expect(screen.getByTestId('premium-plan-yearly').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByTestId('premium-continue'));
    expect(screen.getByTestId('premium-not-yet')).toBeTruthy();
  });
});
