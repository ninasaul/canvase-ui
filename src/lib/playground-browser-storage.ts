/** Shared browser persistence for playground (localStorage, with sessionStorage migrate). */

export function readBrowserStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const local = window.localStorage.getItem(key);
    if (local !== null) {
      return local;
    }
    const session = window.sessionStorage.getItem(key);
    if (session === null) {
      return null;
    }
    // One-shot migrate so popout / new tabs share the same store.
    try {
      window.localStorage.setItem(key, session);
      window.sessionStorage.removeItem(key);
    } catch {
      // keep reading from session if local is unavailable
    }
    return session;
  } catch {
    return null;
  }
}

export function writeBrowserStorage(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function removeBrowserStorage(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}
