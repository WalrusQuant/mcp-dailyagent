/**
 * Brand mark: agent + browser → database.
 * Same mark as public/icon-*.svg / app icons — not a music note.
 */
export function CadenceMark({
  size = 20,
  className = "",
  title = "Cadence",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="26" y="36" width="72" height="56" rx="10" />
        <rect x="26" y="164" width="72" height="56" rx="10" />
        <path d="M 98 64 Q 140 64 155 100" strokeWidth="13" />
        <path d="M 98 192 Q 140 192 155 156" strokeWidth="13" />
        <ellipse cx="195" cy="96" rx="42" ry="16" />
        <path d="M 153 96 L 153 160 A 42 16 0 0 0 237 160 L 237 96" />
        <path d="M 153 128 A 42 16 0 0 0 237 128" strokeWidth="12" opacity="0.55" />
      </g>
    </svg>
  );
}
