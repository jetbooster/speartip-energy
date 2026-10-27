const STORAGE_KEY = 'speartip.chargeKey';
const HASH_PARAM = 'chargeKey';

// One-time setup: open the display once as /#chargeKey=<key>. The key is stored on this device
// and removed from the address bar. It is never part of the built bundle.
export const captureChargeKeyFromHash = () => {
  const key = new URLSearchParams(window.location.hash.slice(1)).get(HASH_PARAM);
  if (!key) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, key);
  }
  catch {
    // Storage unavailable: keep the key in the URL so setup can be retried.
    return;
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
};

export const getChargeKey = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  }
  catch {
    return null;
  }
};
