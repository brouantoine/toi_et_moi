import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import i18n from '@/i18n';
import { jsonResponse, mockFetch, renderWithProviders, routerMock } from '@/test-utils';
import { toIsoDate } from '@/ui';

import { addTag, normalizeTag } from '../memoryForm';
import { MemoryFormScreen } from '../MemoryFormScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  getMediaLibraryPermissionsAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: jest.fn(),
      renderAsync: async () => ({
        saveAsync: async () => ({ uri: 'file:///compressed.jpg', width: 2048, height: 1536 }),
      }),
    }),
  },
}));

const picker = jest.mocked(ImagePicker);

const S3 = 'https://s3.test/bucket';

function memoryJson(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    title: 'Le lac',
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

type Call = { method: string; path: string; body?: unknown };

/** Fake API + storage. `storageStatus` controls the S3 answers, in order. */
function fakeBackend({ storageStatus = [204] as number[], memory = memoryJson() } = {}) {
  const calls: Call[] = [];
  const fetch = mockFetch();
  fetch.mockImplementation(async (arg, init) => {
    if (typeof arg === 'string') {
      calls.push({ method: init?.method ?? 'GET', path: arg });
      return new Response(null, { status: storageStatus.shift() ?? 204 });
    }
    const url = new URL(arg.url);
    const text = arg.method === 'GET' || arg.method === 'DELETE' ? '' : await arg.clone().text();
    calls.push({
      method: arg.method,
      path: url.pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    if (url.pathname.endsWith('/upload-url/')) {
      return jsonResponse({
        key: 'couples/3/memories/k.jpg',
        url: S3,
        form_fields: { key: 'couples/3/memories/k.jpg' },
        max_bytes: 10_000_000,
        expires_in: 600,
      });
    }
    if (url.pathname.endsWith('/photos/') && arg.method === 'POST') {
      return jsonResponse(
        { id: 99, url: null, thumbnail_url: null, width: 2048, height: 1536 },
        201,
      );
    }
    if (arg.method === 'DELETE') return new Response(null, { status: 204 });
    if (arg.method === 'POST') return jsonResponse(memory, 201);
    return jsonResponse(memory);
  });
  return calls;
}

const apiCalls = (calls: Call[]) => calls.map((c) => `${c.method} ${c.path}`);

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

describe('tag helpers', () => {
  it('normalizes and deduplicates tags', () => {
    expect(normalizeTag('  #vacances   d’été ')).toBe('vacances d’été');
    expect(addTag(['Lac'], 'lac')).toEqual(['Lac']);
    expect(addTag(['Lac'], '   ')).toEqual(['Lac']);
    expect(addTag([], 'mer')).toEqual(['mer']);
  });
});

describe('MemoryFormScreen — create', () => {
  it('asks for a title before saving, without calling the API', async () => {
    const calls = fakeBackend();
    await renderWithProviders(<MemoryFormScreen />);
    await fireEvent.press(screen.getByTestId('memory-form-save'));
    expect(await screen.findByText('Donne un titre à ce souvenir.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('creates a memory with its details and closes', async () => {
    const calls = fakeBackend();
    await renderWithProviders(<MemoryFormScreen />);

    await fireEvent.changeText(screen.getByTestId('memory-form-title'), '  Le lac  ');
    await fireEvent.changeText(screen.getByTestId('memory-form-body'), 'On avait froid.');
    await fireEvent.press(screen.getByTestId('memory-form-type-place'));
    await fireEvent.changeText(screen.getByTestId('memory-form-place'), 'Annecy');
    await fireEvent.changeText(screen.getByTestId('memory-form-tag-input'), '#voyage');
    await fireEvent(screen.getByTestId('memory-form-tag-input'), 'submitEditing');
    expect(screen.getByText('#voyage')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('memory-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());

    expect(apiCalls(calls)).toEqual(['POST /api/v1/memories/']);
    expect(calls[0]?.body).toEqual({
      title: 'Le lac',
      body: 'On avait froid.',
      happened_on: toIsoDate(new Date()),
      place: 'Annecy',
      type: 'place',
      tags: ['voyage'],
    });
  });

  it('compresses and uploads picked photos through a presigned ticket', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///IMG_1.heic', width: 4032, height: 3024 }],
    } as never);
    const calls = fakeBackend();
    await renderWithProviders(<MemoryFormScreen />);

    await fireEvent.press(screen.getByTestId('memory-form-add-photos'));
    expect(await screen.findByText('1 sur 10')).toBeTruthy();
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 10 }),
    );

    await fireEvent.changeText(screen.getByTestId('memory-form-title'), 'Le lac');
    await fireEvent.press(screen.getByTestId('memory-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());

    expect(apiCalls(calls)).toEqual([
      'POST /api/v1/memories/',
      'POST /api/v1/memories/5/photos/upload-url/',
      `POST ${S3}`,
      'POST /api/v1/memories/5/photos/',
      'GET /api/v1/memories/5/',
    ]);
    expect(calls[1]?.body).toEqual({ content_type: 'image/jpeg' });
    expect(calls[3]?.body).toEqual({ key: 'couples/3/memories/k.jpg', width: 2048, height: 1536 });
  });

  it('keeps the memory when a photo fails, then retries only that photo', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///IMG_1.jpg', width: 800, height: 600 }],
    } as never);
    const calls = fakeBackend({ storageStatus: [500, 204] });
    await renderWithProviders(<MemoryFormScreen />);

    await fireEvent.press(screen.getByTestId('memory-form-add-photos'));
    await screen.findByText('1 sur 10');
    await fireEvent.changeText(screen.getByTestId('memory-form-title'), 'Le lac');
    await fireEvent.press(screen.getByTestId('memory-form-save'));

    expect(await screen.findByTestId('memory-form-partial')).toBeTruthy();
    expect(screen.getByLabelText('Cette photo n’a pas pu être envoyée')).toBeTruthy();
    expect(routerMock().back).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Réessayer l’envoi' })).toBeTruthy();

    calls.length = 0;
    await fireEvent.press(screen.getByTestId('memory-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    // No duplicate memory: the retry updates the one already created.
    expect(apiCalls(calls)).toEqual([
      'PATCH /api/v1/memories/5/',
      'POST /api/v1/memories/5/photos/upload-url/',
      `POST ${S3}`,
      'POST /api/v1/memories/5/photos/',
      'GET /api/v1/memories/5/',
    ]);
  });

  it('explains a refused photo permission without crashing', async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('E_NO_PERMISSIONS'));
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    fakeBackend();
    await renderWithProviders(<MemoryFormScreen />);

    await fireEvent.press(screen.getByTestId('memory-form-add-photos'));
    expect(await screen.findByTestId('memory-form-photos-denied')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    expect(openSettings).toHaveBeenCalled();
    expect(screen.getByTestId('memory-form')).toBeTruthy();
  });

  it('shows a calm error and keeps the text when saving fails', async () => {
    const fetch = mockFetch();
    fetch.mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<MemoryFormScreen />);
    await fireEvent.changeText(screen.getByTestId('memory-form-title'), 'Le lac');
    await fireEvent.press(screen.getByTestId('memory-form-save'));
    expect(await screen.findByTestId('memory-form-save-error')).toBeTruthy();
    expect(screen.getByTestId('memory-form-title').props.value).toBe('Le lac');
  });

  it('closes directly when nothing was written, and asks first otherwise', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fakeBackend();
    await renderWithProviders(<MemoryFormScreen />);
    await fireEvent.press(screen.getByTestId('memory-form-close'));
    expect(routerMock().back).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('memory-form-title'), 'Le lac');
    await fireEvent.press(screen.getByTestId('memory-form-close'));
    expect(alert).toHaveBeenCalledWith(
      'Laisser ce souvenir de côté\u00a0?',
      'Ce que tu as écrit ne sera pas gardé.',
      expect.any(Array),
    );
    expect(routerMock().back).toHaveBeenCalledTimes(1);
  });
});

