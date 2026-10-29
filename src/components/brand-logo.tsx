import Image from "next/image";

const LOGO_SRC = "/logo.svg";

type BrandLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = 32,
  className,
  alt = "",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={className}
      unoptimized
    />
  );
}
