import React from 'react';
import { getInitials } from '../utils/roles';

interface MemberAvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MemberAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-16 h-16 text-lg'
};

const PALETTES = [
  'bg-[#1B365D] text-[#F7F6F2]',
  'bg-[#2C423F] text-[#F7F6F2]',
  'bg-[#4A3B2C] text-[#F7F6F2]',
  'bg-[#323A4A] text-[#F7F6F2]',
  'bg-[#5B4527] text-[#F7F6F2]'
];

function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  src,
  size = 'md',
  className = ''
}) => {
  const sizeClass = SIZE_CLASSES[size];
  const validSrc = src && (src.startsWith('data:') || src.startsWith('/')) ? src : '';

  if (validSrc) {
    return (
      <img
        src={validSrc}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15 shrink-0 ${className}`}
      />
    );
  }

  const initials = getInitials(name);
  const palette = getPalette(name);

  return (
    <div
      aria-label={name}
      className={`${sizeClass} ${palette} rounded-full flex items-center justify-center font-semibold tracking-wider ring-1 ring-black/10 dark:ring-white/15 shrink-0 select-none ${className}`}
    >
      {initials}
    </div>
  );
};
