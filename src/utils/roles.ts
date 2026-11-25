import { MeetingSession, User, UserRole } from '../types';

export function getRoleLabel(role: UserRole | string): string {
  switch (role) {
    case 'administrador':
      return 'Administrador';
    case 'presidente':
      return 'Presidente';
    case 'secretario':
      return 'Secretário';
    case 'tesoureiro':
      return 'Tesoureiro';
    case 'membro':
    case 'conselheiro':
      return 'Membro da Comissão';
    case 'observador':
      return 'Observador';
    default:
      return String(role);
  }
}

export function isSystemAdmin(user?: Pick<User, 'isAdmin' | 'role'> | null): boolean {
  return Boolean(user && (user.isAdmin || user.role === 'administrador'));
}

export function isVotingMember(user?: Pick<User, 'role'> | null): boolean {
  if (!user) return false;
  return user.role !== 'observador' && user.role !== 'administrador';
}

export function formatUserRoleSummary(user?: Pick<User, 'role' | 'isAdmin'> | null): string {
  if (!user) return '';
  const base = getRoleLabel(user.role);
  if (user.isAdmin && user.role !== 'administrador') {
    return `${base} · Admin`;
  }
  return base;
}

export function canSignAta(user?: User | null, session?: MeetingSession | null): boolean {
  if (!user || !session) return false;
  if (user.role === 'secretario' || user.role === 'presidente') return true;
  if (session.secretarioId === user.id || session.presidenteId === user.id) return true;
  return Boolean(session.designatedSignersIds?.includes(user.id));
}

export function getInitials(name: string): string {
  const parts = name
    .replace(/^(Pr\.|Pra\.|Dc\.|Ir\.)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'MC';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
