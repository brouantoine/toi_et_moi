import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { Button } from '../Button';
import { ThemeProvider } from '../theme';

// RNTL v14: render() and fireEvent() are async.
async function renderButton(props: Partial<ComponentProps<typeof Button>> = {}) {
  const onPress = jest.fn();
  await render(
    <ThemeProvider scheme="dark">
      <Button label="Valider" onPress={onPress} {...props} />
    </ThemeProvider>,
  );
  return onPress;
}

describe('Button', () => {
  it('exposes an accessible button and calls onPress', async () => {
    const onPress = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: 'Valider' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = await renderButton({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Valider' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a busy state while loading', async () => {
    await renderButton({ loading: true });
    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.queryByText('Valider')).toBeNull();
  });
});
