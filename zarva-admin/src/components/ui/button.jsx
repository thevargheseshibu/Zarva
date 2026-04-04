import * as React from 'react';
import { cn } from '@/lib/utils';

const Button = React.forwardRef(({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
  const variants = {
    default: 'bg-purple-600 text-white hover:bg-purple-500',
    destructive: 'bg-red-600 text-white hover:bg-red-500',
    outline: 'border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white',
    secondary: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
    ghost: 'hover:bg-zinc-800 hover:text-white text-zinc-400',
    link: 'text-purple-400 underline-offset-4 hover:underline',
  };

  const sizes = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-7 rounded-md px-3 text-xs',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-9 w-9',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      disabled={disabled}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button };
