import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir, join } from "@tauri-apps/api/path";

const STRONGHOLD_FILE = "romeu-secrets-v6.stronghold";
const STRONGHOLD_CLIENT = "romeu-sql";
const STORE_KEY_PREFIX = "connection-password:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type StrongholdStore = Awaited<ReturnType<Awaited<ReturnType<Stronghold["loadClient"]>>["getStore"]>>;

let storePromise: Promise<{ stronghold: Stronghold; store: StrongholdStore }> | null = null;
let writeQueue = Promise.resolve();

function logSlow(label: string, started: number) {
  const elapsed = performance.now() - started;
  if (elapsed >= 100) {
    console.warn(`[romeu-sql][stronghold] ${label} ${elapsed.toFixed(0)}ms`);
  }
}

function getVaultPassword() {
  return "romeu-sql-local-vault";
}

async function getStore() {
  if (!storePromise) {
    storePromise = (async () => {
      const resolveStarted = performance.now();
      const path = await join(await appDataDir(), STRONGHOLD_FILE);
      logSlow("resolve path", resolveStarted);

      const loadStarted = performance.now();
      const stronghold = await Stronghold.load(path, getVaultPassword());
      logSlow("Stronghold.load", loadStarted);

      const clientStarted = performance.now();
      const client = await stronghold
      .loadClient(STRONGHOLD_CLIENT)
        .catch(() => stronghold.createClient(STRONGHOLD_CLIENT));
      logSlow("load/create client", clientStarted);

      const storeStarted = performance.now();
      const store = client.getStore();
      logSlow("get store", storeStarted);

      return {
        stronghold,
        store,
      };
    })().catch((error) => {
      storePromise = null;
      throw error;
    });
  }

  return storePromise;
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function getConnectionPassword(id: string) {
  try {
    const storeStarted = performance.now();
    const { store } = await getStore();
    logSlow("getStore total", storeStarted);

    const readStarted = performance.now();
    const value = await store.get(`${STORE_KEY_PREFIX}${id}`);
    logSlow("store.get password", readStarted);
    return value ? decoder.decode(new Uint8Array(value)) : undefined;
  } catch (error) {
    console.error("[secretsRepository] Failed to read password:", error);
    return undefined;
  }
}

export async function warmStronghold() {
  await getStore();
}

export async function benchmarkStronghold(id: string, iterations = 3) {
  const results: Array<{ step: string; ms: number }> = [];
  const measure = async <T>(step: string, operation: () => Promise<T>) => {
    const started = performance.now();
    const value = await operation();
    results.push({ step, ms: Math.round(performance.now() - started) });
    return value;
  };

  await measure("warm getStore", getStore);
  for (let index = 0; index < iterations; index += 1) {
    await measure(`store.get #${index + 1}`, async () => {
      const { store } = await getStore();
      return store.get(`${STORE_KEY_PREFIX}${id}`);
    });
  }

  console.table(results);
  return results;
}

export async function setConnectionPassword(id: string, password: string) {
  await enqueueWrite(async () => {
    const storeStarted = performance.now();
    const { stronghold, store } = await getStore();
    logSlow("getStore for write", storeStarted);

    const insertStarted = performance.now();
    await store.insert(`${STORE_KEY_PREFIX}${id}`, Array.from(encoder.encode(password)));
    logSlow("store.insert password", insertStarted);

    const saveStarted = performance.now();
    await stronghold.save();
    logSlow("stronghold.save", saveStarted);
  });
}

export async function removeConnectionPassword(id: string) {
  try {
    await enqueueWrite(async () => {
      const { stronghold, store } = await getStore();
      await store.remove(`${STORE_KEY_PREFIX}${id}`);
      await stronghold.save();
    });
  } catch (error) {
    console.error("[secretsRepository] Failed to remove password:", error);
  }
}
