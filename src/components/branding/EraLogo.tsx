import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";
import eraFull from "../../assets/branding/era-logo-full.png";
import eraCompact from "../../assets/branding/era-logo-compact.png";
import eraMark from "../../assets/branding/era-logo-mark.png";

export interface EraLogoProps {
  variant?: "full" | "compact" | "mark";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  href?: string;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: { height: "h-5", maxH: 20 },
  sm: { height: "h-7", maxH: 28 },
  md: { height: "h-9", maxH: 36 },
  lg: { height: "h-12", maxH: 48 },
  xl: { height: "h-16", maxH: 64 },
};

const VARIANT_MAP = {
  full: eraFull,
  compact: eraCompact,
  mark: eraMark,
};

export function EraLogo({
  variant = "compact",
  size = "md",
  href,
  className,
  alt = "ERA — Efficient Resource & Administration",
  onClick,
}: EraLogoProps) {
  const logoSrc = VARIANT_MAP[variant] || eraCompact;
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  const content = (
    <img
      src={logoSrc}
      alt={alt}
      className={cn(
        "object-contain w-auto transition-opacity duration-200 select-none",
        sizeConfig.height,
        // Ensure contrast and crisp visibility across themes
        "dark:drop-shadow-[0_1px_4px_rgba(255,255,255,0.18)]",
        className
      )}
      style={{ maxHeight: sizeConfig.maxH }}
    />
  );

  if (href) {
    return (
      <Link
        to={href}
        onClick={onClick}
        className="inline-flex items-center focus-ring rounded-lg shrink-0 transition-opacity hover:opacity-90"
        aria-label="ERA Home"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center focus-ring rounded-lg shrink-0 cursor-pointer transition-opacity hover:opacity-90"
      >
        {content}
      </button>
    );
  }

  return <div className="inline-flex items-center shrink-0">{content}</div>;
}

export default EraLogo;
