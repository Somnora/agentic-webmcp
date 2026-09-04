const DATABASE_NAME = "ribband-profile-alpha";
const DATABASE_VERSION = 1;
const STORE_NAME = "profiles";
const RECIPIENT_KEY = "gift-recipient";
const AGE_BANDS = new Set(["child", "teen", "adult", "older-adult", "not-provided"]);

function clean(value, maximum) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function cleanList(value, maximumItems = 6) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(source.map((item) => clean(item, 60)).filter(Boolean))].slice(0, maximumItems);
}

export function normalizeLocalGiftProfile(input = {}) {
  const ageBand = AGE_BANDS.has(input.ageBand) ? input.ageBand : "not-provided";
  const now = new Date().toISOString();
  const id = clean(input.id, 64) || crypto.randomUUID();
  return {
    version: "1",
    id,
    recipientLabel: clean(input.recipientLabel, 60) || "Someone else",
    ageBand,
    interests: cleanList(input.interests),
    memorySignal: clean(input.memorySignal, 120),
    avoid: clean(input.avoid, 80),
    createdAt: clean(input.createdAt, 40) || now,
    updatedAt: now,
  };
}

function openDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("On-device profile storage is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The on-device profile database could not be opened."));
  });
}

function transactionResult(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("The on-device profile operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function loadLocalGiftProfile(indexedDb = globalThis.indexedDB) {
  const database = await openDatabase(indexedDb);
  const value = await transactionResult(database, "readonly", (store) => store.get(RECIPIENT_KEY));
  return value && typeof value === "object" ? normalizeLocalGiftProfile(value) : null;
}

export async function saveLocalGiftProfile(input, indexedDb = globalThis.indexedDB) {
  const profile = normalizeLocalGiftProfile(input);
  const database = await openDatabase(indexedDb);
  await transactionResult(database, "readwrite", (store) => store.put(profile, RECIPIENT_KEY));
  return profile;
}

export async function deleteLocalGiftProfile(indexedDb = globalThis.indexedDB) {
  const database = await openDatabase(indexedDb);
  await transactionResult(database, "readwrite", (store) => store.delete(RECIPIENT_KEY));
}
