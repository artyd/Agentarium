// Best-effort Open Graph link preview. Times out fast; never throws.
export async function fetchLinkPreview(url: string): Promise<{ title: string | null; desc: string | null; image: string | null } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "agentarium-link-preview", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const text = (await res.text()).slice(0, 250_000);

    const meta = (prop: string): string | null => {
      const a = text.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"));
      if (a) return a[1];
      const b = text.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
      return b ? b[1] : null;
    };
    const decode = (s: string | null) =>
      s ? s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : null;

    const title = decode(meta("og:title") ?? (text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null));
    const desc = decode(meta("og:description") ?? meta("description"));
    let image = meta("og:image") ?? meta("twitter:image");
    if (image) {
      try { image = new URL(image, url).toString(); } catch { image = null; }
    }
    if (!title && !desc && !image) return null;
    return { title, desc, image };
  } catch {
    return null;
  }
}
