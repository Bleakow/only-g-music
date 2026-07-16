import type { SVGProps } from "react";

function stroke(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke(props)}>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
