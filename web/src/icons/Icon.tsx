import { AG_ICONS } from "./ag-icons";

type Props = {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

/** Renders an inline SVG icon from the ported Font Awesome set, matching the
 *  prototype's `_svg()` helper: currentColor fill, block display. */
export function Icon({ name, size = 18, className, style }: Props) {
  const def = AG_ICONS[name];
  if (!def) return null;
  const [viewBox, path] = def;
  return (
    <span className={`ic ${className ?? ""}`} style={style}>
      <svg width={size} height={size} viewBox={viewBox} fill="currentColor" aria-hidden="true">
        <path d={path} />
      </svg>
    </span>
  );
}
