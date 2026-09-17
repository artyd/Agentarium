import sanitizeHtml from "sanitize-html";

const linkTransform: NonNullable<sanitizeHtml.IOptions["transformTags"]> = {
  a: (tagName: string, attribs: Record<string, string>) => {
    const href = attribs.href ?? "";
    // Internal links (e.g. /profile/nick mentions) stay in-app; external open in a new tab.
    const out: Record<string, string> = href.startsWith("/")
      ? { href }
      : { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" };
    return { tagName, attribs: out };
  },
};

// Allow-list for full rich content (post body, comments). Adds u/s underline+strike.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "i", "u", "s", "strong", "em", "a", "img", "p", "br", "code", "pre"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: linkTransform,
};

// Inline-only allow-list for single-line fields like the post title: formatting
// marks are kept, block/media tags are stripped to text.
const INLINE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "i", "u", "s", "strong", "em", "a", "code"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: linkTransform,
};

/** Sanitize rich HTML from the editor (defense in depth: called on write and on read). */
export function cleanHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", OPTIONS);
}

/** Sanitize a single-line rich field (title): inline marks only, no blocks/newlines. */
export function cleanInline(dirty: string): string {
  return sanitizeHtml(dirty ?? "", INLINE_OPTIONS).replace(/\r?\n+/g, " ").trim();
}

/** Strip all tags — for plain-text fields (titles, code stored as text, etc.). */
export function cleanText(dirty: string): string {
  return sanitizeHtml(dirty ?? "", { allowedTags: [], allowedAttributes: {} }).trim();
}
