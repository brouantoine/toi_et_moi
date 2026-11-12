/**
 * WebRTC signalling between the two phones, over the realtime connection.
 *
 * The realtime sync registers the sender; the call engine listens. Signals that arrive
 * before the engine is listening (the offer often reaches the callee first) are kept
 * for that call and handed over as soon as someone subscribes.
 */
export type Signal = Record<string, unknown>;
type Listener = (callId: number, data: Signal) => void;

const MAX_PENDING = 64;
let sender: ((callId: number, data: Signal) => boolean) | null = null;
const listeners = new Set<Listener>();
let pending: { callId: number; data: Signal }[] = [];

export function setSignalSender(next: typeof sender): void {
  sender = next;
}

export function sendSignal(callId: number, data: Signal): boolean {
  return sender ? sender(callId, data) : false;
}

/** Called by the realtime sync for every signal from the partner. */
export function receiveSignal(callId: number, data: Signal): void {
  if (listeners.size === 0) {
    pending = [...pending, { callId, data }].slice(-MAX_PENDING);
    return;
  }
  listeners.forEach((listener) => listener(callId, data));
}

/** Listens for one call's signals, starting with those that arrived before. */
export function onSignal(callId: number, listener: (data: Signal) => void): () => void {
  const wrapped: Listener = (id, data) => {
    if (id === callId) listener(data);
  };
  listeners.add(wrapped);
  const early = pending.filter((p) => p.callId === callId);
  pending = pending.filter((p) => p.callId !== callId);
  early.forEach((p) => listener(p.data));
  return () => {
    listeners.delete(wrapped);
  };
}

/** For tests. */
export function resetSignals(): void {
  sender = null;
  listeners.clear();
  pending = [];
}
