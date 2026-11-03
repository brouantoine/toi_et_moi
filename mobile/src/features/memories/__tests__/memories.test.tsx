import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import i18n from '@/i18n';
import { jsonResponse, mockFetch, renderWithProviders, routerMock } from '@/test-utils';

import { MemoriesScreen } from '../MemoriesScreen';
import { groupByMonth, railDate } from '../timeline';
import type { Memory } from '../useMemories';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 1,
    title: 'Premier café',
    body: '',
    happened_on: '2025-03-14',
    place: '',
    type: 'moment',
    tags: [],
    created_by: 1,
    photos: [],
    my_heart: false,
    partner_heart: false,
    created_at: '2025-03-14T10:00:00Z',
    updated_at: '2025-03-14T10:00:00Z',
    ...overrides,
  };
}

function photo(id: number) {
  return {
    id,
    url: `https://s3.test/p${id}.jpg`,
    thumbnail_url: `https://s3.test/p${id}_t.jpg`,
    width: 2048,
    height: 1536,
    position: id,
  };
}

function page(results: Memory[], next: string | null = null) {
  return jsonResponse({ next, previous: null, results });
}

function urlOf(arg: Request | string): URL {
  return new URL(typeof arg === 'string' ? arg : arg.url);
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  routerMock().push.mockClear();
});

describe('timeline helpers', () => {
  it('groups memories by month, keeping the API order', () => {
    const sections = groupByMonth(
      [
        memory({ id: 1, happened_on: '2025-03-20' }),
        memory({ id: 2, happened_on: '2025-03-02' }),
        memory({ id: 3, happened_on: '2024-12-31' }),
      ],
      'fr',
    );
    expect(sections.map((s) => [s.key, s.title, s.data.map((m) => m.id)])).toEqual([
      ['2025-03', 'Mars 2025', [1, 2]],
      ['2024-12', 'Décembre 2024', [3]],
    ]);
  });

  it('localizes month titles in English', () => {
    expect(groupByMonth([memory()], 'en')[0]?.title).toBe('March 2025');
  });

  it('gives the day and short weekday for the rail, without timezone shift', () => {
    expect(railDate('2025-03-14', 'en')).toEqual({ day: '14', weekday: 'Fri' });
    expect(railDate('2024-02-29', 'fr').day).toBe('29');
  });
});

