import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import i18n from '@/i18n';
import { coupleKey } from '@/features/couple/useCouple';
import { meKey } from '@/features/me/useProfile';
import {
  createTestQueryClient,
  jsonResponse,
  mockFetch,
  renderWithProviders as baseRender,
  routerMock,
} from '@/test-utils';

import { MemoryDetailScreen } from '../MemoryDetailScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));

const me = {
  id: 1,
  display_name: 'Léa',
  first_name: 'Léa',
  language: 'fr',
  timezone: 'Europe/Paris',
};
const couple = {
  id: 3,
  status: 'active',
  members: [
    {
      id: 1,
      display_name: 'Léa',
      first_name: 'Léa',
      nickname: '',
      avatar_url: null,
      timezone: 'Europe/Paris',
    },
    {
      id: 2,
      display_name: 'Sam',
      first_name: 'Sam',
      nickname: '',
      avatar_url: null,
      timezone: 'Europe/Paris',
    },
  ],
};

function memoryJson(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    title: 'Le lac au lever du jour',
    body: 'On avait froid, on riait.',
    happened_on: '2025-03-14',
    place: 'Annecy',
    type: 'place',
    tags: ['voyage'],
    created_by: 1,
    photos: [
      {
        id: 1,
        url: 'https://s3.test/1.jpg',
        thumbnail_url: 'https://s3.test/1_t.jpg',
        width: 1,
        height: 1,
        position: 0,
      },
      {
        id: 2,
        url: 'https://s3.test/2.jpg',
        thumbnail_url: null,
        width: 1,
        height: 1,
        position: 1,
      },
    ],
    my_heart: false,
    partner_heart: false,
    created_at: '2025-03-14T10:00:00Z',
    updated_at: '2025-03-14T10:00:00Z',
    ...overrides,
  };
}

const theirComment = {
  id: 10,
  body: 'Tes gants !',
  author: 2,
  author_name: 'Sam',
  mine: false,
  created_at: '2025-03-15T08:00:00Z',
};
const myComment = {
  id: 11,
  body: 'Jamais plus sans thermos.',
  author: 1,
  author_name: 'Léa',
  mine: true,
  created_at: '2025-03-15T09:00:00Z',
};

/** Renders with me and the couple already cached, as in the running app. */
function renderWithProviders(ui: Parameters<typeof baseRender>[0], scheme?: 'light' | 'dark') {
  const client = createTestQueryClient();
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  return baseRender(ui, scheme, client);
}

type Call = { method: string; path: string; body?: unknown };

