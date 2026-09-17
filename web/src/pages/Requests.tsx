import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PublicUser } from "../api/types";
import { Layout } from "../components/Layout";
import { Avatar } from "../components/Avatar";
import { useLang } from "../store/providers";

type JoinReq = { id: string; nickname: string; bio: string | null; motivation: string | null; githubUrl: string | null; hasPassword: boolean };
type FriendReq = { friendshipId: string; user: PublicUser };
type Invite = { id: string; community: { slug: string; title: string }; invitedBy: PublicUser };

export function Requests() {
  const nav = useNavigate();
  const { L } = useLang();
  const [join, setJoin] = useState<JoinReq[]>([]);
  const [friends, setFriends] = useState<FriendReq[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tempPw, setTempPw] = useState<{ nick: string; pw: string } | null>(null);

  const load = () =>
    api.get<{ joinRequests: JoinReq[]; friendRequests: FriendReq[]; communityInvites: Invite[] }>("/requests").then((r) => {
      setJoin(r.joinRequests); setFriends(r.friendRequests); setInvites(r.communityInvites);
    });
  useEffect(() => { load(); }, []);

  async function approve(j: JoinReq) {
    const r = await api.post<{ tempPassword: string | null }>(`/join-requests/${j.id}/approve`);
    if (r.tempPassword) setTempPw({ nick: j.nickname, pw: r.tempPassword });
    load();
  }
  const total = join.length + friends.length + invites.length;

  return (
    <Layout mode="feed">
      <h1 style={{ fontWeight: 700, fontSize: 30, marginBottom: 18 }}>{L.requests}</h1>

      {tempPw && (
        <div className="chunk" style={{ padding: 16, marginBottom: 16, background: "var(--acsoft)" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{L.tempPasswordNote}</div>
          <div className="fk" style={{ fontSize: 16, marginTop: 6 }}>@{tempPw.nick} → <code>{tempPw.pw}</code></div>
        </div>
      )}

      {total === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.noRequests}</div>}

      {join.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="kick" style={{ marginBottom: 12 }}>{L.joinRequests}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {join.map((j) => (
              <div key={j.id} className="chunk" style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <Avatar nickname={j.nickname} size={42} />
                  <div style={{ flex: 1 }}>
                    <div className="fk" style={{ fontWeight: 600, fontSize: 16 }}>{j.nickname}</div>
                    {j.bio && <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{j.bio}</div>}
                  </div>
                </div>
                {j.motivation && <p style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, margin: "0 0 10px" }}>{j.motivation}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btnp" style={{ padding: "8px 18px" }} onClick={() => approve(j)}>{L.approve}</button>
                  <button className="btng" onClick={async () => { await api.post(`/join-requests/${j.id}/reject`); load(); }}>{L.reject}</button>
                  {j.githubUrl && <a className="link" style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12 }} href={j.githubUrl} target="_blank" rel="noreferrer">{j.githubUrl}</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {friends.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="kick" style={{ marginBottom: 12 }}>{L.friendRequests}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {friends.map((f) => (
              <div key={f.friendshipId} className="chunk" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar nickname={f.user.nickname} avatarUrl={f.user.avatarUrl} size={40} onClick={() => nav(`/profile/${f.user.nickname}`)} />
                <div className="fk link" style={{ flex: 1, fontWeight: 600 }} onClick={() => nav(`/profile/${f.user.nickname}`)}>{f.user.nickname}</div>
                <button className="btnp" style={{ padding: "8px 16px" }} onClick={async () => { await api.post(`/friends/${f.friendshipId}/accept`); load(); }}>{L.accept}</button>
                <button className="btng" onClick={async () => { await api.post(`/friends/${f.friendshipId}/reject`); load(); }}>{L.reject}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {invites.length > 0 && (
        <section>
          <div className="kick" style={{ marginBottom: 12 }}>{L.communityInvites}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {invites.map((i) => (
              <div key={i.id} className="chunk" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div className="fk" style={{ flex: 1, fontWeight: 600 }}>{i.community.title} <span style={{ fontSize: 12, color: "var(--faint)" }}>a/{i.community.slug}</span></div>
                <button className="btnp" style={{ padding: "8px 16px" }} onClick={async () => { await api.post(`/community-invites/${i.id}/accept`); load(); }}>{L.accept}</button>
                <button className="btng" onClick={async () => { await api.post(`/community-invites/${i.id}/reject`); load(); }}>{L.reject}</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}
