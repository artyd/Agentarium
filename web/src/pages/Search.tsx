import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO, PublicUser } from "../api/types";
import { Layout } from "../components/Layout";
import { PostCard } from "../components/PostCard";
import { Avatar } from "../components/Avatar";
import { useLang } from "../store/providers";

type CommunityHit = { id: string; slug: string; title: string; description: string | null; memberCount: number; threadCount: number };

export function Search() {
  const [sp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const nav = useNavigate();
  const { L } = useLang();
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [communities, setCommunities] = useState<CommunityHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ people: PublicUser[]; posts: PostDTO[]; communities: CommunityHit[] }>(`/search?q=${encodeURIComponent(q)}`).then((r) => {
      setPeople(r.people); setPosts(r.posts); setCommunities(r.communities); setLoading(false);
    });
  }, [q]);

  return (
    <Layout mode="page">
      <h1 style={{ fontWeight: 700, fontSize: 28, marginBottom: 4 }}>{L.searchTitle}</h1>
      <p style={{ fontSize: 13, color: "var(--faint)", fontWeight: 700, marginBottom: 20 }}>“{q}”</p>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {people.length > 0 && (
            <section>
              <div className="kick" style={{ marginBottom: 12 }}>{L.people}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {people.map((p) => (
                  <div key={p.id} className="chunk hoverrow" style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }} onClick={() => nav(`/profile/${p.nickname}`)}>
                    <Avatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={40} />
                    <div><div className="fk" style={{ fontWeight: 600 }}>{p.nickname}</div>{p.bio && <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{p.bio}</div>}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {communities.length > 0 && (
            <section>
              <div className="kick" style={{ marginBottom: 12 }}>{L.communities}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {communities.map((c) => (
                  <div key={c.id} className="chunk hoverrow" style={{ padding: "14px 16px" }} onClick={() => nav(`/c/${c.slug}`)}>
                    <div className="fk" style={{ fontWeight: 600, fontSize: 16 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>a/{c.slug} · {c.memberCount} {L.membersN}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {posts.length > 0 && (
            <section>
              <div className="kick" style={{ marginBottom: 12 }}>{L.posts}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {posts.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            </section>
          )}
          {people.length + posts.length + communities.length === 0 && (
            <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>
          )}
        </div>
      )}
    </Layout>
  );
}
