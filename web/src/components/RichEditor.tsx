import { useEffect, useRef } from "react";
import { Icon } from "../icons/Icon";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  singleLine?: boolean; // title: block Enter (or submit)
  dense?: boolean; // compact toolbar for comments
  minHeight?: number;
  onSubmit?: () => void; // singleLine: Enter; multiline: Ctrl/Cmd+Enter
};

// contentEditable rich editor. Native Ctrl+B / Ctrl+I / Ctrl+U work inside
// contentEditable; the toolbar + Ctrl+K (link) add the rest. Uncontrolled:
// initial HTML is set once on mount; reset by changing the component key.
export function RichEditor({ value, onChange, placeholder, singleLine, dense, minHeight = 120, onSubmit }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value ?? "")) ref.current.innerHTML = value ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const link = () => {
    const url = prompt("URL:");
    if (url) exec("createLink", url);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "k") {
      e.preventDefault();
      link();
      return;
    }
    if (singleLine && e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if (!singleLine && meta && e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const btn = (label: React.ReactNode, cmd: string | (() => void), style?: React.CSSProperties) => (
    <button
      type="button"
      className="btng"
      style={{ padding: dense ? "5px 9px" : "6px 12px", boxShadow: "none", ...style }}
      onMouseDown={(e) => {
        e.preventDefault();
        typeof cmd === "string" ? exec(cmd) : cmd();
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {btn("B", "bold", { fontWeight: 800 })}
        {btn("I", "italic", { fontStyle: "italic" })}
        {btn("U", "underline", { textDecoration: "underline" })}
        {btn(<Icon name="link" size={13} />, link)}
        {!dense && btn(<Icon name="code" size={13} />, () => exec("formatBlock", "pre"))}
      </div>
      <div
        ref={ref}
        className="finput rte"
        contentEditable
        data-ph={placeholder}
        style={{ minHeight: singleLine ? undefined : minHeight, ...(singleLine ? { whiteSpace: "nowrap", overflowX: "auto" } : {}) }}
        onInput={emit}
        onKeyDown={onKeyDown}
        suppressContentEditableWarning
      />
    </div>
  );
}
