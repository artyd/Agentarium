import { prisma } from "./prisma.js";

const NICK = "[\\p{L}\\p{N}_.]{2,40}";
const EXTRACT_RE = new RegExp(`@(${NICK})`, "gu");
// Matches an HTML tag OR an @mention (so we only touch mentions in text, not attributes).
const LINKIFY_RE = new RegExp(`(<[^>]+>)|@(${NICK})`, "gu");

/** Unique candidate nicknames mentioned in a piece of text/HTML. */
export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(EXTRACT_RE)) set.add(m[1]);
  return [...set];
}

/** Replace @nick with a profile link, but only for nicknames that exist. */
export function linkifyMentions(html: string, valid: Set<string>): string {
  return html.replace(LINKIFY_RE, (full, tag: string | undefined, nick: string | undefined) => {
    if (tag) return tag;
    if (nick && valid.has(nick)) return `<a href="/profile/${nick}">@${nick}</a>`;
    return full;
  });
}

/** Given raw sanitized HTML, resolve mentions to real users. Returns the
 *  linkified HTML and the list of mentioned user ids (for notifications). */
export async function resolveMentions(html: string): Promise<{ html: string; userIds: { id: string; nickname: string }[] }> {
  const candidates = extractMentions(html);
  if (candidates.length === 0) return { html, userIds: [] };
  const users = await prisma.user.findMany({
    where: { nickname: { in: candidates } },
    select: { id: true, nickname: true },
  });
  const valid = new Set(users.map((u) => u.nickname));
  return { html: linkifyMentions(html, valid), userIds: users };
}
