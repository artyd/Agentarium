import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CommunityListItem, PostDTO } from "../api/types";
import { Modal } from "./Modal";
import { RichEditor } from "./RichEditor";
import { Select } from "./Select";
import { Icon } from "../icons/Icon";
import { useCompose, useLang } from "../store/providers";
import { POST_TYPES, typeLabel, TYPE_ICON } from "../i18n/strings";

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").trim();

export function ComposeModal() {
  const nav = useNavigate();
  const { L } = useLang();
  const { open, community, closeCompose } = useCompose();
  const [type, setType] = useState<string>("thought");
  const [titleHtml, setTitleHtml] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [code, setCode] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const imgInput = useRef<HTMLInputElement>(null);
  const [communityId, setCommunityId] = useState("");
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    // restore a saved draft (if any), else reset
    let d: { type?: string; titleHtml?: string; bodyHtml?: string; code?: string } | null = null;
    try { d = JSON.parse(localStorage.getItem("ag_draft") || "null"); } catch { /* ignore */ }
    setType(d?.type ?? "thought"); setTitleHtml(d?.titleHtml ?? ""); setBodyHtml(d?.bodyHtml ?? ""); setCode(d?.code ?? "");
    setLinkUrl(""); setImages([]); setError(""); setBusy(false); setFormKey((k) => k + 1);
    api.get<{ communities: CommunityListItem[] }>("/communities").then((r) => {
      const mine = r.communities.filter((c) => c.isMember);
      setCommunities(mine);
      const match = community ? mine.find((c) => c.slug === community) : null;
      setCommunityId(match ? match.id : "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, community]);

  // Persist a draft as the user types.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => localStorage.setItem("ag_draft", JSON.stringify({ type, titleHtml, bodyHtml, code })), 400);
    return () => clearTimeout(t);
  }, [open, type, titleHtml, bodyHtml, code]);

  if (!open) return null;

  async function publish() {
    setError("");
    if (!stripTags(titleHtml)) { setError(L.title); return; }
    setBusy(true);
    try {
      const { post } = await api.post<{ post: PostDTO }>("/posts", {
        type, title: titleHtml, bodyHtml,
        codeSnippet: code.trim() || null,
        linkUrl: linkUrl.trim() || null,
        imageUrl: images[0] || null,
        imageUrls: images,
        communityId: communityId || null,
      });
      localStorage.removeItem("ag_draft");
      closeCompose();
      nav(`/post/${post.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={closeCompose} width={620}>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 className="fk" style={{ fontWeight: 600, fontSize: 22, flex: 1 }}>{L.compose}</h2>
          <button className="btng" style={{ padding: "6px 10px", boxShadow: "none" }} onClick={closeCompose}><Icon name="x" size={13} /></button>
        </div>

        <div className="lbl2">{L.postType}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
          {POST_TYPES.map((t) => (
            <button key={t} className={`typebtn ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
              <div style={{ marginBottom: 6 }}><Icon name={TYPE_ICON[t]} /></div>
              {typeLabel(t, L)}
            </button>
          ))}
        </div>

        <div className="field2">
          <label>{L.title}</label>
          <RichEditor key={`t${formKey}`} value={titleHtml} onChange={setTitleHtml} placeholder={L.title} singleLine onSubmit={publish} />
        </div>
        <div className="field2">
          <label>{L.body}</label>
          <RichEditor key={`b${formKey}`} value={bodyHtml} onChange={setBodyHtml} placeholder={L.body} minHeight={120} />
        </div>

        {(type === "agent" || type === "project" || type === "skill") && (
          <div className="field2"><label>{L.codeOptional}</label><textarea className="finput" value={code} onChange={(e) => setCode(e.target.value)} style={{ fontFamily: "ui-monospace, monospace" }} /></div>
        )}
        <div className="field2"><label>{L.linkOptional}</label><input className="finput" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" /></div>

        <div className="field2">
          <label>{L.addImage}</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {images.map((u, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={u} alt="" style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 10, border: "var(--sw) solid var(--stroke)", display: "block" }} />
                <button className="btng" style={{ position: "absolute", top: 4, right: 4, padding: "2px 6px", boxShadow: "none" }} onClick={() => setImages((xs) => xs.filter((_, j) => j !== i))}><Icon name="x" size={10} /></button>
              </div>
            ))}
            {images.length < 4 && (
              <button className="btng" style={{ width: 92, height: 92 }} onClick={() => imgInput.current?.click()}><Icon name="image" size={16} /></button>
            )}
          </div>
          <input ref={imgInput} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const { url } = await api.upload(f); setImages((xs) => [...xs, url]); } if (imgInput.current) imgInput.current.value = ""; }} />
        </div>

        {communities.length > 0 && (
          <div className="field2">
            <label>{L.communities}</label>
            <Select value={communityId} onChange={setCommunityId} placeholder="—" options={[{ value: "", label: "—" }, ...communities.map((c) => ({ value: c.id, label: c.title, icon: "👥" }))]} />
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: "#e0554b", fontWeight: 700 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btnp" style={{ padding: "11px 22px" }} onClick={publish} disabled={busy}>{L.publish}</button>
          <button className="btng" onClick={closeCompose}>{L.cancel}</button>
        </div>
      </div>
    </Modal>
  );
}
