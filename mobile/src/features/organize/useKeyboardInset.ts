import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Keyboard, Platform, type View } from 'react-native';

/**
 * Bottom padding that keeps a form (its fields and its footer button) above the iOS
 * keyboard. Unlike KeyboardAvoidingView, which measures itself relative to its parent,
 * the view is measured in the window: the result stays right inside modal sheets, which
 * do not start at the top of the screen. Android resizes the window by itself.
 *
 * Put `ref` on the view that receives `paddingBottom: inset` (its frame does not move).
 */
export function useKeyboardInset() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const move = (to: number, duration?: number) =>
      Animated.timing(inset, {
        toValue: to,
        duration: duration || 250,
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
        useNativeDriver: false,
      }).start();
    const show = Keyboard.addListener('keyboardWillShow', (event) => {
      const view = ref.current;
      if (!view?.measureInWindow) return;
      view.measureInWindow((_x, y, _width, height) =>
        move(Math.max(0, y + height - event.endCoordinates.screenY), event.duration),
      );
    });
    const hide = Keyboard.addListener('keyboardWillHide', (event) => move(0, event.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [inset]);
  return { ref, inset };
}
