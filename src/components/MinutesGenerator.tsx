import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { EditSessionModal } from './EditSessionModal';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import {
  canSignAta,
  formatUserRoleSummary,
  getRoleLabel,
  isSystemAdmin,
  isVotingMember
} from '../utils/roles';
import {
  Printer,
  Copy,
  Check,
  ShieldCheck,
  FileSpreadsheet,
  Award,
  Settings,
  PenTool,
  Trash2,
  Lock,
  UserPlus,
  UserCheck,
  AlertTriangle
} from 'lucide-react';

export const MinutesGenerator: React.FC = () => {
  const {
    currentUser,
    currentSession,
    pautas,
    elections,
    users,
    churchSettings,
    approveAndArchiveCurrentAta,
    signCurrentAta,
    toggleDesignatedSigner,
    deleteCurrentAta
  } = useChurch();

  const [copied, setCopied] = useState(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [archivedMsg, setArchivedMsg] = useState<string | null>(null);
  const [signatureMsg, setSignatureMsg] = useState<string | null>(null);
  const [confirmDeleteAta, setConfirmDeleteAta] = useState(false);
  const [deleteAtaError, setDeleteAtaError] = useState<string | null>(null);
  const [deleteAtaSuccess, setDeleteAtaSuccess] = useState<string | null>(null);

  const presentUsers = users.filter(
    u => isVotingMember(u) && (u.presenceStatus === 'presente' || currentSession.presentesIds.includes(u.id))
  );
  const votedPautas = pautas.filter(p => p.status === 'aprovado' || p.status === 'rejeitado');
  const concludedElections = elections.filter(e => e.status === 'concluido');

  const sessionSignatures = currentSession.signatures || [];
  const otherMemberSigners = sessionSignatures.filter(s => s.signerId !== currentUser?.id);
  const hasOtherMemberSignature = otherMemberSigners.length > 0;
  const userCanSign = canSignAta(currentUser, currentSession);
  const currentUserSignature = sessionSignatures.find(s => s.signerId === currentUser?.id);

  const canManageAta = isSystemAdmin(currentUser) || currentUser?.role === 'presidente' || currentUser?.role === 'secretario';
  const canDeleteAta = isSystemAdmin(currentUser);

  const designatableMembers = users.filter(
    u =>
      u.accountActive !== false &&
      u.role !== 'presidente' &&
      u.role !== 'secretario' &&
      u.id !== currentSession.presidenteId &&
      u.id !== currentSession.secretarioId
  );

  const defaultCargoForSigner =
    currentUser?.role === 'secretario' || currentUser?.id === currentSession.secretarioId
      ? 'Secretário(a) da Comissão'
      : currentUser?.role === 'presidente' || currentUser?.id === currentSession.presidenteId
      ? 'Presidente da Comissão'
      : `Membro Designado (${getRoleLabel(currentUser?.role || 'membro')})`;

  const presidenteSignature = sessionSignatures.find(
    s => s.signerId === currentSession.presidenteId || s.role === 'presidente'
  );
  const secretarioSignature = sessionSignatures.find(
    s => s.signerId === currentSession.secretarioId || s.role === 'secretario'
  );
  const extraSignatures = sessionSignatures.filter(
    s => s.id !== presidenteSignature?.id && s.id !== secretarioSignature?.id
  );

  const handleApproveAndArchive = async () => {
    setIsApproving(true);
    try {
      const rec = await approveAndArchiveCurrentAta();
      setArchivedMsg(`Ata ${rec.numeroAta} aprovada e arquivada para leitura oficial dos membros.`);
      setTimeout(() => setArchivedMsg(null), 5000);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSignCurrentAta = async (dataUrl: string, cargoLabel?: string) => {
    const res = await signCurrentAta(dataUrl, cargoLabel);
    if (res.success) {
      setSignatureMsg('Assinatura digital registrada com sucesso e incorporada à ata.');
      setTimeout(() => setSignatureMsg(null), 4500);
    }
    return res;
  };

  const handleDeleteCurrentAta = async () => {
    setDeleteAtaError(null);
    const res = await deleteCurrentAta();
    setConfirmDeleteAta(false);
    if (!res.success) {
      setDeleteAtaError(res.message || 'Não foi possível excluir a ata.');
      return;
    }
    setDeleteAtaSuccess('Ata reiniciada/excluída pelo Administrador com sucesso.');
    setTimeout(() => setDeleteAtaSuccess(null), 5000);
  };

  const handleCopyText = () => {
    const fullText = document.getElementById('ata-content-printable')?.innerText || '';
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Numero_Voto',
      'Titulo',
      'Categoria',
      'Relator',
      'Resultado',
      'Favor',
      'Contra',
      'Abstencao',
      'Percentual_Favor',
      'Data_Resolucao'
    ];
    const rows = votedPautas.map(p => [
      `"${p.numeroResolucao || '-'}"`,
      `"${p.titulo.replace(/"/g, '""')}"`,
      `"${p.categoria}"`,
      `"${p.relator}"`,
      `"${p.resultadoFinal?.aprovado ? 'APROVADO' : 'REJEITADO'}"`,
      p.resultadoFinal?.favor || 0,
      p.resultadoFinal?.contra || 0,
      p.resultadoFinal?.abstencao || 0,
      `"${p.resultadoFinal?.percentualFavor || 0}%"`,
      `"${p.resultadoFinal?.dataResolucao ? new Date(p.resultadoFinal.dataResolucao).toLocaleDateString('pt-BR') : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Ata_${currentSession.numeroAta.replace(/\s+/g, '_')}_Resolucoes.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] print:hidden">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63]">
            Registro Oficial · Secretaria Geral
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight mt-0.5">
            Ata Canônica da Comissão
          </h1>
          <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">
            Consolidação automática de votos apurados, eleições ministeriais e assinaturas digitais em tela.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isApproving}
            onClick={handleApproveAndArchive}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{currentSession.ataAprovada ? 'Ata Aprovada & Arquivada' : 'Aprovar & Arquivar Ata'}</span>
          </button>

          {canManageAta && (
            <button
              type="button"
              onClick={() => setIsEditSessionOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Editar Dados da Ata</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyText}
            className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>

          {canDeleteAta && (
            hasOtherMemberSignature ? (
              <span
                title={`Exclusão bloqueada: assinada digitalmente por ${otherMemberSigners.map(s => s.nome).join(', ')}`}
                className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#5A616E] dark:text-[#949BA8] text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Ata Protegida (Assinada)</span>
              </span>
            ) : confirmDeleteAta ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAta(false)}
                  className="px-2 py-0.5 text-[#5A616E] hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCurrentAta}
                  className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-semibold cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAta(true)}
                className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Ata</span>
              </button>
            )
          )}
        </div>
      </div>

      {archivedMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn print:hidden">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{archivedMsg}</span>
        </div>
      )}

      {signatureMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn print:hidden">
          <PenTool className="w-4 h-4 text-emerald-600" />
          <span>{signatureMsg}</span>
        </div>
      )}

      {deleteAtaSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 print:hidden">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{deleteAtaSuccess}</span>
        </div>
      )}

      {deleteAtaError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{deleteAtaError}</span>
          </div>
          <button type="button" onClick={() => setDeleteAtaError(null)} className="text-[11px] underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {hasOtherMemberSignature && canDeleteAta && (
        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 print:hidden">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Exclusão bloqueada:</strong> esta ata já recebeu assinatura digital de outro membro da comissão (
            {otherMemberSigners.map(s => s.nome).join(', ')}).
          </span>
        </div>
      )}

      {currentSession.ataAprovada && !archivedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Ata Oficial Aprovada</strong> — Disponível para leitura no Portal dos Membros.
            </span>
          </div>
          <span className="font-mono-tabular text-[10px]">SHA-256 Validado</span>
        </div>
      )}

      {/* Designação de Assinantes & Espaço para Assinatura Digital em Tela */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Designated Signers Management */}
        <div className="lg:col-span-5 bg-white dark:bg-[#121722] rounded-2xl p-6 border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
          <div className="border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63] block">
              Autorização de Assinatura
            </span>
            <h2 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2 mt-0.5">
              <UserPlus className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF63]" />
              <span>Secretaria &amp; Pessoas Designadas</span>
            </h2>
            <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">
              O(a) Secretário(a) e o Presidente assinam por ofício. Designe outros membros da comissão caso necessário.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#14181F] dark:text-[#F1EFEA]">{currentSession.secretarioNome}</p>
                <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">Secretário(a) · Assinante Nato</p>
              </div>
              {secretarioSignature ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Assinado
                </span>
              ) : (
                <span className="text-[11px] text-[#9A7B3E] dark:text-[#D4AF63]">Pendente</span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#14181F] dark:text-[#F1EFEA]">{currentSession.presidenteNome}</p>
                <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">Presidente · Assinante Nato</p>
              </div>
              {presidenteSignature ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Assinado
                </span>
              ) : (
                <span className="text-[11px] text-[#9A7B3E] dark:text-[#D4AF63]">Pendente</span>
              )}
            </div>
          </div>

          {canManageAta && (
            <div className="pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838] space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8]">
                Designar outro membro para assinar a ata:
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {designatableMembers.map(m => {
                  const isDesignated = Boolean(currentSession.designatedSignersIds?.includes(m.id));
                  const memberSigned = sessionSignatures.some(s => s.signerId === m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#14181F] dark:text-[#F1EFEA] truncate">{m.name}</p>
                        <p className="text-[10px] text-[#5A616E] dark:text-[#949BA8] truncate">
                          {formatUserRoleSummary(m)} {memberSigned ? '· Já assinou em tela' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDesignatedSigner(m.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition shrink-0 cursor-pointer ${
                          isDesignated
                            ? 'bg-[#1B365D] text-white border-[#1B365D] dark:bg-[#D4AF63] dark:text-[#0B0E14] dark:border-[#D4AF63]'
                            : 'border-[#E5E1D8] dark:border-[#1F2838] text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F7F6F2] dark:hover:bg-[#181F2D]'
                        }`}
                      >
                        {isDesignated ? 'Designado(a)' : 'Designar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Interactive On-Screen Digital Signature Pad */}
        <div className="lg:col-span-7 bg-white dark:bg-[#121722] rounded-2xl p-6 border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
          <div className="border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63] block">
              Assinatura Eletrônica Manuscrita
            </span>
            <h2 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2 mt-0.5">
              <PenTool className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF63]" />
              <span>Assinar Ata Digitalmente na Tela</span>
            </h2>
          </div>

          {userCanSign && currentUser ? (
            <DigitalSignaturePad
              signerName={currentUser.name}
              signerRoleLabel={defaultCargoForSigner}
              existingSignatureUrl={currentUserSignature?.signatureDataUrl}
              onConfirm={handleSignCurrentAta}
            />
          ) : (
            <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-xs text-[#5A616E] dark:text-[#949BA8] space-y-2">
              <p className="font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#9A7B3E]" />
                <span>Espaço reservado ao(à) Secretário(a), Presidente ou pessoa designada</span>
              </p>
              <p>
                Seu usuário ({currentUser?.name}) ainda não foi designado para assinar esta ata. Caso deva assinar como representante designado(a), solicite ao Presidente, Secretário(a) ou Administrador a designação no quadro ao lado.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Printable Canonical Minutes */}
      <div
        id="ata-content-printable"
        className="bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] rounded-2xl p-8 sm:p-12 border border-[#E5E1D8] dark:border-[#1F2838] shadow-sm max-w-4xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0 print:text-black"
      >
        <div className="text-center border-b-2 border-[#1B365D] dark:border-[#D4AF63] pb-6 print:border-black">
          <p className="text-xs uppercase tracking-[0.25em] font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
            {churchSettings?.churchName || 'Igreja Adventista do Sétimo Dia Central'} · Secretaria Geral
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mt-1 uppercase tracking-tight">
            {currentSession.numeroAta}
          </h2>
          <p className="font-display italic text-sm text-[#5A616E] dark:text-[#949BA8] mt-1">
            {currentSession.titulo}
          </p>
        </div>

        <div className="text-justify leading-relaxed text-sm space-y-3">
          <p>
            Aos <b>{new Date(currentSession.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</b>, às{' '}
            <b>{new Date(currentSession.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b>, reuniram-se em{' '}
            <b>{currentSession.local}</b> os membros da{' '}
            <b>{currentSession.commissionType === 'nomeacoes' ? 'Comissão de Nomeações' : 'Comissão Diretiva'}</b>, sob a presidência de{' '}
            <b>{currentSession.presidenteNome}</b> e secretariada por <b>{currentSession.secretarioNome}</b>.
          </p>

          <p>
            <b>QUÓRUM DE INSTALAÇÃO:</b> Constatada a presença de <b>{presentUsers.length} membros</b> (
            {presentUsers.map(u => `${u.name} — ${formatUserRoleSummary(u)}`).join('; ')}), com maioria simples estabelecida em{' '}
            {Math.floor(presentUsers.length / 2) + 1} votos, declararam-se abertos os trabalhos.
          </p>
        </div>

        <div className="space-y-5 pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] print:border-slate-300">
          <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-[#5A616E] dark:text-[#949BA8] text-center">
            Deliberações Plenárias &amp; Votos Apurados
          </h3>

          {votedPautas.length === 0 ? (
            <p className="text-center text-xs italic text-[#5A616E] dark:text-[#949BA8] py-4">
              Nenhuma pauta concluída até o momento nesta sessão.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              {votedPautas.map((pauta) => (
                <div
                  key={pauta.id}
                  className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] print:bg-transparent print:border-slate-300 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-1.5">
                    <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63] text-xs">
                      {pauta.numeroResolucao || 'Voto Numerado'} · {pauta.categoria}
                    </span>
                    <span
                      className={`text-[11px] font-semibold uppercase ${
                        pauta.resultadoFinal?.aprovado
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {pauta.resultadoFinal?.aprovado ? 'APROVADO (50%+1)' : 'REJEITADO'}
                    </span>
                  </div>

                  <p className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                    {pauta.titulo}
                  </p>

                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8] text-justify">
                    <b>Proposta Deliberada:</b> {pauta.propostaTexto}
                  </p>

                  {pauta.resultadoFinal && (
                    <div className="pt-1.5 text-xs text-[#14181F] dark:text-[#F1EFEA] flex items-center justify-between">
                      <span className="font-mono-tabular">
                        <b>Resultado:</b> {pauta.resultadoFinal.favor} a favor ({pauta.resultadoFinal.percentualFavor}%),{' '}
                        {pauta.resultadoFinal.contra} contra, {pauta.resultadoFinal.abstencao} abstenções.
                      </span>
                      <span className="text-[10px] text-[#5A616E] font-mono-tabular">
                        {new Date(pauta.resultadoFinal.dataResolucao).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {concludedElections.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] text-sm">
            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-[#5A616E] dark:text-[#949BA8] text-center">
              Comissão de Nomeações — Lideranças Eleitas
            </h3>

            {concludedElections.map((el) => (
              <div
                key={el.id}
                className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#9A7B3E]/35 dark:border-[#D4AF63]/35 print:bg-transparent print:border-slate-300 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#9A7B3E] dark:text-[#D4AF63]" />
                  <span className="font-semibold">{el.ministryName}</span>
                </div>
                <p className="text-xs text-justify text-[#5A616E] dark:text-[#949BA8]">
                  Submetida ao escrutínio secreto da comissão, foi eleito(a) como titular para <b>{el.ministryName}</b>{' '}
                  o(a) irmão(ã) <b className="text-[#14181F] dark:text-[#F1EFEA]">{el.electedLeaderName}</b> ({el.round}º turno).
                  {el.assignedMembers && el.assignedMembers.length > 0 && (
                    <span> Equipe integrada: {el.assignedMembers.join(', ')}.</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] text-sm text-justify leading-relaxed">
          <p>
            {currentSession.customClosingNotes ||
              'Nada mais havendo a tratar, o Presidente encerrou os trabalhos com oração. Eu, Secretário(a) da Comissão, lavrei a presente ata que vai assinada digitalmente na tela pela mesa diretora e/ou membro designado.'}
          </p>
        </div>

        {/* Rendered Digital Signatures */}
        <div className="pt-8 border-t-2 border-[#1B365D] dark:border-[#D4AF63] print:border-black space-y-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8]">
              Assinaturas Digitais Autenticadas ({sessionSignatures.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-2">
            {/* Presidente Block */}
            <div className="text-center space-y-1.5">
              <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2]/50 dark:bg-[#0B0E14]/50 print:bg-white">
                {presidenteSignature ? (
                  <img
                    src={presidenteSignature.signatureDataUrl}
                    alt={`Assinatura digital de ${presidenteSignature.nome}`}
                    className="max-h-20 object-contain"
                  />
                ) : (
                  <span className="text-[11px] italic text-[#5A616E] dark:text-[#949BA8]">
                    Aguardando assinatura digital em tela
                  </span>
                )}
              </div>
              <div className="border-t border-[#E5E1D8] dark:border-[#1F2838] pt-1.5 font-display text-base font-semibold">
                {presidenteSignature?.nome || currentSession.presidenteNome}
              </div>
              <p className="text-xs text-[#5A616E] uppercase tracking-wider">
                {presidenteSignature?.cargo || 'Presidente'}
              </p>
              {presidenteSignature && (
                <p className="text-[10px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                  Assinado em {new Date(presidenteSignature.signedAt).toLocaleString('pt-BR')} · {presidenteSignature.hash.slice(0, 18)}
                </p>
              )}
            </div>

            {/* Secretário(a) Block */}
            <div className="text-center space-y-1.5">
              <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2]/50 dark:bg-[#0B0E14]/50 print:bg-white">
                {secretarioSignature ? (
                  <img
                    src={secretarioSignature.signatureDataUrl}
                    alt={`Assinatura digital de ${secretarioSignature.nome}`}
                    className="max-h-20 object-contain"
                  />
                ) : (
                  <span className="text-[11px] italic text-[#5A616E] dark:text-[#949BA8]">
                    Aguardando assinatura digital em tela
                  </span>
                )}
              </div>
              <div className="border-t border-[#E5E1D8] dark:border-[#1F2838] pt-1.5 font-display text-base font-semibold">
                {secretarioSignature?.nome || currentSession.secretarioNome}
              </div>
              <p className="text-xs text-[#5A616E] uppercase tracking-wider">
                {secretarioSignature?.cargo || 'Secretário(a)'}
              </p>
              {secretarioSignature && (
                <p className="text-[10px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                  Assinado em {new Date(secretarioSignature.signedAt).toLocaleString('pt-BR')} · {secretarioSignature.hash.slice(0, 18)}
                </p>
              )}
            </div>
          </div>

          {/* Extra Designated Member Signatures */}
          {extraSignatures.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838]">
              {extraSignatures.map(sig => (
                <div key={sig.id} className="text-center space-y-1.5">
                  <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2]/50 dark:bg-[#0B0E14]/50 print:bg-white">
                    <img
                      src={sig.signatureDataUrl}
                      alt={`Assinatura digital de ${sig.nome}`}
                      className="max-h-20 object-contain"
                    />
                  </div>
                  <div className="border-t border-[#E5E1D8] dark:border-[#1F2838] pt-1.5 font-display text-base font-semibold">
                    {sig.nome}
                  </div>
                  <p className="text-xs text-[#5A616E] uppercase tracking-wider">{sig.cargo}</p>
                  <p className="text-[10px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                    Assinado em {new Date(sig.signedAt).toLocaleString('pt-BR')} · {sig.hash.slice(0, 18)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isEditSessionOpen && <EditSessionModal isOpen={isEditSessionOpen} onClose={() => setIsEditSessionOpen(false)} />}
    </div>
  );
};
