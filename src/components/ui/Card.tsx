import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, children, onClick, ...props }, ref) => {
    const baseClasses = 'rounded-lg transition-all duration-200';
    
    const variants = {
      default: 'bg-white border border-gray-200 shadow-sm',
      elevated: 'bg-white border border-gray-200 shadow-md hover:shadow-lg',
      outlined: 'bg-white border-2 border-gray-200',
      interactive: 'bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 cursor-pointer'
    };
    
    return (
      <div
        ref={ref}
        className={clsx(
          baseClasses,
          variants[variant],
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    );
  }
);

interface CardHeaderProps {
  className?: string;
  children: React.ReactNode;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('px-6 py-4 border-b border-gray-200', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

interface CardContentProps {
  className?: string;
  children: React.ReactNode;
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('px-6 py-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('px-6 py-4 border-t border-gray-200 bg-gray-50', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardContent, CardFooter };
