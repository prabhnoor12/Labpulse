import type { DiagnosticReport, LabProfile, TestTemplate } from '@/domain/types';

const DATABASE_NAME = 'labpulse-offline';
const DATABASE_VERSION = 3;
const WORKSPACE_STORE = 'workspace';
const OUTBOX_STORE = 'outbox';
const OFFLINE_SESSIONS_STORE = 'offline-sessions';
const WORKSPACE_KEY = 'current';

const PBKDF2_ITERATIONS = 210_000;

interface OfflineSessionRecord {
  userId: string;
  labId: string;
  email: string;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  lastUsedAt: string;
}

interface EncryptedWorkspaceSnapshot {
  encrypted: true;
  userId: string;
  labId: string;
  salt: string;
  iv: string;
  ciphertext: string;
  savedAt: string;
}

export interface OfflineUnlockedSession {
  user: { id: string; labId: string; email: string; name: string; role: 'OWNER' | 'PATHOLOGIST' | 'TECHNICIAN' | 'RECEPTIONIST' | 'VIEWER' };
}

export interface WorkspaceSnapshot {
  userId: string;
  labId: string;
  savedAt: string;
  profile: LabProfile;
  templates: TestTemplate[];
  reports: DiagnosticReport[];
}

interface OfflineReportOperationBase {
  id: string;
  userId: string;
  labId: string;
  reportId: string;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  status: 'PENDING' | 'FAILED';
  lastError?: string;
}

export interface OfflineReportCreate extends OfflineReportOperationBase {
  kind: 'CREATE_REPORT';
  payload: DiagnosticReport;
}

export interface OfflineReportUpdate extends OfflineReportOperationBase {
  kind: 'UPDATE_REPORT';
  payload: DiagnosticReport;
}

export type OfflineReportOperation = OfflineReportCreate | OfflineReportUpdate;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error('Unable to open offline storage.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORKSPACE_STORE)) database.createObjectStore(WORKSPACE_STORE);
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) database.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(OFFLINE_SESSIONS_STORE)) database.createObjectStore(OFFLINE_SESSIONS_STORE, { keyPath: 'userId' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requireCrypto(): Crypto {
  if (typeof window === 'undefined' || !window.crypto?.subtle) throw new Error('Secure offline storage is unavailable in this browser.');
  return window.crypto;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveOfflineKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const cryptoApi = requireCrypto();
  const material = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptJson(value: unknown, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  const cryptoApi = requireCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const encrypted = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

async function decryptJson<T>(iv: string, ciphertext: string, key: CryptoKey): Promise<T> {
  const cryptoApi = requireCrypto();
  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

async function readOfflineSessionRecord(userId: string): Promise<OfflineSessionRecord | undefined> {
  const database = await openDatabase();
  return new Promise<OfflineSessionRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_SESSIONS_STORE, 'readonly');
    const request = transaction.objectStore(OFFLINE_SESSIONS_STORE).get(userId);
    request.onerror = () => reject(request.error || new Error('Unable to read offline session.'));
    request.onsuccess = () => resolve(request.result as OfflineSessionRecord | undefined);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read offline session.'));
  });
}

async function readWorkspaceRecord(): Promise<WorkspaceSnapshot | EncryptedWorkspaceSnapshot | undefined> {
  const database = await openDatabase();
  return new Promise<WorkspaceSnapshot | EncryptedWorkspaceSnapshot | undefined>((resolve, reject) => {
    const transaction = database.transaction(WORKSPACE_STORE, 'readonly');
    const request = transaction.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY);
    request.onerror = () => reject(request.error || new Error('Unable to read offline workspace.'));
    request.onsuccess = () => resolve(request.result as WorkspaceSnapshot | EncryptedWorkspaceSnapshot | undefined);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read offline workspace.'));
  });
}

export async function saveOfflineSession(user: OfflineUnlockedSession['user'], password: string): Promise<void> {
  const cryptoApi = requireCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const key = await deriveOfflineKey(password, salt);
  const encrypted = await encryptJson(user, key);
  const now = new Date().toISOString();
  const record: OfflineSessionRecord = {
    userId: user.id,
    labId: user.labId,
    email: user.email.toLowerCase(),
    salt: toBase64(salt),
    ...encrypted,
    createdAt: now,
    lastUsedAt: now,
  };

  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_SESSIONS_STORE, 'readwrite');
    transaction.objectStore(OFFLINE_SESSIONS_STORE).put(record);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save offline session.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function hasOfflineSession(): Promise<boolean> {
  const database = await openDatabase();
  return new Promise<boolean>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_SESSIONS_STORE, 'readonly');
    const request = transaction.objectStore(OFFLINE_SESSIONS_STORE).count();
    request.onerror = () => reject(request.error || new Error('Unable to inspect offline sessions.'));
    request.onsuccess = () => resolve(request.result > 0);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to inspect offline sessions.'));
  });
}

