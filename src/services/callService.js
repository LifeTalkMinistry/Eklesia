import { apiRequest } from './apiClient.js';
import { hasBackendSession } from './backendSessionService.js';

export const CALL_STATE_UPDATED_EVENT = 'ekklesia-pulse:call-state-updated';

const TERMINAL_STATUSES = new Set(['declined', 'ended', 'missed', 'failed']);
const POLL_INTERVAL_MS = 1000;
const INCOMING_POLL_INTERVAL_MS = 2500;

let callState = {
  phase: 'idle',
  call: null,
  mode: 'audio',
  remoteName: '',
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  error: '',
};

let peerConnection = null;
let activePollTimer = null;
let incomingPollTimer = null;
let activePollRunning = false;
let incomingPollRunning = false;
let lastSignalId = 0;
let pendingIceCandidates = [];
let autoResetTimer = null;

function emitState() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CALL_STATE_UPDATED_EVENT, { detail: { state: callState } }));
}

function updateState(patch) {
  callState = { ...callState, ...patch };
  emitState();
  return callState;
}

function clearAutoReset() {
  if (autoResetTimer) window.clearTimeout(autoResetTimer);
  autoResetTimer = null;
}

function stopActivePolling() {
  if (activePollTimer) window.clearInterval(activePollTimer);
  activePollTimer = null;
  activePollRunning = false;
}

function stopTracks(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function destroyPeerConnection({ stopLocal = true } = {}) {
  stopActivePolling();
  pendingIceCandidates = [];
  lastSignalId = 0;

  if (peerConnection) {
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }

  if (stopLocal) stopTracks(callState.localStream);
  stopTracks(callState.remoteStream);
}

function resetToIdle() {
  clearAutoReset();
  destroyPeerConnection();
  callState = {
    phase: 'idle',
    call: null,
    mode: 'audio',
    remoteName: '',
    localStream: null,
    remoteStream: null,
    muted: false,
    cameraOff: false,
    error: '',
  };
  emitState();
}

function finishWithStatus(call, message = '') {
  destroyPeerConnection();
  updateState({
    phase: 'ended',
    call: call || callState.call,
    localStream: null,
    remoteStream: null,
    error: message,
  });
  clearAutoReset();
  autoResetTimer = window.setTimeout(resetToIdle, 2500);
}

function getIceServers() {
  const configured = String(import.meta.env.VITE_WEBRTC_ICE_SERVERS || '').trim();
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      console.warn('Ekklesia Pulse could not parse VITE_WEBRTC_ICE_SERVERS.', error);
    }
  }

  return [{ urls: 'stun:stun.l.google.com:19302' }];
}

async function requestMedia(mode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone or camera calls.');
  }

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: mode === 'video' ? { facingMode: 'user' } : false,
  });
}

async function postSignal(callId, type, payload) {
  await apiRequest(`/api/ekklesia/calls/${encodeURIComponent(callId)}/signals`, {
    method: 'POST',
    body: { type, payload },
    timeoutMs: 10000,
  });
}

async function flushPendingIce() {
  if (!peerConnection?.remoteDescription) return;
  const candidates = pendingIceCandidates;
  pendingIceCandidates = [];
  for (const candidate of candidates) {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.warn('Ekklesia Pulse could not add a queued ICE candidate.', error);
    }
  }
}

async function handleRemoteSignal(signal) {
  if (!peerConnection || !signal?.payload) return;

  if (signal.type === 'offer') {
    if (peerConnection.remoteDescription) return;
    await peerConnection.setRemoteDescription(signal.payload);
    await flushPendingIce();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await postSignal(callState.call.id, 'answer', peerConnection.localDescription.toJSON());
    return;
  }

  if (signal.type === 'answer') {
    if (peerConnection.remoteDescription) return;
    await peerConnection.setRemoteDescription(signal.payload);
    await flushPendingIce();
    return;
  }

  if (signal.type === 'ice') {
    const candidate = new RTCIceCandidate(signal.payload);
    if (peerConnection.remoteDescription) await peerConnection.addIceCandidate(candidate);
    else pendingIceCandidates.push(candidate);
  }
}

