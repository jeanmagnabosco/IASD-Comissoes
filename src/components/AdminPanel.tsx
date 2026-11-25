import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { User, UserRole } from '../types';
import { EditMemberModal } from './EditMemberModal';
import { EditSessionModal } from './EditSessionModal';
import { MemberAvatar } from './MemberAvatar';
import { formatUserRoleSummary, getRoleLabel, isSystemAdmin, isVotingMember } from '../utils/roles';
import {
  ShieldCheck,
  Calendar,
  MessageSquare,
  PlusCircle,
  CheckCircle2,
  Send,
  KeyRound,
  Download,
  BarChart3,
  Edit3,
  Church,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
  RotateCcw,
  ScanFace,
  AlertTriangle,
  Clock,
  ShieldAlert,
  UserCheck,
  XCircle,
  Lock
} from 'lucide-react';
import { createGoogleCalendarEvent, generateDirectGoogleCalendarUrl } from '../services/calendarService';

export const AdminPanel: React.FC = () => {
  const {
    currentUser,
    users,
    pautas,
    elections,
    auditLogs,
    currentSession,
    setCommissionType,
    resetAllVotesAndTestData,
    authorizeMemberFace,
    rejectMemberFace,
    revokeMemberFace,
    toggleUserPresence,
    addNewUser,
    slackWebhookUrl,
    setSlackWebhookUrl,
    notifySlack,
    churchSettings,
    updateChurchSettings
  } = useChurch();

  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'faces' | 'users' | 'settings' | 'integrations' | 'audit'>(
    'metrics'
  );
  const [facialActionMsg, setFacialActionMsg] = useState<string | null>(null);

  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);

  // Reset votes confirmation state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetDoneMsg, setResetDoneMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

  // Church Settings Form state
  const [churchNameInput, setChurchNameInput] = useState(
    churchSettings?.churchName || 'Igreja Cristã Evangélica Central'
  );
  const [churchAddressInput, setChurchAddressInput] = useState(
    churchSettings?.churchAddress || 'Av. das Nações, 1500 - Plenário'
  );
  const [districtInput, setDistrictInput] = useState(
    churchSettings?.districtConference || 'Associação Central das Igrejas'
  );
  const [quorumPctInput, setQuorumPctInput] = useState(churchSettings?.quorumPercentage || 50);
  const [prefixInput, setPrefixInput] = useState(churchSettings?.resolutionPrefix || 'Voto nº');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // New User Form State (Admin-only)
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(true);
  const [newUserMustChangePassword, setNewUserMustChangePassword] = useState(true);
  const [newUserRole, setNewUserRole] = useState<UserRole>('membro');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserMinistry, setNewUserMinistry] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    tempPassword: string;
  } | null>(null);
  const [copiedCreatedCreds, setCopiedCreatedCreds] = useState(false);

  // Slack & Calendar
  const [inputSlackUrl, setInputSlackUrl] = useState(slackWebhookUrl);
  const [slackTestStatus, setSlackTestStatus] = useState<string | null>(null);
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<string | null>(null);

  const canManageUsers = isSystemAdmin(currentUser);
  const isPresident = currentUser?.role === 'presidente';

  const generateNewUserPassword = () => {
    const prefixes = ['Iasd', 'Voto', 'Conselho', 'Comissao', 'Plenario'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const n = Math.floor(1000 + Math.random() * 9000);
    setNewUserPassword(`${p}#${n}`);
    setShowNewUserPassword(true);
  };

  const copyCreatedCredentials = () => {
    if (!createdCredentials) return;
    const text = `Credenciais de Acesso — IASD Comissões\nMembro: ${createdCredentials.name}\nUsuário/Login: ${createdCredentials.username}\nSenha Provisória: ${createdCredentials.tempPassword}\n(Altere a senha no primeiro acesso.)`;
    navigator.clipboard.writeText(text);
    setCopiedCreatedCreds(true);
    setTimeout(() => setCopiedCreatedCreds(false), 3000);
  };

  const commissionMembers = users.filter(u => isVotingMember(u));

  const pendingFacialUsers = commissionMembers.filter(
    u => u.role !== 'presidente' && !u.isAdmin && u.facialAuthorizationStatus === 'pendente_autorizacao'
  );
  const authorizedFacialUsers = commissionMembers.filter(
    u => u.role === 'presidente' || u.isAdmin || u.facialAuthorizationStatus === 'autorizada'
  );
  const unregisteredFacialUsers = commissionMembers.filter(
    u =>
      u.role !== 'presidente' &&
      !u.isAdmin &&
      u.facialAuthorizationStatus !== 'pendente_autorizacao' &&
      u.facialAuthorizationStatus !== 'autorizada'
  );

  const presentCount = commissionMembers.filter(u => u.presenceStatus === 'presente').length;
  const totalEligible = commissionMembers.length;
  const quorumPercentage = totalEligible > 0 ? (presentCount / totalEligible) * 100 : 0;

  const totalVotedPautas = pautas.filter(p => p.status === 'aprovado' || p.status === 'rejeitado').length;
  const approvedPautas = pautas.filter(p => p.status === 'aprovado').length;
  const approvalRate = totalVotedPautas > 0 ? (approvedPautas / totalVotedPautas) * 100 : 0;

  const facialVerifiedUsersCount = authorizedFacialUsers.length;
  const concludedElectionsCount = elections.filter(e => e.status === 'concluido').length;

  const handleSaveChurchSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateChurchSettings({
      churchName: churchNameInput.trim(),
      churchAddress: churchAddressInput.trim(),
      districtConference: districtInput.trim(),
      quorumPercentage: Number(quorumPctInput),
      resolutionPrefix: prefixInput.trim()
    });
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3000);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) return;
    setUserFormError(null);

    if (!newUserName.trim() || !newUserEmail.trim()) {
      setUserFormError('Informe o nome completo e o e-mail oficial.');
      return;
    }

    const username =
      newUserUsername.trim() || newUserEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const password = newUserPassword.trim();

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setUserFormError('A senha provisória deve ter no mínimo 8 caracteres, com letras e números.');
      return;
    }

    setIsCreatingUser(true);
    const res = await addNewUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      username,
      password,
      accountActive: true,
      mustChangePassword: newUserMustChangePassword,
      role: newUserRole,
      isAdmin: newUserIsAdmin || newUserRole === 'administrador',
      ministry: newUserMinistry.trim() || 'Comissão Administrativa',
      presenceStatus: isVotingMember({ role: newUserRole }) ? 'presente' : 'ausente'
    });
    setIsCreatingUser(false);

    if (!res.success) {
      setUserFormError(res.message || 'Não foi possível cadastrar o usuário.');
      return;
    }

    setCreatedCredentials({
      name: newUserName.trim(),
      username: res.user?.username || username,
      tempPassword: password
    });
    setCopiedCreatedCreds(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserMinistry('');
    setNewUserIsAdmin(false);
    setIsAddingUser(false);
  };

  const handleResetAllVotes = async () => {
    setResetErrorMsg(null);
    const res = await resetAllVotesAndTestData();
    setConfirmResetOpen(false);
    if (!res.success) {
      setResetErrorMsg(res.message || 'Não foi possível zerar as votações.');
      return;
    }
    setResetDoneMsg('Todas as votações, apurações e atas sem assinatura externa foram zeradas com sucesso.');
    setTimeout(() => setResetDoneMsg(null), 5000);
  };

  const handleSaveSlack = () => {
    setSlackWebhookUrl(inputSlackUrl.trim());
    setSlackTestStatus('Webhook do Slack atualizado.');
    setTimeout(() => setSlackTestStatus(null), 3000);
  };

  const handleTestSlack = async () => {
    setSlackTestStatus('Enviando mensagem de teste...');
    await notifySlack('Teste de conexão do Painel Administrativo IASD Comissões.');
    setSlackTestStatus('Notificação enviada.');
    setTimeout(() => setSlackTestStatus(null), 4000);
  };

  const handleSyncSessionToGoogleCalendar = async () => {
    const ok = window.confirm(`Deseja sincronizar a reunião "${currentSession.titulo}" no Google Calendar?`);
    if (!ok) return;

    setCalendarSyncStatus('Sincronizando reunião com o Google Calendar...');
    const result = await createGoogleCalendarEvent({
      summary: `[Igreja] ${currentSession.titulo}`,
      description: `Reunião da Comissão.\nPresidente: ${currentSession.presidenteNome}\nSecretaria: ${currentSession.secretarioNome}`,
      location: currentSession.local,
      startDateTime: currentSession.dataHora,
      endDateTime: new Date(new Date(currentSession.dataHora).getTime() + 2 * 60 * 60 * 1000).toISOString()
    });

    if (result.success) {
      setCalendarSyncStatus('Reunião sincronizada no Google Calendar.');
    } else {
      const fallbackUrl = generateDirectGoogleCalendarUrl({
        summary: `[Igreja] ${currentSession.titulo}`,
        description: `Reunião da Comissão.\nPresidente: ${currentSession.presidenteNome}`,
        location: currentSession.local,
        startDateTime: currentSession.dataHora,
        endDateTime: new Date(new Date(currentSession.dataHora).getTime() + 2 * 60 * 60 * 1000).toISOString()
      });
      window.open(fallbackUrl, '_blank');
      setCalendarSyncStatus('Reunião aberta para inclusão no Google Calendar.');
    }
  };

  const exportAuditLogsCSV = () => {
    const headers = ['Timestamp', 'Usuario', 'Acao', 'Detalhes', 'Hash_SHA256'];
    const rows = auditLogs.map(l => [
      `"${new Date(l.timestamp).toLocaleString('pt-BR')}"`,
      `"${l.userName}"`,
      `"${l.action}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.encryptedHash}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63]">
            Administração &amp; Segurança
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight mt-0.5">
            Painel de Controle
          </h1>
          <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">
            Gestão de membros, credenciais, biometria facial, quórum e reinício de votações.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#F7F6F2] dark:bg-[#0B0E14] p-1 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-xs font-semibold overflow-x-auto">
          {[
            { id: 'metrics', label: 'Resumo' },
            {
              id: 'faces',
              label:
                pendingFacialUsers.length > 0
                  ? `Autorização Facial (${pendingFacialUsers.length})`
                  : 'Autorização Facial'
            },
            { id: 'users', label: 'Membros & Acessos' },
            { id: 'settings', label: 'Comissão & Ata' },
            { id: 'integrations', label: 'Integrações' },
            { id: 'audit', label: 'Auditoria' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14]'
                  : tab.id === 'faces' && pendingFacialUsers.length > 0
                  ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  : 'text-[#5A616E] dark:text-[#949BA8] hover:text-[#14181F] dark:hover:text-[#F1EFEA]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {pendingFacialUsers.length > 0 && activeSubTab !== 'faces' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                {pendingFacialUsers.length}{' '}
                {pendingFacialUsers.length === 1
                  ? 'membro aguarda autorização facial do Presidente'
                  : 'membros aguardam autorização facial do Presidente'}
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                {pendingFacialUsers.map(u => u.name).join(', ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab('faces')}
            className="px-4 py-2 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold shrink-0 cursor-pointer"
          >
            Revisar e Autorizar Faces
          </button>
        </div>
      )}

      {resetDoneMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{resetDoneMsg}</span>
        </div>
      )}

      {resetErrorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{resetErrorMsg}</span>
          </div>
          <button type="button" onClick={() => setResetErrorMsg(null)} className="text-[11px] underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {facialActionMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{facialActionMsg}</span>
        </div>
      )}

      {/* TAB 1: METRICS */}
      {activeSubTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#121722] p-5 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] block mb-1">
                Quórum Presente
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-[#14181F] dark:text-[#F1EFEA]">
                  {presentCount} / {totalEligible}
                </span>
                <span className="font-mono-tabular text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {quorumPercentage.toFixed(0)}%
                </span>
              </div>
              <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] mt-2">
                Maioria simples: {Math.floor(presentCount / 2) + 1} votos
              </p>
            </div>

            <div className="bg-white dark:bg-[#121722] p-5 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] block mb-1">
                Pautas Deliberadas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-[#14181F] dark:text-[#F1EFEA]">
                  {totalVotedPautas} / {pautas.length}
                </span>
                <span className="font-mono-tabular text-xs font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                  {totalVotedPautas > 0 ? `${approvalRate.toFixed(0)}% aprov.` : 'Zerado'}
                </span>
              </div>
              <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] mt-2">
                Ordem do dia da Comissão Diretiva
              </p>
            </div>

            <div className="bg-white dark:bg-[#121722] p-5 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] block mb-1">
                Nomeações Concluídas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-[#14181F] dark:text-[#F1EFEA]">
                  {concludedElectionsCount} / {elections.length}
                </span>
                <span className="text-xs font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
                  50% + 1
                </span>
              </div>
              <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] mt-2">
                Cargos na Comissão de Nomeações
              </p>
            </div>

            <div className="bg-white dark:bg-[#121722] p-5 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] block mb-1">
                Faces Autorizadas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono-tabular text-2xl font-bold text-[#14181F] dark:text-[#F1EFEA]">
                  {facialVerifiedUsersCount} / {commissionMembers.length}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <ScanFace className="w-3.5 h-3.5" /> {pendingFacialUsers.length > 0 ? `${pendingFacialUsers.length} pendente` : 'Presidente'}
                </span>
              </div>
              <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] mt-2">
                Membros liberados pelo Presidente
              </p>
            </div>
          </div>

          {/* Session Overview & Reset Votes Card */}
          <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#1B365D] dark:text-[#D4AF63]" />
                  <span>Controle da Sessão &amp; Reinício de Votações</span>
                </h3>
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-0.5">
                  Zere todas as votações de pautas e eleições para iniciar uma nova comissão do zero.
                </p>
              </div>

              {canManageUsers ? (
                !confirmResetOpen ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(true)}
                    className="px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Zerar Todas as Votações</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-xs font-medium text-rose-800 dark:text-rose-200">Confirmar reinício?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmResetOpen(false)}
                      className="px-2 py-1 text-xs text-[#5A616E] hover:underline"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAllVotes}
                      className="px-3 py-1 rounded-lg bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Zerar Agora
                    </button>
                  </div>
                )
              ) : (
                <span className="text-[11px] font-medium text-[#5A616E] dark:text-[#949BA8] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Reinício e exclusão restritos ao Administrador
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: FACIAL AUTHORIZATION BY PRESIDENT */}
      {activeSubTab === 'faces' && (
        <div className="space-y-6">
          <div className="bg-[#0B0E14] text-[#F1EFEA] p-6 rounded-2xl border border-[#D4AF63]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF63] flex items-center gap-1.5">
                <ScanFace className="w-3.5 h-3.5" /> Autorização Biométrica Prévia
              </span>
              <h3 className="font-display text-xl font-semibold text-white">
                Liberação Facial pelo Presidente da Comissão
              </h3>
              <p className="text-xs text-[#949BA8]">
                {isPresident
                  ? 'Como Presidente, aprove cada face capturada antes que o membro possa entrar normalmente pelo reconhecimento facial.'
                  : 'Somente o Presidente da Comissão tem permissão para autorizar, recusar ou revogar faces.'}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-xs font-mono-tabular">
              <div className="text-center">
                <span className="text-lg font-bold text-amber-400 block">{pendingFacialUsers.length}</span>
                <span className="text-[#949BA8] text-[10px] uppercase">Pendentes</span>
              </div>
              <div className="text-center">
                <span className="text-lg font-bold text-emerald-400 block">{authorizedFacialUsers.length}</span>
                <span className="text-[#949BA8] text-[10px] uppercase">Autorizadas</span>
              </div>
            </div>
          </div>

          {!isPresident && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Visualização somente leitura: apenas o usuário com perfil <strong>Presidente</strong> pode aprovar ou revogar faces.
              </span>
            </div>
          )}

          {/* Pending Approvals */}
          <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
            <h4 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span>Aguardando Autorização do Presidente ({pendingFacialUsers.length})</span>
            </h4>

            {pendingFacialUsers.length === 0 ? (
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] py-4 italic">
                Nenhuma solicitação facial pendente no momento. Quando um membro cadastrar a face na tela de login, ela aparecerá aqui para sua aprovação.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingFacialUsers.map(u => (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-[#F7F6F2] dark:bg-[#0B0E14] space-y-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <MemberAvatar
                        name={u.name}
                        src={u.facialSnapshotDataUrl || u.avatarUrl}
                        size="xl"
                        className="ring-2 ring-amber-400/60"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-sm text-[#14181F] dark:text-[#F1EFEA] truncate">
                          {u.name}
                        </p>
                        <p className="text-xs text-[#5A616E] dark:text-[#949BA8] truncate">
                          @{u.username} · {getRoleLabel(u.role)}
                        </p>
                        <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                          {u.ministry || 'Comissão'}
                        </p>
                        {u.facialVerifiedAt && (
                          <p className="text-[11px] font-mono-tabular text-amber-700 dark:text-amber-400">
                            Capturada em {new Date(u.facialVerifiedAt).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    {isPresident && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await authorizeMemberFace(u.id);
                            setFacialActionMsg(`Face de ${u.name} autorizada. O membro já pode entrar normalmente.`);
                            setTimeout(() => setFacialActionMsg(null), 4000);
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Autorizar Face</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await rejectMemberFace(u.id, 'Solicitada nova captura facial com melhor iluminação.');
                            setFacialActionMsg(`Nova captura facial solicitada para ${u.name}.`);
                            setTimeout(() => setFacialActionMsg(null), 4000);
                          }}
                          className="py-2 px-3 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Recusar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Authorized & Unregistered Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-3">
              <h4 className="font-display text-base font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Faces Autorizadas ({authorizedFacialUsers.length})</span>
              </h4>
              <div className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838]">
                {authorizedFacialUsers.map(u => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MemberAvatar name={u.name} src={u.facialSnapshotDataUrl || u.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate">{u.name}</p>
                        <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] truncate">
                          {getRoleLabel(u.role)} · Autorizada {u.facialAuthorizedAt ? `em ${new Date(u.facialAuthorizedAt).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                      </div>
                    </div>
                    {isPresident && u.role !== 'presidente' && (
                      <button
                        type="button"
                        onClick={() => revokeMemberFace(u.id)}
                        className="px-2.5 py-1 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] text-[11px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium shrink-0 cursor-pointer"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-3">
              <h4 className="font-display text-base font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-[#9A7B3E] dark:text-[#D4AF63]" />
                <span>Sem Face Cadastrada / Nova Foto ({unregisteredFacialUsers.length})</span>
              </h4>
              {unregisteredFacialUsers.length === 0 ? (
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8] py-3 italic">
                  Todos os membros já enviaram ou tiveram suas faces autorizadas.
                </p>
              ) : (
                <div className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838]">
                  {unregisteredFacialUsers.map(u => (
                    <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MemberAvatar name={u.name} src={u.facialSnapshotDataUrl || u.avatarUrl} size="md" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate">{u.name}</p>
                          <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] truncate">
                            @{u.username} · {u.facialAuthorizationStatus === 'recusada' ? 'Nova foto solicitada' : 'Aguardando primeira captura'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Usuários e Membros da Comissão ({users.length})
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                {canManageUsers
                  ? 'Como Administrador, cadastre novos usuários, defina senhas iniciais e gerencie acessos.'
                  : 'Visualização de leitura. Somente o Administrador do sistema pode cadastrar ou alterar usuários.'}
              </p>
            </div>
            {canManageUsers && (
              <button
                type="button"
                onClick={() => {
                  const opening = !isAddingUser;
                  setIsAddingUser(opening);
                  setUserFormError(null);
                  if (opening && !newUserPassword) {
                    generateNewUserPassword();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cadastrar Novo Usuário</span>
              </button>
            )}
          </div>

          {!canManageUsers && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Acesso restrito: <strong>somente o Administrador</strong> tem permissão para cadastrar novos usuários, alterar dados ou redefinir senhas.
              </span>
            </div>
          )}

          {canManageUsers && createdCredentials && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Usuário {createdCredentials.name} cadastrado com sucesso (exibição única da senha)</span>
                </p>
                <p className="font-mono-tabular text-xs text-emerald-800 dark:text-emerald-300">
                  Login: <b>@{createdCredentials.username}</b> · Senha Provisória: <b>{createdCredentials.tempPassword}</b>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyCreatedCredentials}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#121722] border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCreatedCreds ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCreatedCreds ? 'Copiado!' : 'Copiar Credenciais'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedCredentials(null)}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-[#5A616E] hover:bg-white/60 cursor-pointer"
                >
                  Ocultar
                </button>
              </div>
            </div>
          )}

          {canManageUsers && isAddingUser && (
            <form
              onSubmit={handleAddUserSubmit}
              className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#1B365D]/30 dark:border-[#D4AF63]/30 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1B365D] dark:text-[#D4AF63] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>Cadastrar Novo Usuário &amp; Credenciais Seguras</span>
                </h4>
              </div>

              {userFormError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{userFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pr. Silas Ribeiro"
                    value={newUserName}
                    onChange={(e) => {
                      setNewUserName(e.target.value);
                      if (!newUserUsername) {
                        setNewUserUsername(
                          e.target.value.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')
                        );
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    E-mail Oficial
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="silas@igreja.org"
                    value={newUserEmail}
                    onChange={(e) => {
                      setNewUserEmail(e.target.value);
                      if (!newUserUsername && e.target.value.includes('@')) {
                        setNewUserUsername(e.target.value.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Nome de Usuário (Login)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="usuario.membro"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                      Senha Provisória (mín. 8 chars)
                    </label>
                    <button
                      type="button"
                      onClick={generateNewUserPassword}
                      className="text-[10px] text-[#1B365D] dark:text-[#D4AF63] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Gerar Forte</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewUserPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Ex: Iasd#4821"
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute right-2.5 top-2 text-[#5A616E]"
                    >
                      {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Função na Comissão
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => {
                      const next = e.target.value as UserRole;
                      setNewUserRole(next);
                      if (next === 'administrador') setNewUserIsAdmin(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs text-[#14181F] dark:text-[#F1EFEA]"
                  >
                    <option value="presidente">Presidente</option>
                    <option value="secretario">Secretário</option>
                    <option value="tesoureiro">Tesoureiro</option>
                    <option value="membro">Membro da Comissão</option>
                    <option value="administrador">Somente Administrador (sem voto)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Ministério / Departamento
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Louvor, Família, Diaconia..."
                    value={newUserMinistry}
                    onChange={(e) => setNewUserMinistry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserIsAdmin || newUserRole === 'administrador'}
                    disabled={newUserRole === 'administrador'}
                    onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                    className="rounded text-[#1B365D] w-4 h-4"
                  />
                  <span className="text-xs font-medium text-[#14181F] dark:text-[#F1EFEA]">
                    Conceder privilégio de Administrador do Sistema (além da função na comissão)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserMustChangePassword}
                    onChange={(e) => setNewUserMustChangePassword(e.target.checked)}
                    className="rounded text-[#1B365D] w-4 h-4"
                  />
                  <span className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    Exigir que o usuário crie sua própria senha pessoal no primeiro login
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#5A616E]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-1.5 rounded-lg bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isCreatingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-[#121722] rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] overflow-hidden">
            <div className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838]">
              {users.map(u => {
                const isAdminAccount = isSystemAdmin(u);
                const canVote = isVotingMember(u);
                return (
                  <div
                    key={u.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F6F2]/70 dark:hover:bg-[#0B0E14]/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={u.name} src={u.facialSnapshotDataUrl || u.avatarUrl} size="lg" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-[#14181F] dark:text-[#F1EFEA]">{u.name}</p>
                          <span className="font-mono-tabular text-[11px] text-[#1B365D] dark:text-[#D4AF63]">
                            @{u.username}
                          </span>
                          {!u.passwordConfigured ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              <KeyRound className="w-3 h-3" /> Aguardando senha inicial
                            </span>
                          ) : u.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              <Lock className="w-3 h-3" /> Troca pendente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              <Lock className="w-3 h-3" /> Senha ativa
                            </span>
                          )}
                          {!isAdminAccount && (
                            u.role === 'presidente' || u.facialAuthorizationStatus === 'autorizada' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                <ScanFace className="w-3 h-3" /> Face Autorizada
                              </span>
                            ) : u.facialAuthorizationStatus === 'pendente_autorizacao' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                <Clock className="w-3 h-3" /> Aguardando Presidente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#5A616E] dark:text-[#949BA8]">
                                <ScanFace className="w-3 h-3" /> Face Pendente
                              </span>
                            )
                          )}
                        </div>
                        <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-0.5">
                          {u.email} · <span className="font-medium text-[#14181F] dark:text-[#F1EFEA]">{formatUserRoleSummary(u)}</span> ({u.ministry || 'Comissão'})
                          {u.accountActive === false && (
                            <span className="ml-2 text-rose-600 font-semibold">· Conta Desativada</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {isPresident && !isAdminAccount && u.facialAuthorizationStatus === 'pendente_autorizacao' && (
                        <button
                          type="button"
                          onClick={() => authorizeMemberFace(u.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Autorizar Face</span>
                        </button>
                      )}

                      {canManageUsers && (
                        <button
                          type="button"
                          onClick={() => setUserToEdit(u)}
                          title="Alterar usuário, função e senha"
                          className="px-2.5 py-1.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-[#1B365D] dark:text-[#D4AF63] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{u.passwordConfigured ? 'Editar' : 'Definir Senha'}</span>
                        </button>
                      )}

                      {canVote && (
                        canManageUsers ? (
                          <button
                            type="button"
                            onClick={() => toggleUserPresence(u.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                              u.presenceStatus === 'presente'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-[#F7F6F2] text-[#5A616E] border-[#E5E1D8] dark:bg-[#0B0E14] dark:text-[#949BA8] dark:border-[#1F2838]'
                            }`}
                          >
                            {u.presenceStatus === 'presente' ? 'Presente (Votante)' : 'Ausente'}
                          </button>
                        ) : (
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-semibold border ${
                              u.presenceStatus === 'presente'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-[#F7F6F2] text-[#5A616E] border-[#E5E1D8] dark:bg-[#0B0E14] dark:text-[#949BA8] dark:border-[#1F2838]'
                            }`}
                          >
                            {u.presenceStatus === 'presente' ? 'Presente (Votante)' : 'Ausente'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-[#0B0E14] text-[#F1EFEA] p-6 rounded-2xl border border-[#D4AF63]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF63]">
                Sessão Vigente · {currentSession.numeroAta}
              </span>
              <h3 className="font-display text-xl font-semibold text-white">
                Modo de Funcionamento &amp; Dados da Ata
              </h3>
              <p className="text-xs text-[#949BA8]">
                Alterne entre Comissão Diretiva e Comissão de Nomeações ou edite local, data e mesa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCommissionType('diretiva')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  currentSession.commissionType !== 'nomeacoes'
                    ? 'bg-[#D4AF63] text-[#0B0E14] border-[#D4AF63]'
                    : 'border-white/15 text-white hover:bg-white/10'
                }`}
              >
                Comissão Diretiva
              </button>
              <button
                type="button"
                onClick={() => setCommissionType('nomeacoes')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  currentSession.commissionType === 'nomeacoes'
                    ? 'bg-[#D4AF63] text-[#0B0E14] border-[#D4AF63]'
                    : 'border-white/15 text-white hover:bg-white/10'
                }`}
              >
                Comissão de Nomeações
              </button>
              <button
                type="button"
                onClick={() => setIsEditSessionOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Ata &amp; Reunião</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSaveChurchSettings}
            className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
                  <Church className="w-5 h-5 text-[#1B365D] dark:text-[#D4AF63]" />
                  <span>Parâmetros Institucionais</span>
                </h3>
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                  Dados utilizados no cabeçalho oficial da Ata Canônica
                </p>
              </div>

              {settingsSavedMsg && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Salvo!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Nome Oficial da Igreja
                </label>
                <input
                  type="text"
                  required
                  value={churchNameInput}
                  onChange={(e) => setChurchNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Associação / Campo
                </label>
                <input
                  type="text"
                  value={districtInput}
                  onChange={(e) => setDistrictInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Endereço Sede
              </label>
              <input
                type="text"
                value={churchAddressInput}
                onChange={(e) => setChurchAddressInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Maioria para Deliberação (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={quorumPctInput}
                  onChange={(e) => setQuorumPctInput(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Prefixo de Voto / Resolução
                </label>
                <input
                  type="text"
                  value={prefixInput}
                  onChange={(e) => setPrefixInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Parâmetros</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: INTEGRATIONS */}
      {activeSubTab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F7F6F2] dark:bg-[#181F2D] text-[#1B365D] dark:text-[#D4AF63] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#14181F] dark:text-[#F1EFEA]">Google Calendar</h3>
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">Sincronização de reuniões da comissão</p>
              </div>
            </div>

            {calendarSyncStatus && (
              <div className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs border border-[#E5E1D8] dark:border-[#1F2838]">
                {calendarSyncStatus}
              </div>
            )}

            <button
              type="button"
              onClick={handleSyncSessionToGoogleCalendar}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Sincronizar Sessão Atual</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F7F6F2] dark:bg-[#181F2D] text-[#9A7B3E] dark:text-[#D4AF63] flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#14181F] dark:text-[#F1EFEA]">Slack Webhook</h3>
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">Avisos de votação e encerramento</p>
              </div>
            </div>

            <div>
              <input
                type="url"
                value={inputSlackUrl}
                onChange={(e) => setInputSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs text-[#14181F] dark:text-[#F1EFEA]"
              />
            </div>

            {slackTestStatus && (
              <div className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs border border-[#E5E1D8] dark:border-[#1F2838]">
                {slackTestStatus}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveSlack}
                className="flex-1 py-2 px-3 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-xs font-semibold cursor-pointer"
              >
                Salvar Webhook
              </button>
              <button
                type="button"
                onClick={handleTestSlack}
                className="flex-1 py-2 px-3 rounded-xl bg-[#9A7B3E] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Testar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Trilha de Auditoria (SHA-256)</span>
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Registros imutáveis de entradas, verificações faciais e votações desta sessão.
              </p>
            </div>

            <button
              type="button"
              onClick={exportAuditLogsCSV}
              className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>

          <div className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838] max-h-96 overflow-y-auto text-xs">
            {auditLogs.length === 0 ? (
              <p className="py-8 text-center text-[#5A616E] italic">
                Nenhum registro nesta sessão ainda.
              </p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                      <span>{log.action}</span>
                      <span className="text-[11px] text-[#5A616E] font-normal">por {log.userName}</span>
                    </div>
                    <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-0.5">{log.details}</p>
                  </div>
                  <div className="text-right shrink-0 font-mono-tabular">
                    <p className="text-[10px] text-[#5A616E]">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      {log.encryptedHash.substring(0, 16)}...
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {userToEdit && <EditMemberModal user={userToEdit} isOpen={Boolean(userToEdit)} onClose={() => setUserToEdit(null)} />}
      {isEditSessionOpen && <EditSessionModal isOpen={isEditSessionOpen} onClose={() => setIsEditSessionOpen(false)} />}
    </div>
  );
};
