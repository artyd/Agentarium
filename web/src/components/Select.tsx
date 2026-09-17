import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons/Icon";

export type Option = { value: string; label: string; icon?: string };

// On-brand custom dropdown (replaces the native <select>). Trigger looks like a
// .finput; the menu reuses the .chunk popover + .com rows used elsewhere.
export function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        className="finput"
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}
        onClick={() => setOpen((v) => !v)}
      >
        {current?.icon && <span style={{ fontSize: 16, lineHeight: 1 }}>{current.icon}</span>}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: current ? "var(--text)" : "var(--faint)" }}>
          {current ? current.label : placeholder ?? ""}
        </span>
        <span className="ic" style={{ color: "var(--faint)", transform: open ? "rotate(180deg)" : "none", transition: "transform .13s ease" }}>
          <Icon name="angleDown" size={12} />
        </span>
      </button>
      {open && (
        <div className="chunk agmodal" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, padding: 6, zIndex: 60, maxHeight: 280, overflowY: "auto" }}>
          {options.map((o) => (
            <div
              key={o.value}
              className="com"
              style={{ fontWeight: 700, background: o.value === value ? "var(--hover)" : undefined }}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.icon && <span style={{ fontSize: 16, lineHeight: 1 }}>{o.icon}</span>}
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.value === value && <Icon name="check" size={12} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
