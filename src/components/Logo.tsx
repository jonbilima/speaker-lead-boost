import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  forceDark?: boolean; // Force dark logo (for light backgrounds like invoices)
  forceLight?: boolean; // Force light logo (for dark backgrounds)
}

export const Logo = ({ className, size = 'md', forceDark, forceLight }: LogoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10', 
    lg: 'h-12'
  };

  // Determine which logo to use
  let logoSrc = "/images/nextmic-logo.svg"; // default dark logo
  
  if (mounted) {
    if (forceLight) {
      logoSrc = "/images/nextmic-logo-light.svg";
    } else if (forceDark) {
      logoSrc = "/images/nextmic-logo.svg";
    } else if (resolvedTheme === 'dark') {
      logoSrc = "/images/nextmic-logo-light.svg";
    }
  }
  
  return (
    <img 
      src={logoSrc}
      alt="nextmic" 
      className={`${sizeClasses[size]} w-auto ${className || ''}`}
    />
  );
};
