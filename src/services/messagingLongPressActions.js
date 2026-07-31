const LONG_PRESS_DELAY_MS = 440;
const MOVE_TOLERANCE_PX = 12;
const OPEN_CLASS = 'is-message-actions-open';

let installed = false;
let pressTimer = 0;
let pressTarget = null;
let pointerId = null;
let startX = 0;
let startY = 0;
let suppressBubbleClickUntil = 0;

function clearPress() {
  if (pressTimer) {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
  }
  pressTarget = null;
  pointerId = null;
}

function getElement(target) {
  return target instanceof Element ? target : null;
}

function getMessageFromBubble(target) {
  const element = getElement(target);
  const bubble = element?.closest('.messaging-bubble');
  const message = bubble?.closest('.messaging-message');
  if (!message?.querySelector('.messaging-message-actions')) return null;
  return message;
}

function closeMessageActions(except = null) {
  document.querySelectorAll(`.messaging-message.${OPEN_CLASS}`).forEach((message) => {
    if (message !== except) message.classList.remove(OPEN_CLASS);
  });
}

function openMessageActions(message) {
  if (!message?.isConnected) return;
  closeMessageActions(message);
  message.classList.add(OPEN_CLASS);
  suppressBubbleClickUntil = Date.now() + 550;

  try {
    window.navigator?.vibrate?.(12);
  } catch {
    // Vibration is optional and unsupported in some browsers.
  }
}

function beginLongPress(event) {
  const element = getElement(event.target);
  if (!element || element.closest('.messaging-message-actions')) return;

  const message = getMessageFromBubble(element);
  const currentlyOpen = document.querySelector(`.messaging-message.${OPEN_CLASS}`);

  if (!message) {
    if (currentlyOpen && !currentlyOpen.contains(element)) closeMessageActions();
    return;
  }

  if (currentlyOpen && currentlyOpen !== message) closeMessageActions();
  if (message.classList.contains(OPEN_CLASS)) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  clearPress();
  pressTarget = message;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  pressTimer = window.setTimeout(() => {
    openMessageActions(pressTarget);
    clearPress();
  }, LONG_PRESS_DELAY_MS);
}

function trackPointerMove(event) {
  if (!pressTimer || event.pointerId !== pointerId) return;
  const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
  if (distance > MOVE_TOLERANCE_PX) clearPress();
}

function finishPointer(event) {
  if (pointerId == null || event.pointerId === pointerId) clearPress();
}

function handleContextMenu(event) {
  const message = getMessageFromBubble(event.target);
  if (!message) return;
  event.preventDefault();
  clearPress();
  openMessageActions(message);
}

function handleClickCapture(event) {
  const element = getElement(event.target);
  if (!element) return;

  if (element.closest('.messaging-message-actions button')) {
    window.setTimeout(() => closeMessageActions(), 0);
    return;
  }

  if (Date.now() < suppressBubbleClickUntil && element.closest('.messaging-bubble')) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    clearPress();
    closeMessageActions();
  }
}

export function installMessagingLongPressActions() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('pointerdown', beginLongPress, true);
  document.addEventListener('pointermove', trackPointerMove, true);
  document.addEventListener('pointerup', finishPointer, true);
  document.addEventListener('pointercancel', finishPointer, true);
  document.addEventListener('contextmenu', handleContextMenu, true);
  document.addEventListener('click', handleClickCapture, true);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('scroll', () => {
    clearPress();
    closeMessageActions();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearPress();
      closeMessageActions();
    }
  });
}
