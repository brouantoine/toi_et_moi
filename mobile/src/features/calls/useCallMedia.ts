/**
 * Runs the live media of the ongoing call and exposes its state and controls.
 * One call at a time: the engine lives in a tiny module store, outside React state.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { api, unwrap } from '@/api';

import { CallMedia, webrtcAvailable, type MediaState } from './rtc';
import { onSignal, sendSignal } from './signalBus';
import type { Call } from './useCalls';

let engine: CallMedia | null = null;
let snapshot: MediaState | null = null;
const subscribers = new Set<() => void>();

function publish(next: MediaState | null): void {
  snapshot = next;
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/** Live voice/video for this call, when the build and the server allow it. */
export function useCallMedia(call: Call | null) {
  const live = Boolean(call && call.state === 'ongoing' && call.media_ready && webrtcAvailable());
  const ice = useQuery({
    queryKey: ['calls', 'ice'],
    enabled: live,
    staleTime: 60_000,
    queryFn: async () => unwrap(await api.GET('/api/v1/calls/ice/')),
  });
  const servers = ice.data?.ice_servers;
  const callId = call?.id;
  const role = call?.direction === 'outgoing' ? 'caller' : 'callee';
  const video = call?.kind === 'video';

  useEffect(() => {
    if (!live || callId == null || !servers) return undefined;
    const media = new CallMedia({
      role,
      video,
      iceServers: servers,
      send: (data) => sendSignal(callId, data),
      onChange: publish,
    });
    engine = media;
    const unsubscribe = onSignal(callId, (data) => void media.handle(data).catch(() => {}));
    void media
      .start()
      .catch(() => publish({ ...(snapshot ?? initial(video)), connection: 'failed' }));
    return () => {
      unsubscribe();
      media.stop();
      if (engine === media) engine = null;
      publish(null);
    };
  }, [live, callId, servers, role, video]);

  const state = useSyncExternalStore(subscribe, () => snapshot);
  return {
    available: live,
    state,
    toggleMute: () => engine?.setMuted(!(snapshot?.muted ?? false)),
    toggleCamera: () => engine?.setCamera(!(snapshot?.cameraOn ?? true)),
    toggleSpeaker: () => engine?.setSpeaker(!(snapshot?.speaker ?? false)),
    switchCamera: () => engine?.switchCamera(),
  };
}

function initial(video: boolean): MediaState {
  return {
    localUrl: null,
    remoteUrl: null,
    connection: 'new',
    muted: false,
    cameraOn: video,
    speaker: video,
  };
}
