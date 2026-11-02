import { fireEvent, screen } from '@testing-library/react-native';
import { Camera } from 'lucide-react-native';

import { renderWithProviders } from '@/test-utils';

import { Avatar, initials } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { Input } from '../Input';
import { LoadingState } from '../LoadingState';
import { Sheet } from '../Sheet';
import { Skeleton } from '../Skeleton';
import { palettes } from '../tokens';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'fr' }] }));

describe('Input', () => {
  it('is labelled and forwards typing', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<Input label="Prénom" onChangeText={onChangeText} testID="in" />);
    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Léa');
    expect(onChangeText).toHaveBeenCalledWith('Léa');
  });

  it('shows the error instead of the hint, with a danger border', async () => {
    await renderWithProviders(
      <Input label="Email" hint="Ton adresse" error="Email invalide" testID="in" />,
      'dark',
    );
    expect(screen.getByText('Email invalide')).toBeTruthy();
    expect(screen.queryByText('Ton adresse')).toBeNull();
    const style = [screen.getByTestId('in').props.style].flat(3);
    expect(style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderColor: palettes.dark.danger })]),
    );
  });

  it('shows the hint when there is no error', async () => {
    await renderWithProviders(<Input label="Email" hint="Ton adresse" />);
    expect(screen.getByText('Ton adresse')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it.each([
    ['Léa Martin', 'LM'],
    ['camille', 'C'],
    ['  Jean  Pierre  Dupont ', 'JD'],
    ['', '?'],
  ])('initials(%j) = %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('shows initials without photo and is announced by name', async () => {
    await renderWithProviders(<Avatar name="Léa Martin" />);
    expect(screen.getByLabelText('Léa Martin')).toBeTruthy();
    expect(screen.getByText('LM', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the photo when a uri is given', async () => {
    await renderWithProviders(<Avatar name="Léa" uri="https://example.com/a.jpg" />);
    expect(screen.queryByText('L', { includeHiddenElements: true })).toBeNull();
  });
});

describe('EmptyState', () => {
  it('renders title, message and an optional action', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState
        icon={Camera}
        title="Aucun souvenir"
        message="Le premier vous attend."
        actionLabel="Ajouter"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('Aucun souvenir')).toBeTruthy();
    expect(screen.getByText('Le premier vous attend.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('has no button without an action', async () => {
    await renderWithProviders(<EmptyState icon={Camera} title="Rien" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('maps a known code to a calm message and retries', async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<ErrorState code="network" onRetry={onRetry} />);
    expect(screen.getByText(/Pas de connexion/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('falls back to the generic message for unknown codes', async () => {
    await renderWithProviders(<ErrorState code="weird_code" />);
    expect(screen.getByText(/Quelque chose n'a pas fonctionné/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LoadingState and Skeleton', () => {
  it('announces loading', async () => {
    await renderWithProviders(<LoadingState />);
    expect(screen.getByLabelText('Un instant…')).toBeTruthy();
  });

  it('renders a skeleton hidden from screen readers', async () => {
    await renderWithProviders(<Skeleton testID="sk" height={20} />);
    const node = screen.getByTestId('sk', { includeHiddenElements: true });
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('Sheet', () => {
  it('shows content when visible and closes from the close button', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Sheet visible title="Filtrer" onClose={onClose} testID="sheet">
        <></>
      </Sheet>,
    );
    expect(screen.getByText('Filtrer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when hidden', async () => {
    await renderWithProviders(
      <Sheet visible={false} title="Filtrer" onClose={jest.fn()}>
        <></>
      </Sheet>,
    );
    expect(screen.queryByText('Filtrer')).toBeNull();
  });
});
