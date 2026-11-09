import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'denied';

/** Tap to start, tap to stop: returns the file and its duration. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderState>('idle');
  const startedAt = useRef(0);

  const start = async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!permission.granted) {
      setState('denied');
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setState('recording');
    return true;
  };

  /** Stops and gives the recording, or null when it was too short to keep. */
  const stop = async (): Promise<{ uri: string; durationMs: number } | null> => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setState('idle');
    const durationMs = Date.now() - startedAt.current;
    if (!recorder.uri || durationMs < 600) return null;
    return { uri: recorder.uri, durationMs };
  };

  const cancel = async () => {
    if (state === 'recording') await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setState('idle');
  };

  return { state, start, stop, cancel, startedAt };
}
