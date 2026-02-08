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
        {/* Iron Condor payoff diagram - correct shape with extended flat wings */}
        {/* Left flat wing (max loss zone) - extended */}
        <path d="M0 18 L7 18" />
        {/* Left diagonal (up to plateau) */}
        <path d="M7 18 L9 6" />
        {/* Upper plateau (max profit zone) */}
        <path d="M9 6 L15 6" />
        {/* Right diagonal (down from plateau) */}
        <path d="M15 6 L17 18" />
        {/* Right flat wing (max loss zone) - extended */}
        <path d="M17 18 L24 18" />
      </svg>
    );
  }
);

IronCondorIcon.displayName = "IronCondorIcon";
