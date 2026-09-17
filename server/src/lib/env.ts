function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? "8016", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PUBLIC_URL: process.env.PUBLIC_URL ?? "http://localhost:8016",
  DATABASE_URL: req("DATABASE_URL", "postgresql://agentarium:agentarium@localhost:5432/agentarium?schema=public"),
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-insecure-session-secret-change-me-0000000000",
  // 32-byte key as 64 hex chars for AES-256-GCM
  TOKEN_ENC_KEY: process.env.TOKEN_ENC_KEY ?? "00000000000000000000000000000000000000000000000000000000000000ff",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",
  GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL ?? "http://localhost:8016/api/github/callback",
  get isProd() {
    return this.NODE_ENV === "production";
  },
};
