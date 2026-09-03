export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch (error) {
    console.error(`Failed to read local storage key "${key}"`, error);
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write local storage key "${key}"`, error);
  }
}
