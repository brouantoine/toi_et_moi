/**
 * Call sounds (original Bolingo tones, synthesised for the app): the incoming ringtone,
 * the ringback heard by the caller, and the hang-up chime.
 */
export const SOUNDS = {
  ringtone: require('../../../assets/sounds/ringtone.wav'),
  ringback: require('../../../assets/sounds/ringback.wav'),
  hangup: require('../../../assets/sounds/hangup.wav'),
} as const;

/** Incoming call vibration: long, pause, long, repeated until answered. */
export const RING_VIBRATION = [0, 900, 700, 900, 1400];
