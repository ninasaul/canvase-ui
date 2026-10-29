type MediaIconProps = {
  size?: number;
  className?: string;
};

function Svg({
  size = 16,
  className,
  children,
}: MediaIconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {children}
    </svg>
  );
}

export function SolidPlayIcon({ size, className }: MediaIconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.5-6.86a1 1 0 0 0 0-1.7L9.53 4.3A1 1 0 0 0 8 5.14Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function SolidPauseIcon({ size, className }: MediaIconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="5" y="4.5" width="4.5" height="15" rx="1.2" fill="currentColor" />
      <rect x="14.5" y="4.5" width="4.5" height="15" rx="1.2" fill="currentColor" />
    </Svg>
  );
}

export function SolidVolumeIcon({ size, className }: MediaIconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4V9.5Z"
        fill="currentColor"
      />
      <path
        d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SolidVolumeMuteIcon({ size, className }: MediaIconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4V9.5Z"
        fill="currentColor"
      />
      <path
        d="m15 9 5 6M20 9l-5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SolidFullscreenIcon({ size, className }: MediaIconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9v2H6v3H4ZM15 4h3.5A1.5 1.5 0 0 1 20 5.5V9h-2V6h-3V4ZM4 15h2v3h3v2H5.5A1.5 1.5 0 0 1 4 18.5V15ZM18 15h2v3.5a1.5 1.5 0 0 1-1.5 1.5H15v-2h3v-3Z"
        fill="currentColor"
      />
    </Svg>
  );
}
