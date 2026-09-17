import sanitizeHtml from "sanitize-html";

// Allow-list matching the prototype's WYSIWYG editor capabilities.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "i", "strong", "em", "a", "img", "p", "br", "code", "pre"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
};

/** Sanitize rich HTML from the editor (defense in depth: called on write and on read). */
export function cleanHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", OPTIONS);
}

/** Strip all tags — for plain-text fields (titles, code stored as text, etc.). */
export function cleanText(dirty: string): string {
  return sanitizeHtml(dirty ?? "", { allowedTags: [], allowedAttributes: {} }).trim();
}
