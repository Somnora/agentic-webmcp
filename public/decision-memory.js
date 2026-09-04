const DATABASE_NAME = "ribband-decision-memory-alpha";
const DATABASE_VERSION = 1;
const STORE_NAME = "facts";
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/;
const KINDS = new Set(["liked-experience", "disliked-experience", "interest", "avoidance", "existing-item"]);
const SOURCES = new Set(["user-stated", "inferred-and-confirmed"]);
const ALLOWED_USES = new Set(["shopping", "date", "vacation", "gift", "staffing"]);

function clean(value, maximum) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function timestamp(value, fallback) {
  const milliseconds = Date.parse(String(value ?? ""));
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : fallback;
}

function uses(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.filter((item) => ALLOWED_USES.has(item)))].slice(0, 5);
}

export function getDefaultSubjects(now = new Date().toISOString()) {
  return [
    {
      version: "1",
      id: "profile-self",
      ownerId: null,
      kind: "self",
      displayLabel: "Myself",
      relationship: null,
      ageBand: "adult",
      location: null,
      persistence: "saved-on-device",
      createdAt: now,
      updatedAt: now,
    },
    {
      version: "1",
      id: "profile-recipient",
      ownerId: null,
      kind: "recipient",
      displayLabel: "Loved One",
      relationship: "family",
      ageBand: "adult",
      location: null,
      persistence: "saved-on-device",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function normalizeApprovedMemoryFact(input = {}, now = new Date().toISOString()) {
  const id = clean(input.id, 64);
  const subjectId = clean(input.subjectId, 64) || "profile-self";
  const kind = KINDS.has(input.kind) ? input.kind : "";
  const value = clean(input.value, 240);
  const allowedUses = uses(input.allowedUses);
  if (!ID_PATTERN.test(id)) throw new Error("Approved memory needs a valid id.");
  if (!kind) throw new Error("Approved memory needs a supported experience type.");
  if (!value) throw new Error("Approved memory cannot be empty.");
  if (!allowedUses.length) throw new Error("Approved memory needs at least one allowed decision type.");
  const createdAt = timestamp(input.createdAt, now);
  const updatedAt = timestamp(input.updatedAt, now);
  return {
    version: "1",
    id,
    subjectId,
    kind,
    value,
    source: SOURCES.has(input.source) ? input.source : "inferred-and-confirmed",
    confidence: "confirmed",
    sensitivity: "private",
    lifeStage: "recent",
    allowedUses,
    lastConfirmedAt: timestamp(input.lastConfirmedAt, updatedAt),
    expiresAt: null,
    createdAt,
    updatedAt,
  };
}

export function projectApprovedMemoryFact(fact, vertical, subjectId) {
  const normalized = normalizeApprovedMemoryFact(fact);
  if (!normalized.allowedUses.includes(vertical)) throw new Error(`This memory is not approved for ${vertical} decisions.`);
  return { ...normalized, subjectId: clean(subjectId || normalized.subjectId, 64) };
}

function openDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("On-device memory storage is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The on-device memory database could not be opened."));
  });
}

function transactionResult(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    let result = null;
    let settled = false;
    request.onsuccess = () => { result = request.result ?? null; };
    request.onerror = () => reject(request.error ?? new Error("The on-device memory operation failed."));
    transaction.oncomplete = () => {
      database.close();
      settled = true;
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      if (!settled) reject(transaction.error ?? new Error("The on-device memory transaction failed."));
    };
    transaction.onabort = () => {
      database.close();
      if (!settled) reject(transaction.error ?? new Error("The on-device memory transaction was aborted."));
    };
  });
}

export async function loadApprovedMemoryFacts(indexedDb = globalThis.indexedDB) {
  const database = await openDatabase(indexedDb);
  const records = await transactionResult(database, "readonly", (store) => store.getAll());
  return (Array.isArray(records) ? records : []).flatMap((record) => {
    try {
      return [normalizeApprovedMemoryFact(record)];
    } catch {
      return [];
    }
  });
}

export async function saveApprovedMemoryFact(input, indexedDb = globalThis.indexedDB) {
  const fact = normalizeApprovedMemoryFact(input);
  const database = await openDatabase(indexedDb);
  await transactionResult(database, "readwrite", (store) => store.put(fact));
  return fact;
}

export async function deleteApprovedMemoryFact(id, indexedDb = globalThis.indexedDB) {
  const normalizedId = clean(id, 64);
  if (!ID_PATTERN.test(normalizedId)) throw new Error("Approved memory needs a valid id.");
  const database = await openDatabase(indexedDb);
  await transactionResult(database, "readwrite", (store) => store.delete(normalizedId));
}
