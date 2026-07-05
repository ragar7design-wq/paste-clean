export function track(event, data = {}) {
  try { self.dispatchEvent(new CustomEvent('pc:track', { detail: { event, ...data, ts: Date.now() } })); } catch {}
}

export function trackSummary(mode, stats) {
  track('result', { mode, ...stats });
}
