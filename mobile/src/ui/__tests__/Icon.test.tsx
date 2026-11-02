import { render, screen } from '@testing-library/react-native';
import { Heart } from 'lucide-react-native';

import { Icon } from '../Icon';
import { ThemeProvider } from '../theme';
import { palettes } from '../tokens';

describe('Icon', () => {
  it('is decorative (hidden from screen readers) by default', async () => {
    await render(
      <ThemeProvider scheme="light">
        <Icon icon={Heart} testID="icon" />
      </ThemeProvider>,
    );
    const icon = screen.getByTestId('icon', { includeHiddenElements: true });
    expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('is announced when labelled and uses the theme color', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <Icon icon={Heart} color="primary" accessibilityLabel="Je pense à toi" testID="icon" />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText('Je pense à toi')).toBeTruthy();
    expect(screen.getByTestId('icon').props.stroke).toBe(palettes.dark.primary);
  });
});
