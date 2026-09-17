import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import type { PostDTO, CommunityListItem } from "../api/types";
import { Layout } from "../components/Layout";
import { PostCard } from "../components/PostCard";
import { Icon } from "../icons/Icon";
import { useLang } from "../store/providers";
import { POST_TYPES, typeLabel, TYPE_ICON } from "../i18n/strings";

type Scope = "all" | "friends" | "following" | "communities" | "saved";

export function Feed() {
  const { L } = useLang();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tag = sp.get("tag");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"hot" | "new" | "top">("hot");
  const [type, setType] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [newCount, setNewCount] = useState(0);

  const loadFeed = () => {
    setLoading(true);
    const qs = new URLSearchParams({ sort });
    if (type) qs.set("type", type);
    if (scope !== "all") qs.set("scope", scope);
    if (tag) qs.set("tag", tag);
    return api.get<{ posts: PostDTO[] }>(`/posts?${qs}`).then((r) => { setPosts(r.posts); setLoading(false); setNewCount(0); });
  };

  useEffect(() => { loadFeed(); }, [sort, type, scope, tag]);
  useEffect(() => { api.get<{ communities: CommunityListItem[] }>("/communities").then((r) => setCommunities(r.communities.slice(0, 5))); }, []);

  useEffect(() => {
    const s = getSocket();
    const onNew = () => setNewCount((n) => n + 1);
    s.on("feed:new", onNew);
    return () => { s.off("feed:new", onNew); };
  }, []);

  const sortIcon = { hot: "fire", new: "wand", top: "star" } as const;
  const scopes: { key: Scope; label: string }[] = [
    { key: "all", label: L.feedAll },
    { key: "friends", label: L.feedFriends },
    { key: "following", label: L.feedFollowing },
    { key: "communities", label: L.feedCommunities },
    { key: "saved", label: L.feedSaved },
  ];

  const leftExtra = (
    <>
      <div style={{ height: "var(--sw)", background: "var(--stroke)", opacity: 0.35, borderRadius: 2, margin: "6px 0 14px" }} />
      {!tag && (
        <>
          <div className="kick" style={{ marginBottom: 10 }}>{L.feed}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {scopes.map((s) => (
              <span key={s.key} className={`chip ${scope === s.key ? "on" : ""}`} onClick={() => setScope(s.key)}>{s.label}</span>
            ))}
          </div>
        </>
      )}
      <div className="kick" style={{ marginBottom: 10 }}>{L.sortLabel}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {(["hot", "new", "top"] as const).map((s) => (
          <span key={s} className={`chip ${sort === s ? "on" : ""}`} onClick={() => setSort(s)}><Icon name={sortIcon[s]} size={13} /> {L[s]}</span>
        ))}
      </div>
      <div className="kick" style={{ marginBottom: 10 }}>{L.typesLabel}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span className={`chip ${type === null ? "on" : ""}`} onClick={() => setType(null)}>{L.allTypes}</span>
        {POST_TYPES.map((t) => (
          <span key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}><Icon name={TYPE_ICON[t]} size={13} /> {typeLabel(t, L)}</span>
        ))}
      </div>
    </>
  );

  const right = (
    <div className="side" style={{ padding: 16 }}>
      <div className="kick" style={{ marginBottom: 12, color: "var(--ac)" }}>{L.communities}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {communities.map((c) => (
          <div key={c.id} className="hoverrow" style={{ padding: "8px 10px" }} onClick={() => nav(`/c/${c.slug}`)}>
            <div className="fk" style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>a/{c.slug} · {c.memberCount} {L.membersN}</div>
          </div>
        ))}
        {communities.length === 0 && <div style={{ fontSize: 13, color: "var(--faint)", fontWeight: 700 }}>{L.empty}</div>}
      </div>
    </div>
  );

  return (
    <Layout mode="feed" leftExtra={leftExtra} right={right}>
      {tag && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 className="fk" style={{ fontWeight: 600, fontSize: 22 }}>#{tag}</h2>
          <span className="link" style={{ fontSize: 13 }} onClick={() => { sp.delete("tag"); setSp(sp, { replace: true }); }}>✕</span>
        </div>
      )}

      {newCount > 0 && (
        <button className="btnp block" style={{ marginBottom: 16 }} onClick={loadFeed}>↑ {newCount} {L.showNewPosts}</button>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div>
      ) : posts.length === 0 ? (
        <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </Layout>
  );
}
