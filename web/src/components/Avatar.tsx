import { avatarColor, initials } from "../store/utils";

type Props = {
  nickname: string;
  avatarUrl?: string | null;
  size?: number;
  onClick?: () => void;
  color?: string;
  as?: "div" | "button";
};

export function Avatar({ nickname, avatarUrl, size = 40, onClick, color, as = "div" }: Props) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.36),
    background: color ?? avatarColor(nickname),
  };
  if (avatarUrl) {
    return (
      <div
        className="av"
        style={{ ...style, backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center", cursor: onClick ? "pointer" : undefined }}
        onClick={onClick}
        aria-label={nickname}
      />
    );
  }
  const Cmp = as;
  return (
    <Cmp
      className="av"
      style={{ ...style, cursor: onClick ? "pointer" : undefined, border: 0 }}
      onClick={onClick}
    >
      {initials(nickname)}
    </Cmp>
  );
}
