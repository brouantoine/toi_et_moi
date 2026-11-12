import { NativeModules } from 'react-native';

import { onSignal, receiveSignal, resetSignals } from '../signalBus';

type Listener = (event: Record<string, unknown>) => void;

class MockTrack {
  enabled = true;
  stopped = false;
  constructor(readonly kind: 'audio' | 'video') {}
  stop() {
    this.stopped = true;
  }
}

class MockStream {
  tracks = [new MockTrack('audio'), new MockTrack('video')];
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  toURL() {
    return 'stream://local';
  }
}

const mockPeers: MockPeer[] = [];
class MockPeer {
  listeners: Record<string, Listener[]> = {};
  localDescription: { type: string; sdp: string; toJSON: () => object } | null = null;
  remoteDescription: { type: string } | null = null;
  candidates: unknown[] = [];
  closed = false;
  connectionState = 'new';
  constructor(readonly config: unknown) {
    mockPeers.push(this);
  }
  addEventListener(name: string, listener: Listener) {
    (this.listeners[name] ??= []).push(listener);
  }
  addTrack() {}
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = { ...d, toJSON: () => ({ type: d.type, sdp: d.sdp }) };
  }
  async setRemoteDescription(d: { type: string }) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: unknown) {
    this.candidates.push(c);
  }
  close() {
    this.closed = true;
  }
}

jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: jest.fn(async () => new MockStream()) },
  RTCPeerConnection: jest.fn((config: unknown) => new MockPeer(config)),
  RTCSessionDescription: jest.fn((d: object) => d),
  RTCIceCandidate: jest.fn((c: object) => c),
  RTCView: () => null,
}));

beforeAll(() => {
  NativeModules.WebRTCModule = {};
});
afterAll(() => {
  delete NativeModules.WebRTCModule;
});
beforeEach(() => {
  mockPeers.length = 0;
  resetSignals();
});

function engine(role: 'caller' | 'callee') {
  const { CallMedia } = jest.requireActual('../rtc') as typeof import('../rtc');
  const sent: Record<string, unknown>[] = [];
  const states: unknown[] = [];
  const media = new CallMedia({
    role,
    video: true,
    iceServers: [{ urls: ['stun:stun.test'] }],
    send: (data) => sent.push(data),
    onChange: (state) => states.push(state),
  });
  return { media, sent, states };
}

it('the caller sends an offer and uses our ICE servers', async () => {
  const { media, sent } = engine('caller');
  await media.start();
  expect(mockPeers[0]?.config).toEqual({ iceServers: [{ urls: ['stun:stun.test'] }] });
  expect(sent[0]).toEqual({ sdp: { type: 'offer', sdp: 'offer-sdp' } });
});

it('the callee keeps early candidates, answers the offer, then adds them', async () => {
  const { media, sent } = engine('callee');
  await media.handle({ candidate: { candidate: 'early' } }); // before the camera started
  await media.start();
  await media.handle({ candidate: { candidate: 'before-offer' } });
  expect(mockPeers[0]?.candidates).toEqual([]);
  await media.handle({ sdp: { type: 'offer', sdp: 'offer-sdp' } });
  expect(sent).toContainEqual({ sdp: { type: 'answer', sdp: 'answer-sdp' } });
  expect(mockPeers[0]?.candidates).toEqual([{ candidate: 'early' }, { candidate: 'before-offer' }]);
  await media.handle({ candidate: { candidate: 'later' } });
  expect(mockPeers[0]?.candidates).toHaveLength(3);
});

it('mutes, turns the camera off and stops everything', async () => {
  const { media, states } = engine('caller');
  await media.start();
  media.setMuted(true);
  media.setCamera(false);
  expect(states.at(-1)).toMatchObject({ muted: true, cameraOn: false });
  media.stop();
  expect(mockPeers[0]?.closed).toBe(true);
});

it('hands over signals that arrived before the call screen listened', () => {
  receiveSignal(7, { sdp: { type: 'offer' } });
  receiveSignal(8, { sdp: { type: 'other call' } });
  const got: unknown[] = [];
  const stop = onSignal(7, (data) => got.push(data));
  receiveSignal(7, { candidate: { candidate: 'c' } });
  expect(got).toEqual([{ sdp: { type: 'offer' } }, { candidate: { candidate: 'c' } }]);
  stop();
});