async function pollActiveCall() {
  if (activePollRunning || !callState.call?.id || callState.phase === 'idle') return;
  activePollRunning = true;

  try {
    const payload = await apiRequest(
      `/api/ekklesia/calls/${encodeURIComponent(callState.call.id)}?afterSignalId=${lastSignalId}`,
      { timeoutMs: 9000 },
    );
    const call = payload.call;
    const signals = Array.isArray(payload.signals) ? payload.signals : [];

    for (const signal of signals) {
      lastSignalId = Math.max(lastSignalId, Number(signal.id) || 0);
      await handleRemoteSignal(signal);
    }

    if (TERMINAL_STATUSES.has(call.status)) {
      const label = call.status === 'declined'
        ? 'Call declined.'
        : call.status === 'missed'
          ? 'No answer.'
          : call.status === 'failed'
            ? 'Call failed.'
            : 'Call ended.';
      finishWithStatus(call, label);
      return;
    }

    const connected = peerConnection?.connectionState === 'connected';
    updateState({
      call,
      phase: connected ? 'connected' : call.status === 'accepted' ? 'connecting' : callState.phase,
    });
  } catch (error) {
    if (error.status === 404 || error.status === 401) {
      finishWithStatus(callState.call, error.message);
    }
  } finally {
    activePollRunning = false;
  }
}

function startActivePolling() {
  stopActivePolling();
  void pollActiveCall();
  activePollTimer = window.setInterval(() => void pollActiveCall(), POLL_INTERVAL_MS);
}

function createConnection(call, localStream) {
  if (!globalThis.RTCPeerConnection) {
    throw new Error('This browser does not support live audio or video calls.');
  }

  peerConnection = new RTCPeerConnection({ iceServers: getIceServers() });
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (event) => {
    if (!event.candidate || !callState.call?.id) return;
    void postSignal(callState.call.id, 'ice', event.candidate.toJSON()).catch((error) => {
      console.warn('Ekklesia Pulse could not send an ICE candidate.', error);
    });
  };

  peerConnection.ontrack = (event) => {
    const stream = event.streams?.[0] || new MediaStream([event.track]);
    updateState({ remoteStream: stream });
  };

  peerConnection.onconnectionstatechange = () => {
    const connectionState = peerConnection?.connectionState;
    if (connectionState === 'connected') {
      updateState({ phase: 'connected', error: '' });
    } else if (connectionState === 'failed') {
      void endCurrentCall('The call connection failed.');
    }
  };

  return peerConnection;
}

export function getCallState() {
  return callState;
}

export function showCallUnavailable(remoteName = 'This churchmate') {
  clearAutoReset();
  updateState({
    phase: 'error',
    call: null,
    mode: 'audio',
    remoteName,
    localStream: null,
    remoteStream: null,
    muted: false,
    cameraOff: false,
    error: `${remoteName} must connect an Ekklesia account before live calls can ring.`,
  });
}

export async function startOutgoingCall({ calleeUserId, remoteName, mode }) {
  clearAutoReset();

  if (!hasBackendSession()) {
    showCallUnavailable(remoteName || 'This churchmate');
    updateState({ error: 'Connect your Ekklesia account before starting a live call.' });
    return { ok: false };
  }

  const normalizedCalleeId = String(calleeUserId || '').trim();
  if (!/^\d+$/.test(normalizedCalleeId)) {
    showCallUnavailable(remoteName || 'This churchmate');
    return { ok: false };
  }

  if (callState.phase !== 'idle') return { ok: false };

  const callMode = mode === 'video' ? 'video' : 'audio';
  updateState({
    phase: 'requesting-media',
    mode: callMode,
    remoteName: remoteName || 'Churchmate',
    error: '',
  });

  let localStream;
  try {
    localStream = await requestMedia(callMode);
    const payload = await apiRequest('/api/ekklesia/calls', {
      method: 'POST',
      body: { calleeUserId: normalizedCalleeId, mode: callMode },
    });
    const call = payload.call;

    updateState({
      phase: 'outgoing-ringing',
      call,
      mode: callMode,
      remoteName: call.remoteMember?.name || remoteName || 'Churchmate',
      localStream,
      remoteStream: null,
      muted: false,
      cameraOff: false,
      error: '',
    });

    const connection = createConnection(call, localStream);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await postSignal(call.id, 'offer', connection.localDescription.toJSON());
    startActivePolling();
    return { ok: true, call };
  } catch (error) {
    stopTracks(localStream);
    destroyPeerConnection({ stopLocal: false });
    updateState({
      phase: 'error',
      call: null,
      localStream: null,
      remoteStream: null,
      error: error?.name === 'NotAllowedError'
        ? 'Microphone or camera permission was not allowed.'
        : error.message || 'The call could not be started.',
    });
    return { ok: false, error };
  }
}

