import type { SVGProps } from "react";

/**
 * Iconos de trazo del panel admin (heredan `currentColor`). Compartidos por el
 * sidebar y el dashboard para no duplicarlos.
 */
function s(p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...p,
  };
}

export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const FinanceIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M12 1v22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
export const ArtistIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);
export const ProducersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 19c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" />
    <path d="M16.5 8.4a3 3 0 0 1 0 5.2" />
    <path d="M18.7 19c0-2.2-1-3.8-2.6-4.7" />
  </svg>
);
export const StudioIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 21h18" />
    <path d="M5 21V8l7-5 7 5v13" />
    <path d="M10 21v-6h4v6" />
  </svg>
);
export const QuoteIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);
export const PaymentIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </svg>
);
export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);
export const MusicIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
export const HelpIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.8.4-1 .8-1 1.6" />
    <path d="M12 17h.01" />
  </svg>
);
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const KebabIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <circle cx="12" cy="5" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="12" cy="19" r="1.4" />
  </svg>
);
export const TrendUpIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M17 7h4v4" />
  </svg>
);
export const TrendDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 7l6 6 4-4 8 8" />
    <path d="M17 17h4v-4" />
  </svg>
);
