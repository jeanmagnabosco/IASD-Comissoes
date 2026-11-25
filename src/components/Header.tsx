import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { MemberAvatar } from './MemberAvatar';
import { formatUserRoleSummary, isVotingMember } from '../utils/roles';
import {
  ShieldCheck,
  Moon,
  Sun,
  Bell,
  BellRing,
  LogOut,
  ChevronDown,
  Share2,
  ExternalLink,
  Copy,
  Check,
  X,
  Menu,
  Users,
  Vote,
  Award,
  FileText,
  History,
  Settings,
  ScanFace
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onOpenMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenMobileSidebar }) => {
  const {
    currentUser,
    users,
    isOnline,
    darkMode,
    setDarkMode,
    notificationsEnabled,
    requestNotificationPermission,
    logout,
    currentSession
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

  const tabTitles: Record<string, { label: string; icon: React.ElementType; kicker: string }> = {
    membro: { label: 'Área do Membro', icon: Users, kicker: 'Portal Dedicado da Comissão' },
    pautas: { label: 'Comissão Diretiva', icon: Vote, kicker: 'Ordem do Dia & Deliberações' },
    eleicoes: { label: 'Comissão de Nomeações', icon: Award, kicker: 'Indicações & Eleições Ministeriais' },
    ata: { label: 'Ata Canônica', icon: FileText, kicker: 'Registro Eclesiástico Oficial' },
    historico: { label: 'Histórico & Acervo', icon: History, kicker: 'Atas e Resoluções Arquivadas' },
    admin: { label: 'Painel de Controle', icon: Settings, kicker: 'Gestão da Comissão & Credenciais' }
  };

  const currentTabInfo = tabTitles[activeTab] || tabTitles.membro;
  const CurrentIcon = currentTabInfo.icon;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#121722]/95 backdrop-blur-md border-b border-[#E5E1D8] dark:border-[#1F2838] transition-colors">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Mobile Toggle + Section Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-2 rounded-xl text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-[#F7F6F2] dark:bg-[#181F2D] border border-[#E5E1D8] dark:border-[#1F2838] text-[#1B365D] dark:text-[#D4AF63] items-center justify-center">
                <CurrentIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-lg sm:text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA] leading-tight">
                    {currentTabInfo.label}
                  </h1>
                  <span className="font-mono-tabular text-[11px] text-[#9A7B3E] dark:text-[#D4AF63] hidden md:inline">
                    · {currentSession.numeroAta}
                  </span>
                </div>
                <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] hidden sm:block">
                  {currentTabInfo.kicker}
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#5A616E] dark:text-[#949BA8]">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-[#9A7B3E]'}`} />
                <span className="font-medium text-[#14181F] dark:text-[#F1EFEA]">
                  {isOnline ? 'Conectado' : 'Offline'}
                </span>
              </span>
              <span className="opacity-35">·</span>
              <span className="font-mono-tabular">
                Quórum: <strong className="text-[#14181F] dark:text-[#F1EFEA]">{presentCount}/{totalVotingMembers}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="px-2.5 py-1.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF63]" />
              <span className="hidden md:inline">Link de Votação</span>
            </button>

            <button
              type="button"
              onClick={requestNotificationPermission}
              title={notificationsEnabled ? 'Notificações ativas' : 'Ativar notificações'}
              className="p-2 rounded-xl text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
            >
              {notificationsEnabled ? <BellRing className="w-4 h-4 text-[#D4AF63]" /> : <Bell className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Tema Claro' : 'Tema Escuro'}
              className="p-2 rounded-xl text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#D4AF63]" /> : <Moon className="w-4 h-4" />}
            </button>

            {currentUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] hover:bg-[#F7F6F2] dark:hover:bg-[#181F2D] transition cursor-pointer"
                >
                  <MemberAvatar
                    name={currentUser.name}
                    src={currentUser.facialSnapshotDataUrl || currentUser.avatarUrl}
                    size="sm"
                  />
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] leading-tight">
                      {currentUser.name.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-[#5A616E] dark:text-[#949BA8] leading-none">
                      {formatUserRoleSummary(currentUser)}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#5A616E]" />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-[#E5E1D8] dark:border-[#1F2838] py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-2.5 border-b border-[#E5E1D8] dark:border-[#1F2838]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate">
                          {currentUser.name}
                        </p>
                        <span className="font-mono-tabular text-[10px] text-[#1B365D] dark:text-[#D4AF63] font-semibold">
                          @{currentUser.username}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] truncate">{currentUser.email}</p>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        <ScanFace className="w-3 h-3" />
                        <span>Sessão Verificada · {formatUserRoleSummary(currentUser)}</span>
                      </div>
                    </div>

                    <div className="px-3 py-2 text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                      Para acessar com outra conta, encerre a sessão atual e autentique com senha e reconhecimento facial.
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
          </div>
        </div>
      </div>

      {/* Share Modal */}
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
                    Link de Acesso &amp; Preview
                  </h3>
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    Envie aos membros para login e verificação facial
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
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1.5">
                  URL Direta do Sistema
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
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Votação sigilosa ativa
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
    </header>
  );
};
