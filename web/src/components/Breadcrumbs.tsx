import { useNavigate } from "react-router-dom";

export type Crumb = { label: string; to?: string };

// §12: breadcrumbs replace the back button. All levels but the last are clickable.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const nav = useNavigate();
  return (
    <div className="crumbs">
      {items.map((c, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="sep">/</span>}
          {c.to && i < items.length - 1 ? (
            <span className="link" onClick={() => nav(c.to!)}>{c.label}</span>
          ) : (
            <span className="cur">{c.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
