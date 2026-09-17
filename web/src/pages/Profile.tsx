import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { PostCard } from "../components/PostCard";
import { Avatar } from "../components/Avatar";
import { Select } from "../components/Select";
import { Icon } from "../icons/Icon";
import { PLATFORMS, parseLink, linkHref, linkText, platform } from "../store/social";
import { useAuth, useLang } from "../store/providers";

type Project = { id: string; title: string; description: string | null; githubRepoUrl: string | null; status: string | null };
type Agent = { id: string; title: string; description: string | null; framework: string | null; demoOrRepoUrl: string | null; tags: string[] };
type Ach = { code: string; title: string; icon: string; earnedAt: string };
type ProfileData = {
  profile: {
    id: string; nickname: string; bio: string | null; avatarUrl: string | null; socialLinks: string[];
    githubConnected: boolean; githubMode: string | null; githubUsername: string | null; githubUrl: string | null;
    githubRepos: { name: string; commits: string }[]; isMe: boolean;
    isFollowing: boolean; isBlocked: boolean; followerCount: number; followingCount: number;
  };
  posts: PostDTO[]; projects: Project[]; agents: Agent[]; skills: string[]; achievements: Ach[];
};

export function Profile() {
  const { nickname } = useParams();
  const { L } = useLang();
  const { me, refresh } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<"posts" | "projects" | "agents" | "skills" | "ach">("posts");
  const [ghUrl, setGhUrl] = useState("");
  const [skill, setSkill] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => api.get<ProfileData>(`/profile/${nickname}`).then((d) => { setData(d); setFollowing(d.profile.isFollowing); setBlocked(d.profile.isBlocked); });
  useEffect(() => { load(); }, [nickname]);

  async function toggleFollow() {
    const r = await api.post<{ following: boolean }>(`/users/${nickname}/follow`);
    setFollowing(r.following);
  }
  async function toggleBlock() {
    if (!blocked && !window.confirm(`${L.block} @${nickname}?`)) return;
    const r = await api.post<{ blocked: boolean }>(`/users/${nickname}/block`);
    setBlocked(r.blocked);
  }

  function startEdit() {
    setEditBio(data?.profile.bio ?? "");
    const links = data?.profile.socialLinks ?? [];
    setEditLinks(links.length ? links.map((s) => { const { key, value } = parseLink(s); return `${key}|${value}`; }) : ["website|"]);
    setEditing(true);
  }
  const setLinkPlatform = (i: number, key: string) => setEditLinks((ls) => ls.map((s, j) => (j === i ? `${key}|${parseLink(s).value}` : s)));
  const setLinkValue = (i: number, value: string) => setEditLinks((ls) => ls.map((s, j) => (j === i ? `${parseLink(s).key}|${value}` : s)));
  const removeLink = (i: number) => setEditLinks((ls) => ls.filter((_, j) => j !== i));
  const addLink = () => setEditLinks((ls) => [...ls, "website|"]);
  async function saveProfile() {
    setSaving(true);
    try {
      await api.put("/profile", { bio: editBio, socialLinks: editLinks.filter((s) => parseLink(s).value.trim()) });
      await load();
      await refresh();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }
  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url } = await api.upload(file);
    await api.put("/profile", { avatarUrl: url });
    await load();
    await refresh();
  }

  if (!data) return <Layout mode="page"><div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div></Layout>;
  const p = data.profile;

  async function linkManual() {
    if (!ghUrl.trim()) return;
    await api.post("/github/link-manual", { url: ghUrl });
    setGhUrl(""); load();
  }
  async function addSkill() {
    if (!skill.trim()) return;
    await api.post("/profile/skills", { tag: skill }); setSkill(""); load();
  }
  async function addAgent() {
    const title = prompt("Agent title:"); if (!title) return;
    const description = prompt("Description:") ?? "";
    const framework = prompt("Framework:") ?? "";
    await api.post("/profile/agents", { title, description, framework, tags: [] }); load();
  }
  async function addProject() {
    const title = prompt("Project title:"); if (!title) return;
    const description = prompt("Description:") ?? "";
    const githubRepoUrl = prompt("GitHub repo URL:") ?? "";
    await api.post("/profile/projects", { title, description, githubRepoUrl, status: "active" }); load();
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "posts", label: L.tabPosts },
    { key: "projects", label: L.tabProjects },
    { key: "agents", label: L.tabAgents },
    { key: "skills", label: L.tabSkills },
    { key: "ach", label: L.tabAch },
  ];

  return (
    <Layout mode="page">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 290px", gap: 22, alignItems: "start" }}>
        <div>
          <div className="chunk" style={{ padding: "22px 24px", marginBottom: 20, display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ position: "relative", flex: "none" }}>
              <Avatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={74} color="var(--ac)" onClick={p.isMe ? () => fileInput.current?.click() : undefined} />
              {p.isMe && (
                <>
                  <button className="av" title={L.changePhoto} onClick={() => fileInput.current?.click()}
                    style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, background: "var(--ac)", border: "var(--sw) solid var(--card)", cursor: "pointer" }}>
                    <Icon name="image" size={13} style={{ color: "var(--ac-ink)" }} />
                  </button>
                  <input ref={fileInput} type="file" accept="image/*" style={{ display: "none" }} onChange={onAvatarPick} />
                </>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontWeight: 700, fontSize: 30 }}>{p.nickname}</h1>
                  <div style={{ fontSize: 13, color: "var(--faint)", fontWeight: 700, margin: "2px 0 6px" }}>@{p.nickname}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", display: "flex", gap: 14 }}>
                    <span><b style={{ color: "var(--text)" }}>{p.followerCount}</b> {L.followers}</span>
                    <span><b style={{ color: "var(--text)" }}>{p.followingCount}</b> {L.followingN}</span>
                  </div>
                </div>
                {p.isMe ? (
                  !editing && <button className="btng" style={{ padding: "8px 14px" }} onClick={startEdit}><Icon name="pen" size={13} /> {L.editProfile}</button>
                ) : (
                  <div style={{ display: "flex", gap: 8, flex: "none" }}>
                    <button className={following ? "btng" : "btnp"} style={{ padding: "8px 16px" }} onClick={toggleFollow}>{following ? L.unfollow : L.follow}</button>
                    <button className="btng" style={{ padding: "8px 12px", color: blocked ? "var(--text)" : "#e0554b" }} onClick={toggleBlock} title={blocked ? L.unblock : L.block}>🚫</button>
                  </div>
                )}
              </div>

              {editing ? (
                <div style={{ marginTop: 4 }}>
                  <div className="field2"><label>{L.shortBio}</label><textarea className="finput" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder={L.bioPlaceholder} /></div>
                  <div className="field2">
                    <label>{L.contacts}</label>
                    {editLinks.map((lnk, i) => {
                      const { key, value } = parseLink(lnk);
                      return (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                          <div style={{ width: 148, flex: "none" }}>
                            <Select value={key} onChange={(k) => setLinkPlatform(i, k)} options={PLATFORMS.map((p) => ({ value: p.key, label: p.label, icon: p.emoji }))} />
                          </div>
                          <input className="finput" value={value} placeholder={platform(key).placeholder} onChange={(e) => setLinkValue(i, e.target.value)} />
                          <button className="btng" style={{ padding: "10px 12px", flex: "none" }} title={L.remove} onClick={() => removeLink(i)}><Icon name="x" size={12} /></button>
                        </div>
                      );
                    })}
                    <button className="btng" style={{ padding: "8px 14px", marginTop: 2 }} onClick={addLink}><Icon name="plus" size={12} /> {L.addLink}</button>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btnp" style={{ padding: "9px 18px" }} onClick={saveProfile} disabled={saving}>{L.save}</button>
                    <button className="btng" onClick={() => setEditing(false)}>{L.cancel}</button>
                  </div>
                </div>
              ) : (
                <>
                  {p.bio && <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 12px", maxWidth: 520, fontWeight: 600, color: "var(--text)" }}>{p.bio}</p>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {p.socialLinks.map((s, i) => {
                      const { key, value } = parseLink(s);
                      const pl = platform(key);
                      return (
                        <a key={i} className="chip" style={{ textDecoration: "none", fontSize: 13 }} href={linkHref(key, value)} target="_blank" rel="noreferrer">
                          <span style={{ fontSize: 15, lineHeight: 1 }}>{pl.emoji}</span> {linkText(value) || pl.label}
                        </a>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 22, borderBottom: "var(--sw) solid var(--stroke)", marginBottom: 20, flexWrap: "wrap" }}>
            {tabs.map((t) => <span key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>{t.label}</span>)}
          </div>

          {tab === "posts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.posts.map((post) => <PostCard key={post.id} post={post} />)}
              {data.posts.length === 0 && <div className="chunk" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
            </div>
          )}

          {tab === "projects" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {p.isMe && <button className="typebtn" onClick={addProject}>＋ {L.tabProjects}</button>}
              {data.projects.map((pr) => (
                <div key={pr.id} className="chunk" style={{ padding: "16px 18px" }}>
                  {pr.status && <div className="kick" style={{ color: "var(--ac2)", marginBottom: 6 }}>{pr.status}</div>}
                  <div className="fk" style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>{pr.title}</div>
                  {pr.description && <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)", margin: "0 0 8px", fontWeight: 600 }}>{pr.description}</p>}
                  {pr.githubRepoUrl && <a className="link" style={{ fontSize: 12 }} href={pr.githubRepoUrl} target="_blank" rel="noreferrer">{pr.githubRepoUrl}</a>}
                </div>
              ))}
            </div>
          )}

          {tab === "agents" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {p.isMe && <button className="typebtn" onClick={addAgent}>＋ {L.tabAgents}</button>}
              {data.agents.map((ag) => (
                <div key={ag.id} className="chunk t-agent" style={{ padding: "16px 18px", border: "var(--sw) solid var(--ac)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>✨</span>
                    {ag.framework && <span className="tag" style={{ background: "var(--card)", color: "var(--ac)", border: "var(--sw) solid var(--ac)" }}>{ag.framework}</span>}
                  </div>
                  <div className="fk" style={{ fontWeight: 600, fontSize: 17, marginBottom: 6, color: "var(--text)" }}>{ag.title}</div>
                  {ag.description && <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px", fontWeight: 600, color: "var(--text)" }}>{ag.description}</p>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {ag.tags.map((tg, i) => <span key={i} className="tag" style={{ background: "var(--card)", color: "var(--text)" }}>{tg}</span>)}
                  </div>
                  {ag.demoOrRepoUrl && <a className="link" style={{ fontSize: 12 }} href={ag.demoOrRepoUrl} target="_blank" rel="noreferrer">{ag.demoOrRepoUrl}</a>}
                </div>
              ))}
            </div>
          )}

          {tab === "skills" && (
            <div>
              {p.isMe && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 360 }}>
                  <input className="finput" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="LangChain…" onKeyDown={(e) => e.key === "Enter" && addSkill()} />
                  <button className="btnp" style={{ padding: "8px 16px" }} onClick={addSkill}>＋</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {data.skills.map((sk) => <span key={sk} className="chip" style={{ fontSize: 14, padding: "9px 16px", cursor: "default" }}>{sk}</span>)}
                {data.skills.length === 0 && <div style={{ color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
              </div>
            </div>
          )}

          {tab === "ach" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {data.achievements.map((a) => (
                <div key={a.code} className="chunk" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: "linear-gradient(160deg,var(--acsoft),var(--card))" }}>
                  <div className="sticker" style={{ width: 46, height: 46, background: "var(--ac)", color: "#fff", border: "var(--sw) solid var(--stroke)" }}><Icon name={a.icon} /></div>
                  <div className="fk" style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div>
                </div>
              ))}
              {data.achievements.length === 0 && <div style={{ color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
            </div>
          )}
        </div>

        <aside style={{ position: "sticky", top: 88 }}>
          <div className="side" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="kick" style={{ color: "var(--ac)" }}>{L.githubBlock}</div>
              {p.githubConnected && <span className="tag" style={{ background: "var(--acsoft)", color: "var(--ac)" }}>✓ {L.connected}</span>}
            </div>
            {p.githubConnected ? (
              <div>
                {p.githubRepos.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "var(--sw) solid var(--stroke)" }}>
                    <span className="fk" style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 700 }}>{r.commits}</span>
                  </div>
                ))}
              </div>
            ) : p.isMe ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {p.githubUrl && <a className="link" style={{ fontSize: 13 }} href={p.githubUrl} target="_blank" rel="noreferrer">{p.githubUrl}</a>}
                <div className="field2" style={{ margin: 0 }}>
                  <label>{L.connectManual}</label>
                  <input className="finput" value={ghUrl} onChange={(e) => setGhUrl(e.target.value)} placeholder="github.com/…" />
                  <button className="btng block" style={{ padding: 9, marginTop: 8 }} onClick={linkManual}>{L.connectManual}</button>
                </div>
              </div>
            ) : (
              p.githubUrl && <a className="link" style={{ fontSize: 13 }} href={p.githubUrl} target="_blank" rel="noreferrer">{p.githubUrl}</a>
            )}
          </div>
        </aside>
      </div>
    </Layout>
  );
}
