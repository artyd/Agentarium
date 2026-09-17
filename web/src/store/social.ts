// Social-link platforms with thematic emoji icons (on-brand with the playful design).
export type Platform = {
  key: string;
  label: string;
  emoji: string;
  match?: string[]; // substrings to auto-detect from a raw URL
  prefix?: string; // used to build a full URL from a bare handle
  placeholder: string;
};

export const PLATFORMS: Platform[] = [
  { key: "website", label: "Сайт", emoji: "🌐", placeholder: "https://…" },
  { key: "github", label: "GitHub", emoji: "🐙", match: ["github.com"], prefix: "https://github.com/", placeholder: "github.com/нік" },
  { key: "telegram", label: "Telegram", emoji: "✈️", match: ["t.me", "telegram"], prefix: "https://t.me/", placeholder: "@нік" },
  { key: "twitter", label: "X / Twitter", emoji: "🐦", match: ["x.com", "twitter.com"], prefix: "https://x.com/", placeholder: "@нік" },
  { key: "linkedin", label: "LinkedIn", emoji: "💼", match: ["linkedin.com"], prefix: "https://linkedin.com/in/", placeholder: "linkedin.com/in/…" },
  { key: "instagram", label: "Instagram", emoji: "📷", match: ["instagram.com"], prefix: "https://instagram.com/", placeholder: "@нік" },
  { key: "youtube", label: "YouTube", emoji: "▶️", match: ["youtube.com", "youtu.be"], prefix: "https://youtube.com/@", placeholder: "@канал" },
  { key: "discord", label: "Discord", emoji: "🎮", match: ["discord"], placeholder: "нік або інвайт" },
  { key: "email", label: "Email", emoji: "✉️", match: ["mailto:"], prefix: "mailto:", placeholder: "you@example.com" },
];

export const platform = (key: string) => PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[0];

/** Stored form is "key|value"; falls back to detecting the platform from a plain URL. */
export function parseLink(s: string): { key: string; value: string } {
  const i = s.indexOf("|");
  if (i > 0) {
    const key = s.slice(0, i);
    if (PLATFORMS.some((p) => p.key === key)) return { key, value: s.slice(i + 1) };
  }
  const lower = s.toLowerCase();
  const p = PLATFORMS.find((pl) => pl.match?.some((m) => lower.includes(m)));
  return { key: p?.key ?? "website", value: s };
}

export function linkHref(key: string, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v)) return v;
  if (key === "email") return "mailto:" + v.replace(/^@/, "");
  const p = platform(key);
  if (p.prefix) return p.prefix + v.replace(/^@/, "");
  return "https://" + v;
}

/** Short readable label for a link pill (strip protocol/trailing slash). */
export function linkText(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/^mailto:/i, "").replace(/\/$/, "");
}
