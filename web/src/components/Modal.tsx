import { useEffect, type ReactNode } from "react";

/** Centered modal dialog with a blurred, dimmed backdrop. Click-outside and Esc close. */
export function Modal({ children, onClose, width = 460 }: { children: ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
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
        style={{ width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
