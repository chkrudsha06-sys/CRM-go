import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "!h-7 !w-7 text-[11px]",
  md: "",
  lg: "large",
};

const PALETTE = [
  "linear-gradient(135deg, rgba(139,124,246,.30), rgba(96,165,250,.20))",
  "linear-gradient(135deg, rgba(52,211,153,.26), rgba(34,211,238,.16))",
  "linear-gradient(135deg, rgba(251,191,36,.28), rgba(251,113,133,.16))",
  "linear-gradient(135deg, rgba(192,132,252,.28), rgba(139,124,246,.18))",
  "linear-gradient(135deg, rgba(96,165,250,.28), rgba(34,211,238,.16))",
];

function getInitial(name?: string | null) {
  const safeName = name?.trim();
  if (!safeName) return "?";
  return safeName.slice(0, 1).toUpperCase();
}

function getPaletteIndex(name?: string | null) {
  const safeName = name?.trim() || "unknown";
  return Array.from(safeName).reduce((acc, char) => acc + char.charCodeAt(0), 0) % PALETTE.length;
}

export default function Avatar({ name, imageUrl, size = "md", className = "" }: AvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const background = PALETTE[getPaletteIndex(name)];

  return (
    <span
      className={`crm-avatar-v2 ${sizeClass} ${className}`.trim()}
      style={{ background }}
      title={name || "고객"}
      aria-label={name || "고객"}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name || "avatar"} width={64} height={64} className="h-full w-full object-cover" />
      ) : (
        getInitial(name)
      )}
    </span>
  );
}
