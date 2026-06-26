import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir, join } from "@tauri-apps/api/path";

const STRONGHOLD_FILES = [
  "romeu-secrets-v5.stronghold",
  "romeu-secrets-v5-recovery.stronghold",
];
const STRONGHOLD_CLIENT = "romeu-sql";
const STORE_KEY_PREFIX = "connection-password:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let strongholdPromise: Promise<Stronghold> | null = null;
let strongholdPathPromise: Promise<string> | null = null;
let strongholdFileIndex = 0;

function withTimeout<T>(operation: Promise<T>, message: string, timeoutMs = 20000) {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        strongholdPromise = null;
        reject(new Error(message));
      }, timeoutMs);
    }),
  ]);
}

function getVaultPassword() {
  return "romeu-sql-local-vault";
}

function getStrongholdPath() {
  strongholdPathPromise = appDataDir().then((dir) =>
    join(dir, STRONGHOLD_FILES[strongholdFileIndex])
  );
  return strongholdPathPromise;
}

async function getStore() {
  if (!strongholdPromise) {
    if (!strongholdPathPromise) {
      strongholdPathPromise = getStrongholdPath();
    }

    strongholdPromise = strongholdPathPromise
      .then((path) =>
        withTimeout(
          Stronghold.load(path, getVaultPassword()),
          "Timed out opening the password vault."
        )
      )
      .catch((error) => {
        strongholdPromise = null;
        throw error;
      });
  }

  let stronghold: Stronghold;
  try {
    stronghold = await strongholdPromise;
  } catch (error) {
    if (strongholdFileIndex >= STRONGHOLD_FILES.length - 1) throw error;

    strongholdFileIndex += 1;
    strongholdPromise = null;
    strongholdPathPromise = getStrongholdPath();
    stronghold = await getStore().then((value) => value.stronghold);
  }

  const client = await withTimeout(
    stronghold
      .loadClient(STRONGHOLD_CLIENT)
      .catch(() => stronghold.createClient(STRONGHOLD_CLIENT)),
    "Timed out opening the password vault client."
  );

  return {
    stronghold,
    store: client.getStore(),
  };
}

export async function getConnectionPassword(id: string) {
  try {
    const { store } = await withTimeout(
      getStore(),
      "Timed out opening the password vault."
    );
    const value = await withTimeout(
      store.get(`${STORE_KEY_PREFIX}${id}`),
      "Timed out reading the saved password."
    );
    return value ? decoder.decode(new Uint8Array(value)) : undefined;
  } catch (error) {
    console.error("[secretsRepository] Failed to read password:", error);
    return undefined;
  }
}

export async function setConnectionPassword(id: string, password: string) {
  const { stronghold, store } = await withTimeout(
    getStore(),
    "Timed out opening the password vault."
  );
  await withTimeout(
    store.insert(`${STORE_KEY_PREFIX}${id}`, Array.from(encoder.encode(password))),
    "Timed out writing the saved password."
  );
  await withTimeout(stronghold.save(), "Timed out saving the password vault.");
}

export async function removeConnectionPassword(id: string) {
  try {
    const { stronghold, store } = await withTimeout(
      getStore(),
      "Timed out opening the password vault."
    );
    await withTimeout(
      store.remove(`${STORE_KEY_PREFIX}${id}`),
      "Timed out removing the saved password."
    );
    await withTimeout(stronghold.save(), "Timed out saving the password vault.");
  } catch (error) {
    console.error("[secretsRepository] Failed to remove password:", error);
  }
}
