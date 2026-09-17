import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO, PublicUser } from "../api/types";
import { Layout } from "../components/Layout";
import { PostCard } from "../components/PostCard";
import { Avatar } from "../components/Avatar";
import { useLang } from "../store/providers";

type AgentItem = { id: string; title: string; description: string | null; framework: string | null; demoOrRepoUrl: string | null; tags: string[]; user: PublicUser };
type ProjectItem = { id: string; title: string; description: string | null; githubRepoUrl: string | null; status: string | null; user: PublicUser };

export function Explore() {
  const { L } = useLang();
  const nav = useNavigate();
  const [tab, setTab] = useState<"overview" | "agents" | "projects">("overview");
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [top, setTop] = useState<PostDTO[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [fw, setFw] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  useEffect(() => { api.get<{ trending: typeof trending; top: PostDTO[] }>("/explore").then((r) => { setTrending(r.trending); setTop(r.top); }); }, []);
  useEffect(() => {
    if (tab !== "agents") return;
    const qs = fw ? `?framework=${encodeURIComponent(fw)}` : "";
    api.get<{ agents: AgentItem[]; frameworks: string[] }>(`/agents${qs}`).then((r) => { setAgents(r.agents); if (!fw) setFrameworks(r.frameworks); });
  }, [tab, fw]);
  useEffect(() => { if (tab === "projects") api.get<{ projects: ProjectItem[] }>("/projects").then((r) => setProjects(r.projects)); }, [tab]);

  return (
    <Layout mode="feed">
      <div style={{ display: "flex", gap: 22, borderBottom: "var(--sw) solid var(--stroke)", marginBottom: 18 }}>
        <span className={`tab ${tab === "overview" ? "on" : ""}`} onClick={() => setTab("overview")}>{L.explore}</span>
        <span className={`tab ${tab === "agents" ? "on" : ""}`} onClick={() => setTab("agents")}>{L.agentsDir}</span>
        <span className={`tab ${tab === "projects" ? "on" : ""}`} onClick={() => setTab("projects")}>{L.projectsDir}</span>
      </div>

      {tab === "overview" && (
        <>
          <div className="kick" style={{ marginBottom: 10 }}>{L.trendingTags}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
            {trending.map((t) => <span key={t.tag} className="chip" onClick={() => nav(`/?tag=${encodeURIComponent(t.tag)}`)}>#{t.tag} <span style={{ opacity: 0.6 }}>{t.count}</span></span>)}
            {trending.length === 0 && <span style={{ color: "var(--faint)", fontWeight: 700, fontSize: 13 }}>{L.empty}</span>}
          </div>
          <div className="kick" style={{ marginBottom: 12 }}>{L.topWeek}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {top.map((p) => <PostCard key={p.id} post={p} />)}
            {top.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
          </div>
        </>
      )}

      {tab === "agents" && (
        <>
          {frameworks.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span className={`chip ${!fw ? "on" : ""}`} onClick={() => setFw(null)}>{L.allFrameworks}</span>
              {frameworks.map((f) => <span key={f} className={`chip ${fw === f ? "on" : ""}`} onClick={() => setFw(f)}>{f}</span>)}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {agents.map((a) => (
              <div key={a.id} className="chunk t-agent" style={{ padding: "16px 18px", border: "var(--sw) solid var(--ac)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>✨</span>
                  {a.framework && <span className="tag" style={{ background: "var(--card)", color: "var(--ac)", border: "var(--sw) solid var(--ac)" }}>{a.framework}</span>}
                </div>
                <div className="fk" style={{ fontWeight: 600, fontSize: 17, marginBottom: 6, color: "var(--text)" }}>{a.title}</div>
                {a.description && <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px", fontWeight: 600, color: "var(--text)" }}>{a.description}</p>}
                <div className="hoverrow" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }} onClick={() => nav(`/profile/${a.user.nickname}`)}>
                  <Avatar nickname={a.user.nickname} avatarUrl={a.user.avatarUrl} size={24} /><span style={{ fontSize: 12, fontWeight: 700 }}>@{a.user.nickname}</span>
                </div>
              </div>
            ))}
            {agents.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
          </div>
        </>
      )}

      {tab === "projects" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {projects.map((pr) => (
            <div key={pr.id} className="chunk" style={{ padding: "16px 18px" }}>
              {pr.status && <div className="kick" style={{ color: "var(--ac2)", marginBottom: 6 }}>{pr.status}</div>}
              <div className="fk" style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>{pr.title}</div>
              {pr.description && <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)", margin: "0 0 8px", fontWeight: 600 }}>{pr.description}</p>}
              {pr.githubRepoUrl && <a className="link" style={{ fontSize: 12 }} href={pr.githubRepoUrl} target="_blank" rel="noreferrer">{pr.githubRepoUrl}</a>}
              <div className="hoverrow" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", marginTop: 8 }} onClick={() => nav(`/profile/${pr.user.nickname}`)}>
                <Avatar nickname={pr.user.nickname} avatarUrl={pr.user.avatarUrl} size={24} /><span style={{ fontSize: 12, fontWeight: 700 }}>@{pr.user.nickname}</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
        </div>
      )}
    </Layout>
  );
}
