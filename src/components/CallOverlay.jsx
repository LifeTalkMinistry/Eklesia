import { useEffect, useRef, useState } from 'react';
import {
  answerIncomingCall,
  CALL_STATE_UPDATED_EVENT,
  closeCallOverlay,
  declineIncomingCall,
  endCurrentCall,
  getCallState,
  startIncomingCallWatch,
  toggleCallCamera,
  toggleCallMute,
} from '../services/callService.js';
import './CallOverlay.css';

function MicrophoneIcon({ muted = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 10.5a5.5 5.5 0 0 0 11 0M12 16v3M9 19h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {muted ? <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : null}
    </svg>
  );
}

function CameraIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6.5" width="13" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 10 5-2.8v9.6L16 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {off ? <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : null}
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 3.8 10 7.4 8.2 9.6c1.4 2.8 3.4 4.8 6.2 6.2l2.2-1.8 3.6 2.8c.2.2.3.5.2.8-.5 1.8-2.1 3-4 2.8C9.8 19.8 4.2 14.2 3.6 7.6c-.2-1.9 1-3.5 2.8-4 .3-.1.6 0 .8.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function statusText(state) {
  if (state.phase === 'incoming-ringing') return `Incoming ${state.mode === 'video' ? 'video' : 'audio'} call`;
  if (state.phase === 'outgoing-ringing') return 'Ringing…';
  if (state.phase === 'requesting-media') return 'Preparing microphone and camera…';
  if (state.phase === 'connecting') return 'Connecting…';
  if (state.phase === 'connected') return 'Connected';
  if (state.phase === 'ended') return state.error || 'Call ended.';
  return state.error || 'Call unavailable';
}

export default function CallOverlayHost() {
  const [state, setState] = useState(getCallState);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    const stopWatch = startIncomingCallWatch();
    function handleState(event) {
      setState(event.detail?.state || getCallState());
    }
    window.addEventListener(CALL_STATE_UPDATED_EVENT, handleState);
    return () => {
      window.removeEventListener(CALL_STATE_UPDATED_EVENT, handleState);
      stopWatch?.();
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = state.localStream || null;
  }, [state.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = state.remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = state.remoteStream || null;
  }, [state.remoteStream]);

  if (state.phase === 'idle') return null;

  const active = ['outgoing-ringing', 'requesting-media', 'connecting', 'connected'].includes(state.phase);
  const videoCall = state.mode === 'video';
  const initials = String(state.remoteName || 'Churchmate').trim().charAt(0).toUpperCase() || 'E';

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label={`${videoCall ? 'Video' : 'Audio'} call with ${state.remoteName || 'churchmate'}`}>
      <section className={`call-stage ${videoCall ? 'is-video' : 'is-audio'} is-${state.phase}`}>
        {videoCall && state.remoteStream ? (
          <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
        ) : (
          <div className="call-identity">
            <span className="call-avatar" aria-hidden="true">{initials}</span>
            <h2>{state.remoteName || 'Churchmate'}</h2>
            <p>{statusText(state)}</p>
          </div>
        )}

        {!videoCall ? <audio ref={remoteAudioRef} autoPlay /> : null}

        {videoCall && state.localStream ? (
          <video ref={localVideoRef} className={`call-local-video ${state.cameraOff ? 'is-camera-off' : ''}`} autoPlay muted playsInline />
        ) : null}

        {videoCall && state.remoteStream ? (
          <div className="call-video-status">
            <strong>{state.remoteName || 'Churchmate'}</strong>
            <span>{statusText(state)}</span>
          </div>
        ) : null}

        {state.phase === 'incoming-ringing' ? (
          <div className="call-incoming-actions">
            <button className="call-action is-decline" type="button" onClick={() => void declineIncomingCall()}>
              <PhoneIcon />
              <span>Decline</span>
            </button>
            <button className="call-action is-answer" type="button" onClick={() => void answerIncomingCall()}>
              {videoCall ? <CameraIcon /> : <PhoneIcon />}
              <span>Answer</span>
            </button>
          </div>
        ) : null}

        {active ? (
          <div className="call-controls">
            <button type="button" onClick={toggleCallMute} aria-label={state.muted ? 'Unmute microphone' : 'Mute microphone'} className={state.muted ? 'is-off' : ''}>
              <MicrophoneIcon muted={state.muted} />
              <span>{state.muted ? 'Unmute' : 'Mute'}</span>
            </button>
            {videoCall ? (
              <button type="button" onClick={toggleCallCamera} aria-label={state.cameraOff ? 'Turn camera on' : 'Turn camera off'} className={state.cameraOff ? 'is-off' : ''}>
                <CameraIcon off={state.cameraOff} />
                <span>{state.cameraOff ? 'Camera on' : 'Camera off'}</span>
              </button>
            ) : null}
            <button className="is-end" type="button" onClick={() => void endCurrentCall()} aria-label="End call">
              <PhoneIcon />
              <span>End</span>
            </button>
          </div>
        ) : null}

        {['error', 'ended'].includes(state.phase) ? (
          <button className="call-close-button" type="button" onClick={closeCallOverlay}>Close</button>
        ) : null}
      </section>
    </div>
  );
}
