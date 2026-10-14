import "@testing-library/jest-dom";

/**
 * Newer Node versions ship an experimental Web Storage global that shadows jsdom's localStorage and
 * throws unless a flag is passed. Install a plain in-memory Storage so persistence code is testable
 * identically on every Node version.
 */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(globalThis, name, {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
}
