import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { PostCard } from "../components/PostCard";
import { Avatar } from "../components/Avatar";
import { Icon } from "../icons/Icon";
import { useAuth, useLang } from "../store/providers";

type Project = { id: string; title: string; description: string | null; githubRepoUrl: string | null; status: string | null };
type Agent = { id: string; title: string; description: string | null; framework: string | null; demoOrRepoUrl: string | null; tags: string[] };
type Ach = { code: string; title: string; icon: string; earnedAt: string };
type ProfileData = {
  profile: {
    id: string; nickname: string; bio: string | null; avatarUrl: string | null; socialLinks: string[];
    githubConnected: boolean; githubMode: string | null; githubUsername: string | null; githubUrl: string | null;
    githubRepos: { name: string; commits: string }[]; isMe: boolean;
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

  const load = () => api.get<ProfileData>(`/profile/${nickname}`).then(setData);
  useEffect(() => { load(); }, [nickname]);

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
            <Avatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={74} color="var(--ac)" />
            <div style={{ flex: 1 }}>
              <h1 style={{ fontWeight: 700, fontSize: 30 }}>{p.nickname}</h1>
              <div style={{ fontSize: 13, color: "var(--faint)", fontWeight: 700, margin: "2px 0 10px" }}>@{p.nickname}</div>
              {p.bio && <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 10px", maxWidth: 520, fontWeight: 600, color: "var(--text)" }}>{p.bio}</p>}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {p.socialLinks.map((s, i) => <a key={i} className="link" style={{ fontSize: 13 }} href={s} target="_blank" rel="noreferrer">{s}</a>)}
              </div>
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
                <div style={{ textAlign: "center", fontSize: 11, color: "var(--faint)", fontWeight: 700 }}>— {L.optional} —</div>
                <a className="btnp block" style={{ padding: 10, textDecoration: "none", boxSizing: "border-box" }} href="/api/github/connect">{L.connectOauth}</a>
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