describe('MemoryFormScreen — edit', () => {
  it('prefills the form, removes a photo and saves with PATCH', async () => {
    const photo = {
      id: 41,
      url: 'https://s3.test/p.jpg',
      thumbnail_url: 'https://s3.test/p_t.jpg',
      width: 2048,
      height: 1536,
      position: 0,
    };
    const calls = fakeBackend({ memory: memoryJson({ photos: [photo], tags: ['lac'] }) });
    await renderWithProviders(<MemoryFormScreen memoryId={5} />);

    expect(await screen.findByDisplayValue('Le lac')).toBeTruthy();
    expect(screen.getByText('Modifier le souvenir')).toBeTruthy();
    expect(screen.getByText('#lac')).toBeTruthy();
    expect(screen.getByText('1 sur 10')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('memory-form-remove-photo-0'));
    expect(screen.getByText('0 sur 10')).toBeTruthy();
    calls.length = 0;
    await fireEvent.press(screen.getByTestId('memory-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    expect(apiCalls(calls)).toEqual([
      'PATCH /api/v1/memories/5/',
      'DELETE /api/v1/memories/5/photos/41/',
      'GET /api/v1/memories/5/',
    ]);
  });

  it('shows an error state when the memory cannot be loaded', async () => {
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<MemoryFormScreen memoryId={5} />);
    expect(await screen.findByTestId('memory-form-error')).toBeTruthy();
  });
});
