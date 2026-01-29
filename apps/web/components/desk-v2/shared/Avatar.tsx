'use client';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`
          ${SIZES[size]}
          rounded-full object-cover
          ${className}
        `}
      />
    );
  }

  return (
    <div
      className={`
        ${SIZES[size]}
        rounded-full bg-gradient-to-br from-amber-500 to-amber-600
        flex items-center justify-center font-bold text-white
        ${className}
      `}
    >
      {initials}
    </div>
  );
}
