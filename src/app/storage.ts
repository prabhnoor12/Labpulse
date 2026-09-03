const STORAGE_VERSION = 1;

type StorageValidator<T> = (value: unknown) => value is T;

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (error) {
    console.error('Browser storage is unavailable', error);
    return null;
  }
}

export function readStorage<T>(key: string, fallback: T, validate?: StorageValidator<T>): T {
  try {
    const storage = getLocalStorage();
    const serialized = storage?.getItem(key);
    if (!serialized) return fallback;

    const parsed: unknown = JSON.parse(serialized);
    const value = parsed && typeof parsed === 'object' && 'version' in parsed && 'value' in parsed
      ? (parsed as { version: number; value: unknown }).version <= STORAGE_VERSION
        ? (parsed as { version: number; value: unknown }).value
        : undefined
      : parsed;

    if (validate && !validate(value)) return fallback;
    return value as T;
  } catch (error) {
    console.error(`Failed to read local storage key "${key}"`, error);
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, value }));
    return true;
  } catch (error) {
    console.error(`Failed to write local storage key "${key}"`, error);
    return false;
  }
}
