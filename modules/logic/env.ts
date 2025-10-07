export type EnvSource = Record<string, string | undefined>;

export function readEnvValue(env: EnvSource | undefined, key: string): string | null {
  if (!env) {
    return null;
  }
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
