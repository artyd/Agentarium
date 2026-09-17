import type { Lang } from "../i18n/strings";

export function initials(nickname: string): string {
  const parts = nickname.replace(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9.]/g, "").split(/[.\-_ ]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nickname.slice(0, 2).toUpperCase();
}

// Deterministic pleasant avatar color from a string.
const COLORS = ["#6c5ce7", "#00b894", "#ff9f1c", "#e84393", "#26c6da", "#1a9c5b", "#e0554b"];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function timeAgo(iso: string, lang: Lang): string {
  const then = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const u =
    lang === "ua"
      ? { m: "хв", h: "год", d: "дн", now: "щойно" }
      : { m: "m", h: "h", d: "d", now: "now" };
  if (s < 60) return u.now;
  if (s < 3600) return `${Math.floor(s / 60)} ${u.m}`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${u.h}`;
  return `${Math.floor(s / 86400)} ${u.d}`;
}
