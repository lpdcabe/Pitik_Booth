import { SIGNAL_TYPES } from "../constants/realtimeEvents";

export function isPeerSignal(signal, participantId) {
  return !!signal && SIGNAL_TYPES.includes(signal.type) &&
    signal.fromParticipantId !== participantId &&
    (!signal.toParticipantId || signal.toParticipantId === participantId);
}

export function createSignalBus() {
  const listeners = new Set();
  return {
    subscribe(handler) { listeners.add(handler); return () => listeners.delete(handler); },
    emit(signal) { for (const handler of listeners) handler(signal); },
    clear() { listeners.clear(); },
  };
}
