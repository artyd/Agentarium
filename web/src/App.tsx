import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth, useTheme } from "./store/providers";
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
import { Compose } from "./pages/Compose";

export function App() {
  const { me, loading } = useAuth();
  const { theme } = useTheme();
  const { L } = useLang();

  return (
    <div className="app" data-theme={theme}>
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
            <Route path="/compose" element={<Compose />} />
            <Route path="/onboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      )}
    </div>
  );
}
