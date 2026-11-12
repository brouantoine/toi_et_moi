/**
 * Live voice and video between the two partners (WebRTC, peer to peer, relayed by our
 * TURN server when the networks do not let the phones see each other).
 *
 * The native module only exists in the installed app (dev or store build): in Expo Go
 * `webrtcAvailable()` is false and the call screen says so instead of failing.
 *
 * Flow: the caller sends an offer once the partner picked up; the callee answers; both
 * trickle ICE candidates. Candidates that arrive before the remote description are kept.
 */
import { NativeModules } from 'react-native';
import type {
  MediaStream as MediaStreamType,
  RTCPeerConnection as RTCPeerConnectionType,
} from 'react-native-webrtc';

import type { Signal } from './signalBus';

type WebRTC = typeof import('react-native-webrtc');
type InCall = typeof import('react-native-incall-manager').default;

let cached: { rtc: WebRTC; incall: InCall | null } | null | undefined;

function load(): { rtc: WebRTC; incall: InCall | null } | null {
  if (cached !== undefined) return cached;
  // The JS of the packages is always bundled; the native side exists only in a build.
  if (!NativeModules.WebRTCModule) {
    cached = null;
    return cached;
  }
  try {
    // Lazy on purpose: importing it in Expo Go (no native side) would throw.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rtc = require('react-native-webrtc') as WebRTC;
    let incall: InCall | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      incall = (require('react-native-incall-manager') as { default: InCall }).default;
    } catch {
      incall = null;
    }
    cached = { rtc, incall };
  } catch {
    cached = null;
  }
  return cached;
}

export function webrtcAvailable(): boolean {
  return load() !== null;
}

export type IceServer = { urls: string[]; username?: string; credential?: string };

export type MediaState = {
  localUrl: string | null;
  remoteUrl: string | null;
  /** new, connecting, connected, disconnected, failed, closed */
  connection: string;
  muted: boolean;
  cameraOn: boolean;
  speaker: boolean;
};

type Options = {
  role: 'caller' | 'callee';
  video: boolean;
  iceServers: IceServer[];
  send: (data: Signal) => void;
  onChange: (state: MediaState) => void;
};

export class CallMedia {
  private pc: RTCPeerConnectionType | null = null;
  private local: MediaStreamType | null = null;
  private remote: MediaStreamType | null = null;
  private queued: Signal[] = [];
  private started = false;
  private closed = false;
  private state: MediaState;

  constructor(private readonly options: Options) {
    this.state = {
      localUrl: null,
      remoteUrl: null,
      connection: 'new',
      muted: false,
      cameraOn: options.video,
      speaker: options.video, // video calls on the loudspeaker, voice calls at the ear
    };
  }

  private emit(patch: Partial<MediaState>): void {
    this.state = { ...this.state, ...patch };
    this.options.onChange(this.state);
  }

  async start(): Promise<void> {
    const lib = load();
    if (!lib || this.started) return;
    this.started = true;
    const { rtc, incall } = lib;
    incall?.start({ media: this.options.video ? 'video' : 'audio' });
    incall?.setForceSpeakerphoneOn(this.state.speaker);

    const local = await rtc.mediaDevices.getUserMedia({
      audio: true,
      video: this.options.video ? { facingMode: 'user', frameRate: 30 } : false,
    });
    if (this.closed) {
      local.getTracks().forEach((track) => track.stop());
      return;
    }
    this.local = local;
    const pc = new rtc.RTCPeerConnection({ iceServers: this.options.iceServers });
    this.pc = pc;
    local.getTracks().forEach((track) => pc.addTrack(track, local));

    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) this.options.send({ candidate: event.candidate.toJSON() });
    });
    pc.addEventListener('track', (event) => {
      const stream = event.streams?.[0];
      if (stream && stream !== this.remote) {
        this.remote = stream;
        this.emit({ remoteUrl: stream.toURL() });
      }
    });
    pc.addEventListener('connectionstatechange', () => {
      this.emit({ connection: pc.connectionState });
    });
    this.emit({ localUrl: this.options.video ? local.toURL() : null, connection: 'connecting' });

    if (this.options.role === 'caller') {
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      this.options.send({ sdp: pc.localDescription?.toJSON() ?? offer });
    }
    // Signals that arrived while the camera was starting.
    const early = this.queued;
    this.queued = [];
    for (const data of early) await this.handle(data);
  }

  /** A signal from the partner: their description or one of their network candidates. */
  async handle(data: Signal): Promise<void> {
    const lib = load();
    const pc = this.pc;
    if (!lib || this.closed) return;
    if (!pc) {
      this.queued.push(data);
      return;
    }
    const { rtc } = lib;
    if (data.sdp && typeof data.sdp === 'object') {
      const description = new rtc.RTCSessionDescription(data.sdp as { type: string; sdp: string });
      await pc.setRemoteDescription(description);
      if (description.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.options.send({ sdp: pc.localDescription?.toJSON() ?? answer });
      }
      const waiting = this.queued.filter((d) => d.candidate);
      this.queued = this.queued.filter((d) => !d.candidate);
      for (const d of waiting) await this.addCandidate(d.candidate);
    } else if (data.candidate) {
      if (pc.remoteDescription) await this.addCandidate(data.candidate);
      else this.queued.push(data);
    }
  }

  private async addCandidate(candidate: unknown): Promise<void> {
    const lib = load();
    if (!lib || !this.pc) return;
    try {
      await this.pc.addIceCandidate(new lib.rtc.RTCIceCandidate(candidate as object));
    } catch {
      // A stale or malformed candidate never breaks the call.
    }
  }

  setMuted(muted: boolean): void {
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.emit({ muted });
  }

  setCamera(on: boolean): void {
    this.local?.getVideoTracks().forEach((track) => {
      track.enabled = on;
    });
    this.emit({ cameraOn: on });
  }

  switchCamera(): void {
    this.local?.getVideoTracks().forEach((track) => {
      (track as unknown as { _switchCamera?: () => void })._switchCamera?.();
    });
  }

  setSpeaker(on: boolean): void {
    load()?.incall?.setForceSpeakerphoneOn(on);
    this.emit({ speaker: on });
  }

  stop(): void {
    if (this.closed) return;
    this.closed = true;
    this.local?.getTracks().forEach((track) => track.stop());
    this.pc?.close();
    this.pc = null;
    this.local = null;
    this.remote = null;
    load()?.incall?.stop();
  }
}

/** The native video view, only where WebRTC exists (never imported in Expo Go). */
export function videoView(): WebRTC['RTCView'] | null {
  return load()?.rtc.RTCView ?? null;
}