function fakeBackend({
  memory = memoryJson(),
  comments = [] as unknown[],
  heartStatus = 200,
}: { memory?: unknown; comments?: unknown[]; heartStatus?: number } = {}) {
  const calls: Call[] = [];
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = ['POST', 'PATCH'].includes(request.method) ? await request.clone().text() : '';
    calls.push({
      method: request.method,
      path: pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (pathname.endsWith('/heart/')) {
      return heartStatus === 200
        ? jsonResponse({ my_heart: request.method === 'POST' })
        : jsonResponse({ code: 'server' }, heartStatus);
    }
    if (pathname.endsWith('/comments/') && request.method === 'POST') {
      return jsonResponse({ ...myComment, id: 12, body: JSON.parse(text).body }, 201);
    }
    if (pathname.endsWith('/comments/')) return jsonResponse(comments);
    if (request.method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(memory);
  });
  return calls;
}

/** Presses the destructive button of the last Alert. */
function confirmAlert(alert: jest.SpyInstance) {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1]?.[2] as AlertButton[];
  buttons.find((b) => b.style === 'destructive')?.onPress?.();
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

describe('MemoryDetailScreen', () => {
  it('shows the memory: photos, title, date, place, story and tags', async () => {
    fakeBackend();
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(await screen.findByTestId('memory-title')).toHaveTextContent('Le lac au lever du jour');
    expect(screen.getByText('Vendredi 14 mars 2025')).toBeTruthy();
    expect(screen.getByText('Annecy')).toBeTruthy();
    expect(screen.getByText('On avait froid, on riait.')).toBeTruthy();
    expect(screen.getByText('#voyage')).toBeTruthy();
    expect(screen.getByLabelText('Photo 1 sur 2')).toBeTruthy();
    expect(screen.getByLabelText('Photo 2 sur 2')).toBeTruthy();
  });

  it('works without photos and shows quotes as quotes', async () => {
    fakeBackend({
      memory: memoryJson({ photos: [], type: 'quote', body: 'On ne se perd pas, on visite.' }),
    });
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(await screen.findByText('On ne se perd pas, on visite.')).toBeTruthy();
    expect(screen.queryByTestId('memory-photos')).toBeNull();
  });

  it('shows a loading state while the memory loads', async () => {
    mockFetch().mockReturnValue(new Promise(() => {}));
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(screen.getByTestId('memory-detail-loading')).toBeTruthy();
  });

  it('shows a calm error state, with a way back', async () => {
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(await screen.findByTestId('memory-detail-error')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(routerMock().back).toHaveBeenCalled();
  });

  it('toggles a single heart, without any counter', async () => {
    const calls = fakeBackend();
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    const heart = await screen.findByTestId('memory-heart');
    expect(heart.props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(heart);
    await waitFor(() =>
      expect(screen.getByTestId('memory-heart').props.accessibilityState).toMatchObject({
        checked: true,
      }),
    );
    expect(screen.getByText('Dans ton cœur')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/memories/5/heart/')).toBe(
      true,
    );
    expect(screen.queryByText(/\d+ cœurs?/)).toBeNull();
  });

  it('rolls the heart back when the API refuses', async () => {
    fakeBackend({ heartStatus: 500 });
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    await fireEvent.press(await screen.findByTestId('memory-heart'));
    await waitFor(() => expect(screen.getByText('Mettre un cœur')).toBeTruthy());
    expect(screen.getByTestId('memory-heart').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('says gently when the partner hearted it, by name', async () => {
    fakeBackend({ memory: memoryJson({ partner_heart: true }) });
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(await screen.findByText('Sam y a mis un cœur')).toBeTruthy();
  });

  it('shows the comments and lets me add a word', async () => {
    const calls = fakeBackend({ comments: [theirComment] });
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(await screen.findByText('Tes gants !')).toBeTruthy();

    const send = screen.getByTestId('memory-comment-send');
    expect(send.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByTestId('memory-comment-input'), '  Le meilleur café  ');
    await fireEvent.press(screen.getByTestId('memory-comment-send'));

    expect(await screen.findByText('Le meilleur café')).toBeTruthy();
    expect(screen.getByTestId('memory-comment-input').props.value).toBe('');
    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith('/comments/'));
    expect(post?.body).toEqual({ body: 'Le meilleur café' });
  });

  it('shows a kind invitation when there is no comment yet', async () => {
    fakeBackend();
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    expect(await screen.findByTestId('memory-comments-empty')).toBeTruthy();
  });

  it('only lets me delete my own words, after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const calls = fakeBackend({ comments: [theirComment, myComment] });
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    await screen.findByText('Jamais plus sans thermos.');

    expect(
      within(screen.getByTestId('memory-comment-10')).queryByRole('button', {
        name: 'Supprimer ton mot',
      }),
    ).toBeNull();
    await fireEvent.press(
      within(screen.getByTestId('memory-comment-11')).getByRole('button', {
        name: 'Supprimer ton mot',
      }),
    );
    confirmAlert(alert);
    await waitFor(() => expect(screen.queryByText('Jamais plus sans thermos.')).toBeNull());
    expect(
      calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/memories/5/comments/11/'),
    ).toBe(true);
  });

  it('opens the editor', async () => {
    fakeBackend();
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    await fireEvent.press(await screen.findByTestId('memory-edit'));
    expect(routerMock().push).toHaveBeenCalledWith('/memories/5/edit');
  });

  it('deletes the memory after a calm confirmation, then goes back', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const calls = fakeBackend();
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />);
    await fireEvent.press(await screen.findByTestId('memory-delete'));
    expect(alert).toHaveBeenCalledWith(
      'Supprimer ce souvenir\u00a0?',
      expect.stringContaining('pour vous deux'),
      expect.any(Array),
    );
    confirmAlert(alert);
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/memories/5/')).toBe(true);
  });

  it('renders in dark mode', async () => {
    fakeBackend();
    await renderWithProviders(<MemoryDetailScreen memoryId={5} />, 'dark');
    expect(await screen.findByTestId('memory-title')).toBeTruthy();
  });
});
