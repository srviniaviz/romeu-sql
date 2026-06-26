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

function getVaultPassword() {
  return "romeu-sql-local-vault";
}

async function getStore() {
  if (!storePromise) {
    storePromise = (async () => {
      const path = await join(await appDataDir(), STRONGHOLD_FILE);
      const stronghold = await Stronghold.load(path, getVaultPassword());
      const client = await stronghold
      .loadClient(STRONGHOLD_CLIENT)
        .catch(() => stronghold.createClient(STRONGHOLD_CLIENT));

      return {
        stronghold,
        store: client.getStore(),
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
    const { store } = await getStore();
    const value = await store.get(`${STORE_KEY_PREFIX}${id}`);
    return value ? decoder.decode(new Uint8Array(value)) : undefined;
  } catch (error) {
    console.error("[secretsRepository] Failed to read password:", error);
    return undefined;
  }
}

export async function setConnectionPassword(id: string, password: string) {
  await enqueueWrite(async () => {
    const { stronghold, store } = await getStore();
    await store.insert(`${STORE_KEY_PREFIX}${id}`, Array.from(encoder.encode(password)));
    await stronghold.save();
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
