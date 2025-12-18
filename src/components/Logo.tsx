interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo = ({ className, size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10', 
    lg: 'h-12'
  };
  
  return (
    <img 
      src="/images/nextmic-logo.svg" 
      alt="nextmic" 
      className={`${sizeClasses[size]} w-auto ${className || ''}`}
    />
  );
};
