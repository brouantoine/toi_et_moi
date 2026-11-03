import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders, routerMock } from '@/test-utils';

import { useOnboarding } from '../onboardingStore';
import { OnboardingScreen } from '../OnboardingScreen';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'fr' }] }));

beforeEach(async () => {
  await AsyncStorage.clear();
  useOnboarding.setState({ status: 'loading' });
});

describe('OnboardingScreen', () => {
  it('walks through 3 screens max and ends on what the app will never do', async () => {
    await renderWithProviders(<OnboardingScreen />);
    expect(screen.getByText('Bienvenue dans Nous Deux')).toBeTruthy();
    expect(screen.getByLabelText('Étape 1 sur 3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-gentle')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByText('Ce que l’app ne fera jamais')).toBeTruthy();
    for (const item of ['streaks', 'tracking', 'ads', 'private']) {
      expect(screen.getByTestId(`onboarding-never-${item}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'C’est parti' }));
    await waitFor(() => expect(routerMock().replace).toHaveBeenCalledWith('/welcome'));
    expect(useOnboarding.getState().status).toBe('seen');
    expect(await AsyncStorage.getItem('nd.onboarding.v1')).toBe('done');
  });

  it('can be skipped', async () => {
    await renderWithProviders(<OnboardingScreen />);
    await fireEvent.press(screen.getByTestId('onboarding-skip'));
    await waitFor(() => expect(routerMock().replace).toHaveBeenCalledWith('/welcome'));
    expect(useOnboarding.getState().status).toBe('seen');
  });
});

describe('onboarding flag', () => {
  it('hydrates as unseen on first launch, then seen once completed', async () => {
    await useOnboarding.getState().hydrate();
    expect(useOnboarding.getState().status).toBe('unseen');
    await useOnboarding.getState().complete();
    useOnboarding.setState({ status: 'loading' });
    await useOnboarding.getState().hydrate();
    expect(useOnboarding.getState().status).toBe('seen');
  });

  it('falls back to unseen when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await useOnboarding.getState().hydrate();
    expect(useOnboarding.getState().status).toBe('unseen');
  });
});
