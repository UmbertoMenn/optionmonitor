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
        {/* Iron Condor payoff diagram - stylized trapezoid shape */}
        {/* Left wing (descending) */}
        <path d="M2 18 L6 14" />
        {/* Left slope to plateau */}
        <path d="M6 14 L8 10" />
        {/* Upper plateau (profit zone) */}
        <path d="M8 10 L16 10" />
        {/* Right slope from plateau */}
        <path d="M16 10 L18 14" />
        {/* Right wing (descending) */}
        <path d="M18 14 L22 18" />
        {/* Zero line (break-even reference) */}
        <path d="M4 14 L20 14" strokeOpacity="0.3" strokeDasharray="2 2" />
      </svg>
    );
  }
);

IronCondorIcon.displayName = "IronCondorIcon";
