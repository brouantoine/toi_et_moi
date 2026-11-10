import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { levelFromDb, resample } from './waveform';

export type RecorderState = 'idle' | 'recording' | 'denied';
export type VoiceNote = { uri: string; durationMs: number; waveform: number[] };

/** Below this a recording is a slip of the finger, not a message. */
export const MIN_VOICE_MS = 600;
/** How often the microphone level is read while recording. */
const SAMPLE_MS = 80;
/** Bars shown live while recording (the most recent ones). */
export const LIVE_BARS = 36;

/** Hold to record: start, then stop (keeps the note) or cancel (throws it away). */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [state, setState] = useState<RecorderState>('idle');
  const [live, setLive] = useState<number[]>([]);
  const startedAt = useRef(0);
  const samples = useRef<number[]>([]);
  const starting = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (state !== 'recording') return undefined;
    const timer = setInterval(() => {
      let level = 0;
      try {
        level = levelFromDb(recorder.getStatus().metering);
      } catch {
        level = 0;
      }
      samples.current.push(level);
      setLive(samples.current.slice(-LIVE_BARS));
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [state, recorder]);

  const begin = async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!permission.granted) {
      setState('denied');
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    samples.current = [];
    setLive([]);
    startedAt.current = Date.now();
    setState('recording');
    return true;
  };

  const start = (): Promise<boolean> => {
    starting.current = begin().finally(() => {
      starting.current = null;
    });
    return starting.current;
  };

  const finish = async () => {
    // Released before the microphone was even ready: wait for it, then stop cleanly.
    if (starting.current) await starting.current.catch(() => false);
    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setState((current) => (current === 'denied' ? current : 'idle'));
    setLive([]);
  };

  /** Stops and gives the note, or null when it was too short to keep. */
  const stop = async (): Promise<VoiceNote | null> => {
    await finish();
    const durationMs = Date.now() - startedAt.current;
    if (!recorder.uri || !startedAt.current || durationMs < MIN_VOICE_MS) return null;
    return { uri: recorder.uri, durationMs, waveform: resample(samples.current) };
  };

  const cancel = async () => {
    await finish();
  };

  return { state, live, start, stop, cancel, startedAt };
}
