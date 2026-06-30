import React, { useId } from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
  glowing?: boolean;
  variant?: "app-icon" | "compact" | "raw";
}

export default function DeadlineGuardianLogo({
  className = "",
  size = "100%",
  glowing = true,
  variant = "compact",
}: LogoProps) {
  const uniqueId = useId().replace(/:/g, "-");
  const premiumGlowId = `premium-glow-${uniqueId}`;
  const softShadowId = `soft-shadow-${uniqueId}`;
  const premiumBgGradId = `premium-bg-grad-${uniqueId}`;
  const accentGlowId = `accent-glow-${uniqueId}`;
  const symbolGradId = `symbol-grad-${uniqueId}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{ width: size, height: size }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Glow Filters */}
        <filter id={premiumGlowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id={softShadowId} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#090E1A" floodOpacity="0.25" />
        </filter>

        {/* Primary Grayscale Background: Rich dark charcoal to pure black */}
        <linearGradient id={premiumBgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C1C1E" />
          <stop offset="100%" stopColor="#0A0A0C" />
        </linearGradient>

        {/* Subtle Accent Glow: Clean white sheen */}
        <radialGradient id={accentGlowId} cx="80%" cy="20%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Symbol Inner Gradients for raw usage */}
        <linearGradient id={symbolGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#A3A3A3" />
        </linearGradient>
      </defs>

      {/* RENDER VARIANT: FULL PREMIUM APP ICON (iOS Squircle) */}
      {variant === "app-icon" && (
        <>
          {/* Subtle Outer Drop Shadow */}
          <g filter={`url(#${softShadowId})`}>
            {/* iOS style Squircle rounded square */}
            <rect x="6" y="6" width="88" height="88" rx="22" fill={`url(#${premiumBgGradId})`} />
          </g>

          {/* Subtle Warm Accent Glow Overlay */}
          <rect x="6" y="6" width="88" height="88" rx="22" fill={`url(#${accentGlowId})`} style={{ mixBlendMode: "screen" }} />

          {/* Soft internal gloss border */}
          <rect
            x="6.5"
            y="6.5"
            width="87"
            height="87"
            rx="21.5"
            stroke="#FFFFFF"
            strokeOpacity="0.15"
            strokeWidth="1"
            fill="none"
          />

          {/* Symmetrical Clock Dotted Arc completing the time/clock concept */}
          <path
            d="M 50 24 A 26 26 0 0 1 76 50"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="4 5"
            opacity="0.4"
          />

          {/* Geometric G-Shield (Subtle shield tip, integrated G) */}
          <path
            d="M 50 24 C 35.64 24, 24 35.64, 24 50 C 24 63.5, 35 74.5, 50 76.5 C 65 74.5, 76 63.5, 76 50 L 52 50"
            stroke="#FFFFFF"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Clock Center Hub */}
          <circle cx="50" cy="50" r="4" fill="#FFFFFF" />

          {/* Sleek Clock Hand pointing to the AI Sparkle */}
          <line
            x1="50"
            y1="50"
            x2="60"
            y2="40"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* AI Sparkle Star (representing intelligence/companion) */}
          <g filter={glowing ? `url(#${premiumGlowId})` : undefined}>
            <path
              d="M 68 18 C 68 22.4, 64.4 26, 60 26 C 64.4 26, 68 29.6, 68 34 C 68 29.6, 71.6 26, 76 26 C 71.6 26, 68 22.4, 68 18 Z"
              fill="#FFFFFF"
            />
          </g>
        </>
      )}

      {/* RENDER VARIANT: COMPACT (Optimized for small UI layouts/tabs/sidebar) */}
      {variant === "compact" && (
        <>
          {/* Subtle Clock Dotted Arc */}
          <path
            d="M 50 24 A 26 26 0 0 1 76 50"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="3 4"
            opacity="0.5"
            className="text-neutral-400 dark:text-neutral-500"
          />

          {/* Geometric G-Shield */}
          <path
            d="M 50 24 C 35.64 24, 24 35.64, 24 50 C 24 63.5, 35 74.5, 50 76.5 C 65 74.5, 76 63.5, 76 50 L 52 50"
            stroke="currentColor"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-800 dark:text-white"
          />

          {/* Clock Center Hub */}
          <circle cx="50" cy="50" r="4" fill="currentColor" className="text-neutral-800 dark:text-white" />

          {/* Clock Hand */}
          <line
            x1="50"
            y1="50"
            x2="60"
            y2="40"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="text-neutral-800 dark:text-white"
          />

          {/* AI Sparkle Star */}
          <path
            d="M 68 18 C 68 22.4, 64.4 26, 60 26 C 64.4 26, 68 29.6, 68 34 C 68 29.6, 71.6 26, 76 26 C 71.6 26, 68 22.4, 68 18 Z"
            fill="currentColor"
            className="text-neutral-600 dark:text-neutral-300"
          />
        </>
      )}

      {/* RENDER VARIANT: RAW (Transparent single-color or gradient silhouette) */}
      {variant === "raw" && (
        <g stroke="currentColor" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          {/* Symmetrical Dotted Clock Ring segment */}
          <path
            d="M 50 24 A 26 26 0 0 1 76 50"
            strokeWidth="3"
            strokeDasharray="3 4"
            opacity="0.6"
          />

          {/* Geometric G-Shield path */}
          <path d="M 50 24 C 35.64 24, 24 35.64, 24 50 C 24 63.5, 35 74.5, 50 76.5 C 65 74.5, 76 63.5, 76 50 L 52 50" />

          {/* Clock Center Hub */}
          <circle cx="50" cy="50" r="1.5" fill="currentColor" stroke="none" />

          {/* Clock Hand */}
          <line x1="50" y1="50" x2="60" y2="40" strokeWidth="3" />

          {/* AI Sparkle Star */}
          <path
            d="M 68 18 C 68 22.4, 64.4 26, 60 26 C 64.4 26, 68 29.6, 68 34 C 68 29.6, 71.6 26, 76 26 C 71.6 26, 68 22.4, 68 18 Z"
            fill="currentColor"
            stroke="none"
          />
        </g>
      )}
    </svg>
  );
}