describe('MemoriesScreen', () => {
  it('shows a skeleton while loading', async () => {
    const fetch = mockFetch();
    fetch.mockReturnValue(new Promise(() => {}));
    await renderWithProviders(<MemoriesScreen />);
    expect(screen.getByTestId('memories-loading')).toBeTruthy();
  });

  it('shows a kind empty state with an action to add the first memory', async () => {
    mockFetch().mockResolvedValue(page([]));
    await renderWithProviders(<MemoriesScreen />);
    expect(await screen.findByTestId('memories-empty')).toBeTruthy();
    expect(screen.getByText('Votre premier souvenir vous attend')).toBeTruthy();
    await fireEvent.press(
      within(screen.getByTestId('memories-empty')).getByRole('button', {
        name: 'Ajouter un souvenir',
      }),
    );
    expect(routerMock().push).toHaveBeenCalledWith('/memories/new');
  });

  it('shows a calm error state and retries', async () => {
    const fetch = mockFetch();
    fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithProviders(<MemoriesScreen />);
    expect(await screen.findByTestId('memories-error')).toBeTruthy();

    fetch.mockResolvedValueOnce(page([memory()]));
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('memory-card-1')).toBeTruthy();
  });

  it('renders the timeline grouped by month and opens a memory', async () => {
    mockFetch().mockResolvedValue(
      page([
        memory({
          id: 7,
          title: 'Le lac au lever du jour',
          body: 'On avait froid, on riait.',
          place: 'Annecy',
          type: 'place',
          photos: [photo(1), photo(2), photo(3)],
        }),
        memory({ id: 8, title: 'Notre première dispute idiote', happened_on: '2024-11-02' }),
      ]),
    );
    await renderWithProviders(<MemoriesScreen />);

    expect(await screen.findByText('Le lac au lever du jour')).toBeTruthy();
    expect(screen.getByTestId('memories-month-2025-03')).toHaveTextContent('Mars 2025');
    expect(screen.getByTestId('memories-month-2024-11')).toHaveTextContent('Novembre 2024');
    expect(screen.getByText('Annecy')).toBeTruthy();
    expect(screen.getByLabelText('2 autres photos')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('memory-card-7'));
    expect(routerMock().push).toHaveBeenCalledWith('/memories/7');
  });

  it('shows quotes as quotes, without cover photo', async () => {
    mockFetch().mockResolvedValue(
      page([
        memory({
          id: 9,
          type: 'quote',
          title: 'Dans la voiture',
          body: 'On ne se perd pas, on visite.',
          photos: [photo(1)],
        }),
      ]),
    );
    await renderWithProviders(<MemoriesScreen />);
    expect(await screen.findByText('On ne se perd pas, on visite.')).toBeTruthy();
    expect(screen.queryByLabelText(/autres? photos?/)).toBeNull();
  });

  it('filters by type and shows a no-match state', async () => {
    const fetch = mockFetch();
    fetch.mockResolvedValueOnce(page([memory()]));
    await renderWithProviders(<MemoriesScreen />);
    await screen.findByTestId('memory-card-1');

    fetch.mockResolvedValueOnce(page([]));
    await fireEvent.press(screen.getByTestId('memories-filter-quote'));

    expect(await screen.findByTestId('memories-no-match')).toBeTruthy();
    const last = fetch.mock.calls[fetch.mock.calls.length - 1]?.[0];
    expect(last && urlOf(last).searchParams.get('type')).toBe('quote');
    expect(screen.getByTestId('memories-filter-quote').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('searches after a short pause, and clears the search', async () => {
    jest.useFakeTimers();
    try {
      const fetch = mockFetch();
      fetch.mockResolvedValue(page([memory()]));
      await renderWithProviders(<MemoriesScreen />);
      await screen.findByTestId('memory-card-1');

      await fireEvent.changeText(screen.getByTestId('memories-search'), 'lac');
      await act(async () => {
        jest.advanceTimersByTime(350);
      });
      await waitFor(() => {
        const urls = fetch.mock.calls.map(([arg]) => urlOf(arg));
        expect(urls.some((u) => u.searchParams.get('q') === 'lac')).toBe(true);
      });

      await fireEvent.press(screen.getByRole('button', { name: 'Effacer la recherche' }));
      expect(screen.getByTestId('memories-search').props.value).toBe('');
    } finally {
      jest.useRealTimers();
    }
  });

  it('loads the next page at the end of the list', async () => {
    const fetch = mockFetch();
    fetch
      .mockResolvedValueOnce(
        page([memory({ id: 1 })], 'http://api.test/api/v1/memories/?cursor=abc'),
      )
      .mockResolvedValueOnce(
        page([memory({ id: 2, title: 'Plus ancien', happened_on: '2020-05-01' })]),
      );
    await renderWithProviders(<MemoriesScreen />);
    await screen.findByTestId('memory-card-1');

    await fireEvent(screen.getByTestId('memories-list'), 'endReached');

    expect(await screen.findByText('Plus ancien')).toBeTruthy();
    const second = fetch.mock.calls[1]?.[0];
    expect(second && urlOf(second).searchParams.get('cursor')).toBe('abc');
  });

  it('renders in dark mode', async () => {
    mockFetch().mockResolvedValue(page([memory({ photos: [photo(1)] })]));
    await renderWithProviders(<MemoriesScreen />, 'dark');
    expect(await screen.findByTestId('memory-card-1')).toBeTruthy();
  });
});
