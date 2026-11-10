import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { ThemeProvider } from '@/ui';

import { FloatingTabBar } from '../FloatingTabBar';
import { TABS } from '../tabs';

type Props = ComponentProps<typeof FloatingTabBar>;

function makeProps(index: number, defaultPrevented = false) {
  const routes = TABS.map(({ name }) => ({ key: `${name}-key`, name, params: undefined }));
  const descriptors = Object.fromEntries(
    routes.map((r) => [r.key, { options: { title: `Titre ${r.name}` } }]),
  );
  const emitter = { emit: jest.fn(() => ({ defaultPrevented })) };
  const navigateToTab = jest.fn();
  const props = {
    state: { index, routes },
    descriptors,
    emitter,
    navigateToTab,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as Props;
  return { props, emitter, navigateToTab };
}

describe('FloatingTabBar', () => {
  it('shows the five capture icons as tabs, the current one selected', async () => {
    const { props } = makeProps(0);
    await render(
      <ThemeProvider scheme="light">
        <FloatingTabBar {...props} />
      </ThemeProvider>,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByTestId('tabbar-today').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Titre us' })).toBeTruthy();
  });

  it('navigates to another tab unless the press is prevented', async () => {
    const { props, emitter, navigateToTab } = makeProps(0);
    await render(<FloatingTabBar {...props} />);
    // Reacts on touch-down; the release that follows does not navigate twice.
    await fireEvent(screen.getByTestId('tabbar-us'), 'pressIn');
    await fireEvent.press(screen.getByTestId('tabbar-us'));
    expect(navigateToTab).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'us-key' }),
    );
    expect(navigateToTab).toHaveBeenCalledWith('us-key');

    const prevented = makeProps(0, true);
    await render(<FloatingTabBar {...prevented.props} />);
    await fireEvent(screen.getByTestId('tabbar-me'), 'pressIn');
    expect(prevented.navigateToTab).not.toHaveBeenCalled();
  });
});
