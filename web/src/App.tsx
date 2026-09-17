import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./store/providers";
import { useLang } from "./store/providers";
import { AppShell } from "./components/AppShell";
import { Welcome } from "./pages/Welcome";
import { Onboard } from "./pages/Onboard";
import { Feed } from "./pages/Feed";
import { PostDetail } from "./pages/PostDetail";
import { Profile } from "./pages/Profile";
import { Communities } from "./pages/Communities";
import { Group } from "./pages/Group";
import { Thread } from "./pages/Thread";
import { Friends } from "./pages/Friends";
import { Search } from "./pages/Search";
import { Requests } from "./pages/Requests";
import { Settings } from "./pages/Settings";
import { ComposeModal } from "./components/ComposeModal";
import { WelcomeBackModal } from "./components/WelcomeBackModal";

export function App() {
  const { me, loading } = useAuth();
  const { L } = useLang();
  const nav = useNavigate();

  // Intercept clicks on internal links (e.g. @mention/profile links inside rendered
  // HTML) so they navigate within the SPA instead of doing a full page reload.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement).closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (href && href.startsWith("/") && !a.getAttribute("target") && a.getAttribute("href") !== location.pathname) {
        e.preventDefault();
        nav(href);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [nav]);

  return (
    <div className="app" data-theme="light">
      {loading ? (
        <div className="center-screen">
          <span className="spin" />
        </div>
      ) : !me ? (
        <Routes>
          <Route path="/onboard" element={<Onboard />} />
          <Route path="*" element={<Welcome />} />
        </Routes>
      ) : (
        <AppShell>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/profile/:nickname" element={<Profile />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/c/:slug" element={<Group />} />
            <Route path="/thread/:id" element={<Thread />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/search" element={<Search />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/onboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ComposeModal />
          <WelcomeBackModal />
        </AppShell>
      )}
    </div>
  );
}
