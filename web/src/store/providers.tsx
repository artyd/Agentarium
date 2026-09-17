import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { STRINGS, type Lang } from "../i18n/strings";

export type Me = { id: string; nickname: string; bio: string | null; avatarUrl: string | null; locale: Lang };

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  setMe: (m: Me | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(AuthContext);

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; L: Record<string, string> };
const LangContext = createContext<LangCtx>(null!);
export const useLang = () => useContext(LangContext);

export function AppProviders({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>((localStorage.getItem("ag_lang") as Lang) || "ua");

  const refresh = async () => {
    try {
      const { user } = await api.get<{ user: Me | null }>("/auth/me");
      setMe(user);
      if (user) setLangState(user.locale);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("ag_lang", l);
    if (me) api.put("/auth/me/locale", { locale: l }).catch(() => {});
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setMe(null);
  };

  return (
    <AuthContext.Provider value={{ me, loading, setMe, refresh, logout }}>
      <LangContext.Provider value={{ lang, setLang, L: STRINGS[lang] }}>{children}</LangContext.Provider>
    </AuthContext.Provider>
  );
}
