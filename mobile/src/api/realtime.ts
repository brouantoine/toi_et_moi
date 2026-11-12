/**
 * Real-time sync client (see backend `core/realtime.py` for the protocol).
 * The server only says *what* changed; we invalidate the matching queries and TanStack
 * Query refetches through the REST API. Reconnects with a gentle exponential backoff.
 */
import type { QueryKey } from '@tanstack/react-query';

export type ChangedEvent = {
  type: 'changed';
  resource: 'events' | 'lists' | 'list_items' | 'chores' | 'expenses' | 'morning' | string;
  id: number;
  action: 'upsert' | 'delete' | 'reorder' | string;
  list_id?: number;
};

/** Query keys to refresh for a change (prefix keys: a list key also covers its items). */
export function invalidationKeysFor(event: ChangedEvent): QueryKey[] {
  switch (event.resource) {
    case 'events':
      return [['events']];
    case 'lists':
    case 'list_items':
      return [['lists']];
    case 'chores':
      return [['chores']];
    case 'expenses':
      return [['expenses']];
    case 'morning':
      return [['morning']];
    case 'messages':
      return [['messages']];
    case 'couple':
      return [['couple']];
    case 'distance':
      return [['distance']];
    case 'games':
      return [['games']];
    case 'notes':
      return [['notes']];
    case 'calls':
      return [['calls']];
    case 'coach':
      return [['coach']];
    default:
      return [];
  }
}

/** ws(s):// URL of the sync endpoint for an http(s):// API base URL. */
export function syncUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws/v1/sync/`;
}

export const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000] as const;
export const PING_MS = 25000;
const CLOSE_UNAUTHORIZED = 4401;

type SocketLike = {
  send: (data: string) => void;
  close: () => void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
};

export type SyncOptions = {
  url: string;
  getToken: () => string | null;
  onChanged: (event: ChangedEvent) => void;
  /** Called when the server refuses the token; should refresh it (e.g. any API call). */
  onUnauthorized: () => Promise<unknown>;
  /** Called once connected and authenticated: catch up on what was missed meanwhile. */
  onReady?: () => void;
  /** The partner started or stopped typing a message (ephemeral, never stored). */
  onTyping?: (active: boolean) => void;
  /** WebRTC signalling from the partner for a live call (offer, answer, ICE candidate). */
  onSignal?: (callId: number, data: Record<string, unknown>) => void;
  createSocket?: (url: string) => SocketLike;
};

export class SyncClient {
  private socket: SocketLike | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private ready = false;

  constructor(private readonly options: SyncOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  /** Tells the partner I am (or stopped) typing. Dropped when not connected. */
  sendTyping(active: boolean): void {
    if (this.ready) this.socket?.send(JSON.stringify({ type: 'typing', active }));
  }

  /** Sends WebRTC signalling to the partner. Returns false when not connected. */
  sendSignal(callId: number, data: Record<string, unknown>): boolean {
    if (!this.ready || !this.socket) return false;
    this.socket.send(JSON.stringify({ type: 'signal', call: callId, data }));
    return true;
  }

  stop(): void {
    this.running = false;
    this.ready = false;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private connect(): void {
    const token = this.options.getToken();
    if (!this.running || !token) return;
    const create = this.options.createSocket ?? ((url) => new WebSocket(url) as SocketLike);
    const socket = create(this.options.url);
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (event) => this.handle(event.data);
    socket.onclose = (event) => {
      if (this.socket !== socket) return; // replaced or stopped
      this.socket = null;
      this.ready = false;
      this.clearTimers();
      if (!this.running) return;
      if (event.code === CLOSE_UNAUTHORIZED) {
        void this.options.onUnauthorized().finally(() => this.scheduleRetry());
      } else {
        this.scheduleRetry();
      }
    };
  }

  private handle(raw: unknown): void {
    let message: Omit<Partial<ChangedEvent>, 'type'> & {
      type?: string;
      active?: boolean;
      call?: unknown;
      data?: unknown;
    };
    try {
      message = JSON.parse(String(raw)) as typeof message;
    } catch {
      return;
    }
    if (message.type === 'ready') {
      this.attempt = 0;
      this.ready = true;
      this.pingTimer = setInterval(
        () => this.socket?.send(JSON.stringify({ type: 'ping' })),
        PING_MS,
      );
      this.options.onReady?.();
    } else if (message.type === 'changed') {
      this.options.onChanged(message as ChangedEvent);
    } else if (message.type === 'typing') {
      this.options.onTyping?.(Boolean(message.active));
    } else if (
      message.type === 'signal' &&
      typeof message.call === 'number' &&
      message.data &&
      typeof message.data === 'object'
    ) {
      this.options.onSignal?.(message.call, message.data as Record<string, unknown>);
    }
  }

  private scheduleRetry(): void {
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = this.pingTimer = null;
  }
}
