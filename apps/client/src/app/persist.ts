/**
 * Persistence. localStorage-backed with an in-memory fallback so the
 * game never depends on storage being available (private mode, etc.).
 */
const mem: Record<string, string> = {};

function available(): boolean {
  try {
    const k = '__bc_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const ok = typeof localStorage !== 'undefined' && available();

export const Store = {
  get(k: string): string | null {
    if (!ok) return mem[k] == null ? null : mem[k];
    try {
      return localStorage.getItem(k);
    } catch {
      return mem[k] ?? null;
    }
  },
  set(k: string, v: string): boolean {
    if (!ok) {
      mem[k] = v;
      return true;
    }
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      mem[k] = v;
      return false;
    }
  },
  del(k: string): void {
    if (!ok) {
      delete mem[k];
      return;
    }
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
};
