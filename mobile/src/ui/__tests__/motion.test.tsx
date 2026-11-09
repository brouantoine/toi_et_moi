import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { Celebration, FadeIn } from '../motion';
import { ThemeProvider } from '../theme';

function withTheme(ui: React.ReactElement) {
  return render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => jest.restoreAllMocks());

describe('FadeIn', () => {
  it('always shows its content (accessible from the first frame)', async () => {
    await withTheme(
      <FadeIn testID="fade">
        <Text>Bonjour</Text>
      </FadeIn>,
    );
    expect(screen.getByText('Bonjour')).toBeTruthy();
  });

  it('renders still content when motion is reduced', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await withTheme(
      <FadeIn testID="fade">
        <Text>Calme</Text>
      </FadeIn>,
    );
    await settle();
    expect(screen.getByTestId('fade').props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: expect.anything() })]),
    );
  });
});

describe('Celebration', () => {
  it('plays a decorative burst, hidden from screen readers', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await withTheme(<Celebration testID="burst" play="milestone" />);
    await settle();
    const burst = screen.getByTestId('burst', { includeHiddenElements: true });
    expect(burst.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(burst.props.pointerEvents).toBe('none');
  });

  it('does nothing without a reason to celebrate', async () => {
    await withTheme(<Celebration testID="burst" play={false} />);
    expect(screen.queryByTestId('burst', { includeHiddenElements: true })).toBeNull();
  });

  it('never plays when motion is reduced', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await withTheme(<Celebration testID="burst" play="milestone" />);
    await settle();
    expect(screen.queryByTestId('burst', { includeHiddenElements: true })).toBeNull();
  });
});
