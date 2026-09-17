import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { CommunityListItem, PostDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { RichEditor } from "../components/RichEditor";
import { Icon } from "../icons/Icon";
import { useLang } from "../store/providers";
import { POST_TYPES, typeLabel, TYPE_ICON } from "../i18n/strings";

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").trim();

export function Compose() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { L } = useLang();
  const [type, setType] = useState<string>("thought");
  const [titleHtml, setTitleHtml] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [code, setCode] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ communities: CommunityListItem[] }>("/communities").then((r) => {
      const mine = r.communities.filter((c) => c.isMember);
      setCommunities(mine);
      const preslug = sp.get("community");
      if (preslug) {
        const match = mine.find((c) => c.slug === preslug);
        if (match) setCommunityId(match.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish() {
    setError("");
    if (!stripTags(titleHtml)) { setError(L.title); return; }
    setBusy(true);
    try {
      const { post } = await api.post<{ post: PostDTO }>("/posts", {
        type,
        title: titleHtml,
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

        <div className="field2">
          <label>{L.title}</label>
          <RichEditor value={titleHtml} onChange={setTitleHtml} placeholder={L.title} singleLine onSubmit={publish} />
        </div>

        <div className="field2">
          <label>{L.body}</label>
          <RichEditor value={bodyHtml} onChange={setBodyHtml} placeholder={L.body} minHeight={130} />
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
