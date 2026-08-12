/**
 * The INFINITE-AI identity mark: two overlapping circles (r=20) rendered as a
 * lemniscate-style symbol with the eight-hue spectrum gradient clipped inside.
 * Fully accessible: role="img" + aria-label so screen readers announce the brand.
 */

export interface InfinityMarkProps {
  readonly size?: number;
  readonly label?: string;
  readonly className?: string;
}

export function InfinityMark({
  size = 48,
  label = 'Infinite AI',
  className,
}: InfinityMarkProps) {
  const id = 'iai-spectrum-grad';
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 80 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e4483f" />
          <stop offset="14%" stopColor="#f2811f" />
          <stop offset="28%" stopColor="#f5b400" />
          <stop offset="42%" stopColor="#2fae66" />
          <stop offset="57%" stopColor="#159e94" />
          <stop offset="71%" stopColor="#1565c0" />
          <stop offset="85%" stopColor="#4a4fc4" />
          <stop offset="100%" stopColor="#7b2fbe" />
        </linearGradient>
      </defs>
      {/* Left circle */}
      <circle cx="20" cy="20" r="20" fill={`url(#${id})`} fillOpacity="0.15" />
      <circle cx="20" cy="20" r="20" stroke={`url(#${id})`} strokeWidth="3" fill="none" />
      {/* Right circle */}
      <circle cx="60" cy="20" r="20" fill={`url(#${id})`} fillOpacity="0.15" />
      <circle cx="60" cy="20" r="20" stroke={`url(#${id})`} strokeWidth="3" fill="none" />
    </svg>
  );
}
