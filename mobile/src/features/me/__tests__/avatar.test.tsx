import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import { jsonResponse, mockFetch, renderWithProviders, requestBody } from '@/test-utils';
import { Avatar, AVATAR_PEOPLE, AVATAR_PRESETS, AVATAR_TONES, presetId } from '@/ui';

import { AvatarScreen } from '../AvatarScreen';

const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);
const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);

const me = {
  id: 1,
  display_name: 'Antoine',
  avatar_url: null as string | null,
  avatar_preset: '',
};

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('ships every character in every skin tone', () => {
  for (const person of AVATAR_PEOPLE) {
    for (const tone of AVATAR_TONES) expect(AVATAR_PRESETS[presetId(person, tone)]).toBeTruthy();
  }
});

it('shows initials without a picture, never cut', async () => {
  await renderWithProviders(<Avatar name="Antoine Brou" size={80} />);
  const letters = screen.getByText('AB', { includeHiddenElements: true });
  const style = Object.assign({}, ...[letters.props.style].flat(3).filter(Boolean));
  expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
});

it('picks a character in one tap, replacing the photo', async () => {
  const fetchMock = mockFetch().mockImplementation(async (input) => {
    if (methodOf(input) === 'DELETE') return new Response(null, { status: 204 });
    if (methodOf(input) === 'PATCH') {
      return jsonResponse({ ...me, avatar_url: null, avatar_preset: 'woman-dark' });
    }
    if (urlOf(input).endsWith('/me/'))
      return jsonResponse({ ...me, avatar_url: 'https://x/a.jpg' });
    return jsonResponse({}, 404);
  });
  await renderWithProviders(<AvatarScreen />);
  await fireEvent.press(await screen.findByTestId('avatar-preset-woman-dark'));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'PATCH')).toBe(true),
  );
  expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'DELETE')).toBe(true);
  const patch = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PATCH')![0];
  expect(await requestBody(patch)).toEqual({ avatar_preset: 'woman-dark' });
});