async function pollIncomingCall() {
  if (incomingPollRunning || callState.phase !== 'idle' || !hasBackendSession()) return;
  incomingPollRunning = true;
  try {
    const payload = await apiRequest('/api/ekklesia/calls/incoming', { timeoutMs: 8000 });
    if (payload.call && callState.phase === 'idle') {
      clearAutoReset();
      updateState({
        phase: 'incoming-ringing',
        call: payload.call,
        mode: payload.call.mode,
        remoteName: payload.call.remoteMember?.name || 'Churchmate',
        localStream: null,
        remoteStream: null,
        muted: false,
        cameraOff: false,
        error: '',
      });
    }
  } catch (error) {
    if (!error.isNetworkError && error.status !== 401) {
      console.warn('Ekklesia Pulse could not check incoming calls.', error);
    }
  } finally {
    incomingPollRunning = false;
  }
}

export function startIncomingCallWatch() {
  if (typeof window === 'undefined') return () => {};
  if (!incomingPollTimer) {
    void pollIncomingCall();
    incomingPollTimer = window.setInterval(() => void pollIncomingCall(), INCOMING_POLL_INTERVAL_MS);
  }
  return () => {};
}

export async function answerIncomingCall() {
  if (callState.phase !== 'incoming-ringing' || !callState.call?.id) return { ok: false };
  updateState({ phase: 'requesting-media', error: '' });

  let localStream;
  try {
    localStream = await requestMedia(callState.mode);
    const payload = await apiRequest(`/api/ekklesia/calls/${callState.call.id}/answer`, {
      method: 'POST',
      body: {},
    });
    const call = payload.call;
    updateState({
      phase: 'connecting',
      call,
      localStream,
      remoteStream: null,
      muted: false,
      cameraOff: false,
      error: '',
    });
    createConnection(call, localStream);
    startActivePolling();
    return { ok: true };
  } catch (error) {
    stopTracks(localStream);
    destroyPeerConnection({ stopLocal: false });
    updateState({
      phase: 'error',
      localStream: null,
      remoteStream: null,
      error: error?.name === 'NotAllowedError'
        ? 'Microphone or camera permission was not allowed.'
        : error.message || 'The call could not be answered.',
    });
    return { ok: false, error };
  }
}

export async function declineIncomingCall() {
  if (!callState.call?.id) return;
  try {
    await apiRequest(`/api/ekklesia/calls/${callState.call.id}/decline`, { method: 'POST', body: {} });
  } catch (error) {
    console.warn('Ekklesia Pulse could not decline the call cleanly.', error);
  }
  finishWithStatus(callState.call, 'Call declined.');
}

export async function endCurrentCall(message = 'Call ended.') {
  const call = callState.call;
  if (call?.id) {
    try {
      await apiRequest(`/api/ekklesia/calls/${call.id}/end`, { method: 'POST', body: {} });
    } catch (error) {
      console.warn('Ekklesia Pulse could not end the call cleanly.', error);
    }
  }
  finishWithStatus(call, message);
}

export function toggleCallMute() {
  const nextMuted = !callState.muted;
  callState.localStream?.getAudioTracks?.().forEach((track) => {
    track.enabled = !nextMuted;
  });
  updateState({ muted: nextMuted });
}

export function toggleCallCamera() {
  const videoTracks = callState.localStream?.getVideoTracks?.() || [];
  if (!videoTracks.length) return;
  const nextCameraOff = !callState.cameraOff;
  videoTracks.forEach((track) => {
    track.enabled = !nextCameraOff;
  });
  updateState({ cameraOff: nextCameraOff });
}

export function closeCallOverlay() {
  if (['outgoing-ringing', 'connecting', 'connected', 'requesting-media', 'incoming-ringing'].includes(callState.phase)) {
    void endCurrentCall();
    return;
  }
  resetToIdle();
}
