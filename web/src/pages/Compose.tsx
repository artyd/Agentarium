import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CommunityListItem, PostDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { Icon } from "../icons/Icon";
import { useLang } from "../store/providers";
import { POST_TYPES, typeLabel, TYPE_ICON } from "../i18n/strings";

export function Compose() {
  const nav = useNavigate();
  const { L } = useLang();
  const editor = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<string>("thought");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ communities: CommunityListItem[] }>("/communities").then((r) => setCommunities(r.communities.filter((c) => c.isMember)));
  }, []);

  function exec(cmd: string) {
    document.execCommand(cmd);
    editor.current?.focus();
  }
  function insertLink() {
    const url = prompt("URL:");
    if (url) document.execCommand("createLink", false, url);
  }
  function insertImage() {
    const url = prompt("Image URL:");
    if (url) document.execCommand("insertImage", false, url);
  }

  async function publish() {
    setError("");
    if (!title.trim()) { setError(L.title); return; }
    setBusy(true);
    try {
      const bodyHtml = editor.current?.innerHTML ?? "";
      const { post } = await api.post<{ post: PostDTO }>("/posts", {
        type,
        title,
        bodyHtml,
        codeSnippet: code.trim() || null,
        linkUrl: linkUrl.trim() || null,
        communityId: communityId || null,
      });
      nav(`/post/${post.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Layout mode="page">
      <h1 style={{ fontWeight: 700, fontSize: 30, marginBottom: 18 }}>{L.compose}</h1>
      <div className="chunk" style={{ padding: "22px 24px" }}>
        <div className="lbl2">{L.postType}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
          {POST_TYPES.map((t) => (
            <button key={t} className={`typebtn ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
              <div style={{ marginBottom: 6 }}><Icon name={TYPE_ICON[t]} /></div>
              {typeLabel(t, L)}
            </button>
          ))}
        </div>

        <div className="field2"><label>{L.title}</label><input className="finput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L.title} /></div>

        <div className="field2">
          <label>{L.body}</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button className="btng" style={{ padding: "6px 12px", fontWeight: 800 }} onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}>B</button>
            <button className="btng" style={{ padding: "6px 12px", fontStyle: "italic" }} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}>I</button>
            <button className="btng" style={{ padding: "6px 12px" }} onMouseDown={(e) => { e.preventDefault(); insertLink(); }}><Icon name="link" size={13} /></button>
            <button className="btng" style={{ padding: "6px 12px" }} onMouseDown={(e) => { e.preventDefault(); insertImage(); }}><Icon name="image" size={13} /></button>
          </div>
          <div ref={editor} className="finput rte" contentEditable data-ph={L.body} style={{ minHeight: 120 }} suppressContentEditableWarning />
        </div>

        {(type === "agent" || type === "project" || type === "skill") && (
          <div className="field2"><label>{L.codeOptional}</label><textarea className="finput" value={code} onChange={(e) => setCode(e.target.value)} style={{ fontFamily: "ui-monospace, monospace" }} /></div>
        )}
        <div className="field2"><label>{L.linkOptional}</label><input className="finput" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" /></div>

        {communities.length > 0 && (
          <div className="field2">
            <label>{L.communities}</label>
            <select className="finput" value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
              <option value="">—</option>
              {communities.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: "#e0554b", fontWeight: 700 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btnp" style={{ padding: "11px 22px" }} onClick={publish} disabled={busy}>{L.publish}</button>
          <button className="btng" onClick={() => nav("/")}>{L.cancel}</button>
        </div>
      </div>
    </Layout>
  );
}
