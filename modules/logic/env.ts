export type EnvSource = Record<string, string | undefined>;

type GlobalEnv = typeof globalThis & {
  zuplo?: { env?: Record<string, string | undefined> };
  process?: { env?: Record<string, string | undefined> };
};

function readFromSource(
  source: Record<string, string | undefined> | undefined,
  key: string
): string | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readEnvValue(
  env: EnvSource | undefined,
  key: string
): string | null {
  const direct = readFromSource(env, key);
  if (direct) {
    return direct;
  }

  const globalEnv = (globalThis as GlobalEnv).zuplo?.env;
  const fromZuplo = readFromSource(globalEnv, key);
  if (fromZuplo) {
    return fromZuplo;
  }

  const processEnv = (globalThis as GlobalEnv).process?.env;
  const fromProcess = readFromSource(processEnv, key);
  if (fromProcess) {
    return fromProcess;
  }

  return null;
}
