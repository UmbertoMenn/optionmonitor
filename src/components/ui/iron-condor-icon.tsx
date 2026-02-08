import * as React from "react";

interface IronCondorIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const IronCondorIcon = React.forwardRef<SVGSVGElement, IronCondorIconProps>(
  ({ size = 24, className, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {/* Iron Condor payoff diagram - stylized trapezoid shape (enlarged) */}
        {/* Left wing (descending) */}
        <path d="M1 21 L5 14" />
        {/* Left slope to plateau */}
        <path d="M5 14 L7 6" />
        {/* Upper plateau (profit zone) */}
        <path d="M7 6 L17 6" />
        {/* Right slope from plateau */}
        <path d="M17 6 L19 14" />
        {/* Right wing (descending) */}
        <path d="M19 14 L23 21" />
        {/* Zero line (break-even reference) */}
        <path d="M3 14 L21 14" strokeOpacity="0.3" strokeDasharray="2 2" />
      </svg>
    );
  }
);

IronCondorIcon.displayName = "IronCondorIcon";
