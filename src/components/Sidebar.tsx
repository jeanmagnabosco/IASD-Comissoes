import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { MemberAvatar } from './MemberAvatar';
import { formatUserRoleSummary, isSystemAdmin, isVotingMember } from '../utils/roles';
import {
  Church,
  Users,
  Vote,
  Award,
  FileText,
  History,
  Settings,
  ShieldCheck,
  Share2,
  LogOut,
  ChevronDown,
  CheckCircle2,
  X,
  ExternalLink,
  Copy,
  Check,
  Moon,
  Sun,
  Bell,
  BellRing,
  ScanFace
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile
}) => {
  const {
    currentUser,
    users,
    logout,
    currentSession,
    setCommissionType,
    pautas,
    elections,
    approvedAtas,
    darkMode,
    setDarkMode,
    notificationsEnabled,
    requestNotificationPermission
  } = useChurch();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const previewUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://ais-pre-snkbx6sngeokfiovmirnl5-117556746211.us-east1.run.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(previewUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const presentCount = users.filter(
    u => u.presenceStatus === 'presente' && isVotingMember(u)
  ).length;
  const totalVotingMembers = users.filter(u => isVotingMember(u)).length;
  const quorumMet = totalVotingMembers > 0 && presentCount >= Math.floor(totalVotingMembers / 2) + 1;
  const quorumPercent = totalVotingMembers > 0 ? Math.round((presentCount / totalVotingMembers) * 100) : 0;

  const sharedPautasCount = pautas.filter(p => p.compartilhadaComMembros).length;
  const sharedElectionsCount = elections.filter(e => e.compartilhadaComMembros).length;
  const activeVotingPautasCount = pautas.filter(p => p.status === 'votacao_aberta').length;
  const activeElectionsCount = elections.filter(
    e => e.status === 'votacao_turno_1' || e.status === 'votacao_turno_2'
  ).length;
  const pendingFacialCount = users.filter(
    u => u.role !== 'presidente' && !u.isAdmin && u.role !== 'administrador' && u.facialAuthorizationStatus === 'pendente_autorizacao'
  ).length;

  const canAccessControlPanel = isSystemAdmin(currentUser) || currentUser?.role === 'presidente';
  const commissionMode = currentSession.commissionType || 'diretiva';

  const navItems = [
    {
      id: 'membro',
      label: 'Área do Membro',
      icon: Users,
      badge: sharedPautasCount + sharedElectionsCount > 0 ? `${sharedPautasCount + sharedElectionsCount}` : undefined
    },
    {
      id: 'pautas',
      label: 'Comissão Diretiva',
      icon: Vote,
      badge: activeVotingPautasCount > 0 ? `${activeVotingPautasCount} aberta` : `${pautas.length}`,
      isLive: activeVotingPautasCount > 0
    },
    {
      id: 'eleicoes',
      label: 'Comissão de Nomeações',
      icon: Award,
      badge: activeElectionsCount > 0 ? `${activeElectionsCount} aberta` : `${elections.length}`,
      isLive: activeElectionsCount > 0
    },
    {
      id: 'ata',
      label: 'Ata Canônica',
      icon: FileText,
      badge: currentSession.ataAprovada ? 'Aprovada' : 'Aberta'
    },
    {
      id: 'historico',
      label: 'Histórico & Acervo',
      icon: History,
      badge: `${approvedAtas.length}`
    },
    ...(canAccessControlPanel
      ? [
          {
            id: 'admin',
            label: isSystemAdmin(currentUser) ? 'Administração' : 'Painel da Presidência',
            icon: Settings,
            badge: pendingFacialCount > 0 ? `${pendingFacialCount} facial` : `${users.length}`,
            isLive: pendingFacialCount > 0
          }
        ]
      : [])
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#0B0E14]/65 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-[#121722] border-r border-[#E5E1D8] dark:border-[#1F2838]
          flex flex-col transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Top Brand */}
        <div className="p-5 border-b border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] flex items-center justify-center shrink-0">
              <Church className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight block leading-none">
                IASD Comissões
              </span>
              <p className="text-[11px] text-[#9A7B3E] dark:text-[#D4AF63] font-medium truncate mt-1">
                Governança Eclesiástica
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-[#5A616E] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Commission Mode Switcher */}
        <div className="mx-3 mt-3 p-1 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] grid grid-cols-2 gap-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setCommissionType('diretiva');
              onSelectTab('pautas');
            }}
            className={`py-1.5 px-2 rounded-lg transition cursor-pointer ${
              commissionMode === 'diretiva'
                ? 'bg-[#1B365D] text-white dark:bg-[#D4AF63] dark:text-[#0B0E14]'
                : 'text-[#5A616E] dark:text-[#949BA8] hover:text-[#14181F] dark:hover:text-[#F1EFEA]'
            }`}
          >
            Com. Diretiva
          </button>
          <button
            type="button"
            onClick={() => {
              setCommissionType('nomeacoes');
              onSelectTab('eleicoes');
            }}
            className={`py-1.5 px-2 rounded-lg transition cursor-pointer ${
              commissionMode === 'nomeacoes'
                ? 'bg-[#1B365D] text-white dark:bg-[#D4AF63] dark:text-[#0B0E14]'
                : 'text-[#5A616E] dark:text-[#949BA8] hover:text-[#14181F] dark:hover:text-[#F1EFEA]'
            }`}
          >
            Nomeações
          </button>
        </div>

        {/* Active Session Card */}
        <div className="p-3.5 mx-3 mt-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63] truncate">
              {currentSession.numeroAta}
            </span>
            <span
              className={`text-[10px] font-semibold shrink-0 ${
                currentSession.ataAprovada ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#9A7B3E] dark:text-[#D4AF63]'
              }`}
            >
              {currentSession.ataAprovada ? 'Ata Aprovada' : 'Em Sessão'}
            </span>
          </div>
          <p className="text-[11px] text-[#14181F] dark:text-[#F1EFEA] font-medium truncate">
            {currentSession.titulo}
          </p>
          <div className="pt-1.5 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between text-[10px] text-[#5A616E] dark:text-[#949BA8]">
            <span className="truncate">{currentSession.local}</span>
            <span className="font-mono-tabular shrink-0">
              {new Date(currentSession.dataHora).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5A616E] dark:text-[#949BA8]">
            Navegação
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] font-semibold'
                    : 'text-[#5A616E] dark:text-[#949BA8] hover:text-[#14181F] dark:hover:text-[#F1EFEA] hover:bg-[#F7F6F2] dark:hover:bg-[#181F2D]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono-tabular shrink-0 ${
                      isActive
                        ? 'text-white/85 dark:text-[#0B0E14]/85'
                        : item.isLive
                        ? 'text-[#9A7B3E] dark:text-[#D4AF63] font-semibold'
                        : 'text-[#5A616E] dark:text-[#949BA8]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quorum & Direct Link */}
          <div className="pt-4 mt-3 border-t border-[#E5E1D8] dark:border-[#1F2838] space-y-2.5">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5A616E] dark:text-[#949BA8]">
              Quórum da Comissão
            </div>

            <div className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#5A616E] dark:text-[#949BA8]">Presentes:</span>
                <span className="font-mono-tabular font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                  {presentCount} / {totalVotingMembers}
                </span>
              </div>

              <div className="w-full bg-[#E5E1D8] dark:bg-[#1F2838] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${quorumMet ? 'bg-emerald-600' : 'bg-[#9A7B3E]'}`}
                  style={{ width: `${Math.min(quorumPercent, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className={quorumMet ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-[#9A7B3E]'}>
                  {quorumMet ? 'Quórum Válido' : 'Quórum Insuficiente'}
                </span>
                <span className="font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">{quorumPercent}%</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#9A7B3E]/40 dark:border-[#D4AF63]/40 bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#1B365D] dark:text-[#D4AF63] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-semibold transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Link de Acesso &amp; Votação</span>
            </button>
          </div>
        </div>

        {/* Utilities */}
        <div className="p-3 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Tema Claro' : 'Tema Escuro'}
              className="p-2 rounded-xl text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#D4AF63]" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={requestNotificationPermission}
              title={notificationsEnabled ? 'Notificações ativas' : 'Ativar notificações'}
              className="p-2 rounded-xl text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
            >
              {notificationsEnabled ? <BellRing className="w-4 h-4 text-[#D4AF63]" /> : <Bell className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            <ScanFace className="w-3.5 h-3.5" />
            <span>Facial Ativo</span>
          </div>
        </div>

        {/* Footer User Profile */}
        {currentUser && (
          <div className="p-3 border-t border-[#E5E1D8] dark:border-[#1F2838] relative bg-[#F7F6F2]/60 dark:bg-[#0B0E14]/60">
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MemberAvatar
                  name={currentUser.name}
                  src={currentUser.facialSnapshotDataUrl || currentUser.avatarUrl}
                  size="md"
                />
                <div className="truncate">
                  <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate leading-tight">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-[#5A616E] dark:text-[#949BA8] truncate">
                    @{currentUser.username} · {formatUserRoleSummary(currentUser)}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#5A616E] shrink-0 ml-1" />
            </button>

            {showUserDropdown && (
              <div className="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-[#E5E1D8] dark:border-[#1F2838] py-2 z-50 animate-fadeIn">
                <div className="px-4 py-2 border-b border-[#E5E1D8] dark:border-[#1F2838]">
                  <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] truncate">{currentUser.email}</p>
                </div>

                <div className="px-4 py-2 text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                  Autenticação individual protegida por senha e verificação facial.
                </div>

                <div className="px-2 pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition font-medium cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Encerrar Sessão</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Share / Preview Link Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E14]/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-[#E5E1D8] dark:border-[#1F2838] overflow-hidden">
            <div className="p-6 border-b border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#181F2D] text-[#1B365D] dark:text-[#D4AF63]">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                    Link de Acesso &amp; Preview do Sistema
                  </h3>
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    Compartilhe com os membros da comissão para acesso autenticado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-2 rounded-xl text-[#5A616E] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] leading-relaxed">
                Cada membro entra com usuário, senha e verificação facial obrigatória antes de visualizar as pautas e votar nas comissões Diretiva e de Nomeações.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1.5">
                  Link Direto (Preview / Votação)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={previewUrl}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs font-mono-tabular text-[#14181F] dark:text-[#F1EFEA] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14]'
                    }`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-[#5A616E] dark:text-[#949BA8] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Reconhecimento facial ativo
                </span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1B365D] dark:text-[#D4AF63] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Abrir em Nova Aba</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
