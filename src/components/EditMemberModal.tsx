import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { useChurch } from '../store/churchStore';
import { isSystemAdmin, isVotingMember } from '../utils/roles';
import { MemberAvatar } from './MemberAvatar';
import {
  X,
  Save,
  Trash2,
  UserCheck,
  AlertTriangle,
  Fingerprint,
  Smartphone,
  Phone,
  Mail,
  User as UserIcon,
  Tag,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
  ScanFace,
  ShieldAlert,
  Lock
} from 'lucide-react';

interface Props {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

function generateStrongTempPassword(): string {
  const prefixes = ['Iasd', 'Conselho', 'Voto', 'Comissao', 'Plenario'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}#${num}`;
}

export const EditMemberModal: React.FC<Props> = ({ user, isOpen, onClose }) => {
  const { updateUser, deleteUser, currentUser } = useChurch();
  const canManageUsers = isSystemAdmin(currentUser);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [accountActive, setAccountActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<UserRole>('membro');
  const [isAdminFlag, setIsAdminFlag] = useState(false);
  const [ministry, setMinistry] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [presenceStatus, setPresenceStatus] = useState<'presente' | 'ausente' | 'remoto'>('presente');
  const [biometricRegistered, setBiometricRegistered] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedCredentials, setSavedCredentials] = useState<{
    name: string;
    username: string;
    tempPassword: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setUsername(user.username || user.email.split('@')[0]);
      setNewPassword('');
      setShowPassword(false);
      setMustChangePassword(user.mustChangePassword ?? !user.passwordConfigured);
      setAccountActive(user.accountActive !== false);
      setCopied(false);
      setRole(user.role);
      setIsAdminFlag(Boolean(user.isAdmin || user.role === 'administrador'));
      setMinistry(user.ministry || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
      setPresenceStatus(user.presenceStatus);
      setBiometricRegistered(user.biometricRegistered);
      setTwoFactorEnabled(user.twoFactorEnabled);
      setConfirmDelete(false);
      setErrorMsg(null);
      setSavedCredentials(null);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const isEditingSelf = user.id === currentUser?.id;

  const handleGeneratePassword = () => {
    setNewPassword(generateStrongTempPassword());
    setShowPassword(true);
    setMustChangePassword(true);
  };

  const copySavedCredentials = () => {
    if (!savedCredentials) return;
    const text = `Credenciais de Acesso — IASD Comissões\nMembro: ${savedCredentials.name}\nUsuário: ${savedCredentials.username}\nSenha Provisória: ${savedCredentials.tempPassword}\n(A senha provisória deverá ser alterada no próximo acesso.)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) return;
    setErrorMsg(null);

    if (!name.trim() || !email.trim()) {
      setErrorMsg('Informe o nome completo e o e-mail oficial.');
      return;
    }

    const trimmedNewPass = newPassword.trim();
    if (trimmedNewPass.length > 0) {
      if (trimmedNewPass.length < 8 || !/[a-zA-Z]/.test(trimmedNewPass) || !/[0-9]/.test(trimmedNewPass)) {
        setErrorMsg('A nova senha deve ter no mínimo 8 caracteres, com letras e números.');
        return;
      }
    }

    setIsSaving(true);
    const resolvedIsAdmin = isEditingSelf ? true : role === 'administrador' ? true : isAdminFlag;
    const res = await updateUser(user.id, {
      name: name.trim(),
      email: email.trim(),
      username: username.trim() || user.username,
      ...(trimmedNewPass ? { newPassword: trimmedNewPass } : {}),
      mustChangePassword: trimmedNewPass ? mustChangePassword : user.mustChangePassword,
      accountActive: isEditingSelf ? true : accountActive,
      role,
      isAdmin: resolvedIsAdmin,
      ministry: ministry.trim() || 'Comissão Administrativa',
      phone: phone.trim() || undefined,
      avatarUrl: avatarUrl.trim(),
      presenceStatus: isVotingMember({ role }) ? presenceStatus : 'ausente',
      biometricRegistered,
      twoFactorEnabled
    });
    setIsSaving(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Não foi possível salvar as alterações.');
      return;
    }

    if (trimmedNewPass) {
      setSavedCredentials({
        name: name.trim(),
        username: username.trim() || user.username,
        tempPassword: trimmedNewPass
      });
      setNewPassword('');
    } else {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!canManageUsers || isEditingSelf) {
      return;
    }
    setIsSaving(true);
    const res = await deleteUser(user.id);
    setIsSaving(false);
    if (!res.success) {
      setErrorMsg(res.message || 'Erro ao excluir usuário.');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E14]/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-[#E5E1D8] dark:border-[#1F2838] overflow-hidden">
        <div className="p-6 border-b border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MemberAvatar name={user.name} src={user.facialSnapshotDataUrl || user.avatarUrl} size="lg" />
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Editar Cadastro de Usuário
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF63]" />
                <span>Dados cadastrais, função e redefinição segura de senha</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#5A616E] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canManageUsers ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Acesso exclusivo do Administrador</p>
                <p className="mt-1 opacity-90">
                  Somente o usuário Administrador do sistema possui permissão para alterar cadastros, definir senhas ou remover membros.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1B365D] text-white text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : savedCredentials ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-semibold text-sm">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Alterações salvas e nova senha aplicada</span>
              </div>
              <p className="text-xs text-emerald-900/90 dark:text-emerald-100/80 leading-relaxed">
                Por segurança, a senha nunca fica armazenada em texto legível. Copie estas credenciais agora para repassar ao membro:
              </p>
              <div className="p-3 rounded-xl bg-white dark:bg-[#0B0E14] border border-emerald-200 dark:border-emerald-800/60 font-mono-tabular text-xs space-y-1 text-[#14181F] dark:text-[#F1EFEA]">
                <p>Membro: {savedCredentials.name}</p>
                <p>Usuário: @{savedCredentials.username}</p>
                <p>Senha Provisória: {savedCredentials.tempPassword}</p>
              </div>
              <button
                type="button"
                onClick={copySavedCredentials}
                className="w-full py-2.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#121722] text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Credenciais Copiadas!' : 'Copiar Credenciais (Exibição Única)'}</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold cursor-pointer"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-[#5A616E]" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#5A616E]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1B365D] dark:text-[#D4AF63] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>Credenciais &amp; Segurança da Senha</span>
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white dark:bg-[#121722] border border-[#E5E1D8] dark:border-[#1F2838] text-[#5A616E] dark:text-[#949BA8]">
                  {user.passwordConfigured ? 'Hash criptográfico ativo' : 'Aguardando senha inicial'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                      {user.passwordConfigured ? 'Redefinir Senha (opcional)' : 'Definir Senha Inicial'}
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[10px] text-[#1B365D] dark:text-[#D4AF63] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Gerar Forte</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={user.passwordConfigured ? 'Manter senha atual' : 'Mín. 8 chars (letra + número)'}
                      className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-[#5A616E]"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {newPassword.trim().length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="rounded text-[#1B365D] w-4 h-4"
                  />
                  <span className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    Exigir que o membro altere esta senha provisória no próximo login
                  </span>
                </label>
              )}

              {user.id !== currentUser?.id && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={accountActive}
                    onChange={(e) => setAccountActive(e.target.checked)}
                    className="rounded text-[#1B365D] w-4 h-4"
                  />
                  <span className="text-xs font-medium text-[#14181F] dark:text-[#F1EFEA]">
                    Conta Ativa (Habilitada para Login)
                  </span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Função na Comissão
                </label>
                <select
                  value={role === 'conselheiro' ? 'membro' : role}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole;
                    setRole(nextRole);
                    if (nextRole === 'administrador') setIsAdminFlag(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                >
                  <option value="presidente">Presidente</option>
                  <option value="secretario">Secretário</option>
                  <option value="tesoureiro">Tesoureiro</option>
                  <option value="membro">Membro da Comissão</option>
                  <option value="administrador">Somente Administrador (sem voto)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Presença na Sessão
                </label>
                <select
                  value={isVotingMember({ role }) ? presenceStatus : 'ausente'}
                  disabled={!isVotingMember({ role })}
                  onChange={(e) => setPresenceStatus(e.target.value as 'presente' | 'ausente' | 'remoto')}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA] disabled:opacity-60"
                >
                  <option value="presente">Presente (Votante)</option>
                  <option value="ausente">Ausente</option>
                  <option value="remoto">Telepresencial / Remoto</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838]">
              <label className={`flex items-start gap-2.5 ${isEditingSelf ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  disabled={isEditingSelf || role === 'administrador'}
                  checked={isEditingSelf || role === 'administrador' ? true : isAdminFlag}
                  onChange={(e) => setIsAdminFlag(e.target.checked)}
                  className="mt-0.5 rounded text-[#1B365D] w-4 h-4"
                />
                <div className="text-xs">
                  <span className="font-semibold text-[#14181F] dark:text-[#F1EFEA] block">
                    Privilégio de Administrador do Sistema
                  </span>
                  <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                    {isEditingSelf
                      ? 'Você mantém o acesso administrativo ativo e pode exercer qualquer função na comissão.'
                      : 'Permite cadastrar usuários, excluir propostas e gerenciar atas não assinadas por terceiros.'}
                  </span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Ministério / Representação
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 w-4 h-4 text-[#5A616E]" />
                  <input
                    type="text"
                    value={ministry}
                    onChange={(e) => setMinistry(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-[#5A616E]" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 98765-4321"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Foto Personalizada (Opcional — deixe vazio para usar captura facial ou monograma)
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Deixe vazio para foto facial ou monograma"
                className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs text-[#14181F] dark:text-[#F1EFEA]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] block">
                Segurança &amp; Reconhecimento Facial
              </span>

              <div className="text-xs flex flex-wrap items-center gap-2">
                <span className="text-[#5A616E] dark:text-[#949BA8]">Autorização facial do Presidente:</span>
                <span
                  className={`font-semibold ${
                    user.role === 'presidente' || user.facialAuthorizationStatus === 'autorizada'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : user.facialAuthorizationStatus === 'pendente_autorizacao'
                      ? 'text-amber-700 dark:text-amber-400'
                      : user.facialAuthorizationStatus === 'recusada'
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-[#5A616E] dark:text-[#949BA8]'
                  }`}
                >
                  {user.role === 'presidente' || user.facialAuthorizationStatus === 'autorizada'
                    ? 'Autorizada'
                    : user.facialAuthorizationStatus === 'pendente_autorizacao'
                    ? 'Aguardando Presidente'
                    : user.facialAuthorizationStatus === 'recusada'
                    ? 'Nova captura solicitada'
                    : 'Não cadastrada'}
                </span>
              </div>

              {user.facialVerifiedAt && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <ScanFace className="w-4 h-4" />
                  <span>Última captura facial: {new Date(user.facialVerifiedAt).toLocaleString('pt-BR')}</span>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={biometricRegistered}
                  onChange={(e) => setBiometricRegistered(e.target.checked)}
                  className="rounded text-[#1B365D] w-4 h-4"
                />
                <div className="flex items-center gap-1.5 text-xs text-[#14181F] dark:text-[#F1EFEA] font-medium">
                  <Fingerprint className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF63]" />
                  <span>Reconhecimento Facial Obrigatório no Acesso</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  className="rounded text-[#1B365D] w-4 h-4"
                />
                <div className="flex items-center gap-1.5 text-xs text-[#14181F] dark:text-[#F1EFEA] font-medium">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Auditoria Dupla Ativa</span>
                </div>
              </label>
            </div>

            {!isEditingSelf && (
              <div className="pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838]">
                {confirmDelete ? (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
                    <p className="text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Confirmar exclusão de {user.name}?</span>
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1 rounded-lg text-xs text-[#5A616E]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSaving}
                        className="px-3 py-1 rounded-lg bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Excluir Usuário
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-rose-600 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover este usuário do sistema</span>
                  </button>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-[#5A616E] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
