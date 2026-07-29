interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7 text-caption',
  md: 'w-9 h-9 text-body',
  lg: 'w-12 h-12 text-h3',
};

export function Avatar({ src, alt = '', initials, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClasses[size]} rounded-full object-cover bg-[rgb(var(--color-surface))] ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[rgb(var(--color-accent))]/10 flex items-center justify-center text-[rgb(var(--color-accent))] font-medium ${className}`}
      aria-label={alt || initials}
      role="img"
    >
      {initials?.slice(0, 2).toUpperCase() ?? '?'}
    </div>
  );
}

