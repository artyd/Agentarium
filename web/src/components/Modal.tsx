import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Centered modal dialog with a blurred, dimmed backdrop. Click-outside and Esc close.
 *  Rendered through a portal to the `.app` root so it is never trapped inside a
 *  transformed ancestor (e.g. `article.chunk:hover{transform:…}`), which would turn
 *  the post card into the containing block for our `position:fixed` overlay. We mount
 *  into `.app` (not <body>) because the theme CSS variables (`--card`, `--stroke`,
 *  `--shadow`, …) are defined on `.app[data-theme]`; mounting outside it would leave
 *  `var(--card)` unresolved and render a transparent, borderless card. */
export function Modal({ children, onClose, width = 460 }: { children: ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const host = (typeof document !== "undefined" && document.querySelector(".app")) || document.body;

  return createPortal(
    <div
      className="agback"
      style={{
        position: "fixed", inset: 0, zIndex: 200, padding: 20,
        display: "grid", placeItems: "center", overflowY: "auto",
        background: "rgba(0,0,0,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="chunk agmodal"
        style={{ width: "100%", maxWidth: width, maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    host,
  );
}
