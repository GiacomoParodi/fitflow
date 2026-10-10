// Lucide icons (https://lucide.dev), inlined to avoid a dependency for a handful of glyphs.
import type { ReactNode } from 'react';

function Icon({ size = 14, children, width = 2 }: { size?: number; children: ReactNode; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const Plus = ({ size }: { size?: number }) => <Icon size={size}><path d="M12 5v14M5 12h14" /></Icon>;
export const X = ({ size }: { size?: number }) => <Icon size={size}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const Check = ({ size = 16 }: { size?: number }) => <Icon size={size} width={3}><path d="M20 6 9 17l-5-5" /></Icon>;
export const Eye = () => <Icon><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const Upload = () => <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Icon>;
export const Download = () => <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>;
export const Trash = () => <Icon><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Icon>;
export const FileCheck = () => (
  <Icon size={20}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></Icon>
);
export const Refresh = () => (
  <Icon><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" /></Icon>
);
export const UserMinus = () => (
  <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M17 11h6" /></Icon>
);