export async function unlockOfflineSession(email: string, password: string): Promise<OfflineUnlockedSession | undefined> {
  const database = await openDatabase();
  const records = await new Promise<OfflineSessionRecord[]>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_SESSIONS_STORE, 'readonly');
    const request = transaction.objectStore(OFFLINE_SESSIONS_STORE).getAll();
    request.onerror = () => reject(request.error || new Error('Unable to read offline sessions.'));
    request.onsuccess = () => resolve(request.result as OfflineSessionRecord[]);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read offline sessions.'));
  });

  const record = records.find((item) => item.email === email.trim().toLowerCase());
  if (!record) return undefined;
  try {
    const key = await deriveOfflineKey(password, fromBase64(record.salt));
    const user = await decryptJson<OfflineUnlockedSession['user']>(record.iv, record.ciphertext, key);
    return { user };
  } catch {
    return undefined;
  }
}

export async function clearOfflineSession(userId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_SESSIONS_STORE, 'readwrite');
    transaction.objectStore(OFFLINE_SESSIONS_STORE).delete(userId);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to clear offline session.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function enqueueOfflineReportOperation(operation: OfflineReportOperation): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    transaction.objectStore(OUTBOX_STORE).put(operation);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to queue offline report update.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export const enqueueOfflineReportCreate = enqueueOfflineReportOperation;
export const enqueueOfflineReportUpdate = enqueueOfflineReportOperation;

export async function listPendingOfflineReportOperations(userId: string, labId: string): Promise<OfflineReportOperation[]> {
  const database = await openDatabase();
  return new Promise<OfflineReportOperation[]>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX_STORE, 'readonly');
    const request = transaction.objectStore(OUTBOX_STORE).getAll();
    request.onerror = () => reject(request.error || new Error('Unable to read offline report operations.'));
    request.onsuccess = () => {
      const operations = (request.result as OfflineReportOperation[])
        .filter((operation) => operation.userId === userId && operation.labId === labId && operation.status === 'PENDING')
        .sort((left, right) => {
          if (left.kind !== right.kind) return left.kind === 'CREATE_REPORT' ? -1 : 1;
          return left.createdAt.localeCompare(right.createdAt);
        });
      resolve(operations);
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read offline report operations.'));
  });
}

export async function hasPendingOfflineReportCreate(userId: string, labId: string, reportId: string): Promise<boolean> {
  const operations = await listPendingOfflineReportOperations(userId, labId);
  return operations.some((operation) => operation.kind === 'CREATE_REPORT' && operation.reportId === reportId);
}

export async function remapOfflineReportUpdates(
  userId: string,
  labId: string,
  localReportId: string,
  serverReport: DiagnosticReport,
): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error || new Error('Unable to remap offline report updates.'));
    request.onsuccess = () => {
      const operations = request.result as OfflineReportOperation[];
      for (const operation of operations) {
        if (operation.userId !== userId || operation.labId !== labId || operation.kind !== 'UPDATE_REPORT' || operation.reportId !== localReportId) continue;
        store.put({
          ...operation,
          reportId: serverReport.id,
          payload: { ...operation.payload, id: serverReport.id, version: serverReport.version },
        });
      }
    };
    transaction.onerror = () => reject(transaction.error || new Error('Unable to remap offline report updates.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function removeOfflineOperation(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    transaction.objectStore(OUTBOX_STORE).delete(id);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to remove offline operation.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function markOfflineOperationFailed(id: string, error: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error || new Error('Unable to update offline operation.'));
    request.onsuccess = () => {
      const operation = request.result as OfflineReportOperation | undefined;
      if (operation) store.put({ ...operation, status: 'FAILED', attempts: operation.attempts + 1, lastError: error });
    };
    transaction.onerror = () => reject(transaction.error || new Error('Unable to update offline operation.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot, password: string): Promise<void> {
  const session = await readOfflineSessionRecord(snapshot.userId);
  if (!session) throw new Error('Offline session is not provisioned.');
  const key = await deriveOfflineKey(password, fromBase64(session.salt));
  const encrypted = await encryptJson(snapshot, key);
  const record: EncryptedWorkspaceSnapshot = {
    encrypted: true,
    userId: snapshot.userId,
    labId: snapshot.labId,
    salt: session.salt,
    ...encrypted,
    savedAt: snapshot.savedAt,
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKSPACE_STORE, 'readwrite');
    transaction.objectStore(WORKSPACE_STORE).put(record, WORKSPACE_KEY);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save offline workspace.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function readWorkspaceSnapshot(userId: string, labId: string, password: string): Promise<WorkspaceSnapshot | undefined> {
  const record = await readWorkspaceRecord();
  if (!record || !('encrypted' in record) || !record.encrypted || record.userId !== userId || record.labId !== labId) return undefined;
  const session = await readOfflineSessionRecord(userId);
  if (!session || session.salt !== record.salt) return undefined;
  try {
    const key = await deriveOfflineKey(password, fromBase64(session.salt));
    return await decryptJson<WorkspaceSnapshot>(record.iv, record.ciphertext, key);
  } catch {
    return undefined;
  }
}

export async function clearWorkspaceSnapshot(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKSPACE_STORE, 'readwrite');
    transaction.objectStore(WORKSPACE_STORE).delete(WORKSPACE_KEY);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to clear offline workspace.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

export async function clearOfflineOperations(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    transaction.objectStore(OUTBOX_STORE).clear();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to clear offline operations.'));
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}
