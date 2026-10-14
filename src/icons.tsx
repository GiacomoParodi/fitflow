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

// Sidebar (SF Symbols-like line icons).
export const Dashboard = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={1.8}><rect x="3" y="3" width="7.5" height="9" rx="2" /><rect x="13.5" y="3" width="7.5" height="5" rx="2" /><rect x="13.5" y="11" width="7.5" height="10" rx="2" /><rect x="3" y="15" width="7.5" height="6" rx="2" /></Icon>
);
export const Users = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={1.8}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>
);
export const Chart = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={1.8}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="5" rx="1" /><rect x="12" y="8" width="3" height="9" rx="1" /><rect x="17" y="5" width="3" height="12" rx="1" /></Icon>
);
export const Wallet = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={1.8}><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M17 14h.01" /></Icon>
);
export const Sparkles = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={1.8}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></Icon>
);
export const Gear = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={1.8}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>
);
export const Pulse = ({ size = 17 }: { size?: number }) => (
  <Icon size={size} width={2.2}><path d="M3 12h4l3-8 4 16 3-8h4" /></Icon>
);

// Icone condivise (prima duplicate nelle singole pagine). Tratto 2 come le altre, per stati vuoti e pulsanti.
type P = { size?: number };
export const Calendar = ({ size }: P) => (
  <Icon size={size}><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>
);
export const Search = ({ size }: P) => (<Icon size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>);
export const ChevronRight = ({ size }: P) => (<Icon size={size}><path d="m9 18 6-6-6-6" /></Icon>);
export const ChevronDown = ({ size }: P) => (<Icon size={size}><path d="m6 9 6 6 6-6" /></Icon>);
export const Pencil = ({ size }: P) => (<Icon size={size}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Icon>);
export const Printer = ({ size }: P) => (
  <Icon size={size}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></Icon>
);
export const Clock = ({ size }: P) => (<Icon size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>);
export const Alert = ({ size }: P) => (
  <Icon size={size}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Icon>
);
export const Info = ({ size }: P) => (<Icon size={size}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icon>);
export const Heart = ({ size }: P) => (
  <Icon size={size}><path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z" /></Icon>
);
export const Euro = ({ size }: P) => (<Icon size={size}><path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10" /></Icon>);
export const Card = ({ size }: P) => (<Icon size={size}><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></Icon>);
export const IdCard = ({ size }: P) => (
  <Icon size={size}><rect x="2" y="4" width="20" height="16" rx="3" /><circle cx="8.5" cy="11" r="2.2" /><path d="M5.5 16.5a3.2 3.2 0 0 1 6 0M14 9.5h5M14 13h4" /></Icon>
);
export const Dumbbell = ({ size }: P) => (<Icon size={size}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></Icon>);
export const Sun = ({ size }: P) => (
  <Icon size={size}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
);
export const Moon = ({ size }: P) => (<Icon size={size}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Icon>);
export const Palette = ({ size }: P) => (
  <Icon size={size}><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H15a2 2 0 0 0-1.4 3.4c.9.9.4 2.6-1.6 2.6z" /><path d="M7.5 11h.01M10 7h.01M15 7.5h.01" /></Icon>
);
export const Folder = ({ size }: P) => (<Icon size={size}><path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Icon>);
export const Database = ({ size }: P) => (
  <Icon size={size}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Icon>
);
export const Phone = ({ size }: P) => (
  <Icon size={size}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></Icon>
);
export const Mail = ({ size }: P) => (<Icon size={size}><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m3 7 9 6 9-6" /></Icon>);
export const Bell = ({ size }: P) => (<Icon size={size}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Icon>);
export const Lock = ({ size }: P) => (<Icon size={size}><rect x="4" y="11" width="16" height="10" rx="3" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>);
export const Save = ({ size }: P) => (<Icon size={size}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></Icon>);
export const UserPlus = ({ size }: P) => (
  <Icon size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></Icon>
);
export const Shield = ({ size }: P) => (<Icon size={size}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></Icon>);
