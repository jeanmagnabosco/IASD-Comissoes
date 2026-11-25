import React, { useState, useEffect } from 'react';
import { useChurch } from '../store/churchStore';
import { PautaItem, PautaStatus } from '../types';
import { MediaAttachmentModal } from './MediaAttachmentModal';
import { EditPautaModal } from './EditPautaModal';
import { EditSessionModal } from './EditSessionModal';
import { createGoogleCalendarEvent, generateDirectGoogleCalendarUrl } from '../services/calendarService';
import { parseResolutionNumber, formatResolutionNumber } from '../utils/resolutionNumbering';
import { getRoleLabel, isSystemAdmin, isVotingMember } from '../utils/roles';
import {
  PlusCircle,
  Edit3,
  Play,
  Paperclip,
  MessageSquare,
  Calendar,
  Download,
  ExternalLink,
  Settings,
  Layers,
  Check,
  Sparkles,
  Hash,
  X,
  Users,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Lock,
  EyeOff,
  StopCircle,
  CheckCircle2,
  XCircle,
  Minus,
  Trash2
} from 'lucide-react';

export const MeetingManager: React.FC = () => {
  const {
    currentUser,
    users,
    pautas,
    currentSession,
    addPauta,
    updatePautaStatus,
    addPautaObservation,
    updatePautaProposta,
    startPautaVoting,
    castPautaVote,
    closePautaVoting,
    deletePauta,
    addAttachmentToPauta,
    setFirstPautaResolutionNumber,
    toggleSharePautaWithMembers
  } = useChurch();

  const [isCreatingPauta, setIsCreatingPauta] = useState(false);
  const [editingPautaId, setEditingPautaId] = useState<string | null>(null);
  const [editedProposta, setEditedProposta] = useState('');

  // Full-screen Individual Pauta Presentation mode
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);

  // Full edit modal state
  const [pautaToEdit, setPautaToEdit] = useState<PautaItem | null>(null);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);

  // Sequential renumbering dialog state
  const [isRenumberDialogOpen, setIsRenumberDialogOpen] = useState(false);
  const [renumberStartPattern, setRenumberStartPattern] = useState('Voto nº 01/2026');
  const [renumberSuccessMsg, setRenumberSuccessMsg] = useState<string | null>(null);

  // Observation input state
  const [activeObsPautaId, setActiveObsPautaId] = useState<string | null>(null);
  const [newObsComment, setNewObsComment] = useState('');
  const [newObsSuggestion, setNewObsSuggestion] = useState('');

  // Attachment modal state
  const [attachmentTarget, setAttachmentTarget] = useState<{ id: string; titulo: string } | null>(null);

  // Google Calendar sync feedback
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<string | null>(null);
  const [calendarSyncLink, setCalendarSyncLink] = useState<string | null>(null);

  // New Pauta Form State
  const [newTitulo, setNewTitulo] = useState('');
  const [newCategoria, setNewCategoria] = useState<PautaItem['categoria']>('Administrativo');
  const [newRelator, setNewRelator] = useState(currentUser?.name || 'Presidente');
  const [newJustificativa, setNewJustificativa] = useState('');
  const [newProposta, setNewProposta] = useState('');

  const [confirmDeletePautaId, setConfirmDeletePautaId] = useState<string | null>(null);
  const [deletePautaError, setDeletePautaError] = useState<string | null>(null);

  const isAdminOrPresident =
    currentUser?.role === 'presidente' || currentUser?.role === 'secretario' || isSystemAdmin(currentUser);
  const canDeletePauta = isSystemAdmin(currentUser);
  const presentVoters = users.filter(
    u => u.presenceStatus === 'presente' && isVotingMember(u)
  );

  // Keyboard navigation in Full-Screen Presentation mode
  useEffect(() => {
    if (!isPresentationMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPresentationMode(false);
      } else if (e.key === 'ArrowRight') {
        setPresentationIndex(i => Math.min(i + 1, Math.max(pautas.length - 1, 0)));
      } else if (e.key === 'ArrowLeft') {
        setPresentationIndex(i => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresentationMode, pautas.length]);

  const openPresentationAt = (idx: number) => {
    setPresentationIndex(idx);
    setIsPresentationMode(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitulo.trim() || !newProposta.trim()) return;

    await addPauta({
      titulo: newTitulo.trim(),
      categoria: newCategoria,
      relator: newRelator.trim(),
      justificativa: newJustificativa.trim(),
      propostaTexto: newProposta.trim(),
      textoOriginal: newProposta.trim(),
      quorumRequerido: Math.floor(presentVoters.length / 2) + 1 || 4
    });

    setNewTitulo('');
    setNewJustificativa('');
    setNewProposta('');
    setIsCreatingPauta(false);
  };

  const handleAddObservation = async (pautaId: string) => {
    if (!newObsComment.trim()) return;
    await addPautaObservation(pautaId, newObsComment.trim(), newObsSuggestion.trim() || undefined);
    setNewObsComment('');
    setNewObsSuggestion('');
    setActiveObsPautaId(null);
  };

  const handleSaveEditedProposta = async (pautaId: string) => {
    if (!editedProposta.trim()) return;
    await updatePautaProposta(pautaId, editedProposta.trim());
    setEditingPautaId(null);
  };

  const handleSyncToGoogleCalendar = async (pauta: PautaItem) => {
    const confirmSync = window.confirm(
      `Deseja sincronizar a pauta "${pauta.titulo}" na sua agenda do Google Calendar como compromisso oficial da comissão?`
    );
    if (!confirmSync) return;

    setCalendarSyncStatus('Sincronizando evento no Google Calendar...');
    const result = await createGoogleCalendarEvent({
      summary: `[Comissão] ${pauta.titulo}`,
      description: `Pauta da Comissão Diretiva: ${pauta.categoria}\n\nProposta: ${pauta.propostaTexto}\n\nRelator: ${pauta.relator}`,
      location: currentSession.local,
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });

    if (result.success) {
      setCalendarSyncStatus('Evento sincronizado com sucesso na sua Conta Google.');
      setCalendarSyncLink(result.htmlLink || null);
    } else {
      const directUrl = generateDirectGoogleCalendarUrl({
        summary: `[Comissão Diretiva] ${pauta.titulo}`,
        description: `Pauta da Comissão: ${pauta.titulo}\n\nProposta: ${pauta.propostaTexto}`,
        location: currentSession.local,
        startDateTime: new Date().toISOString(),
        endDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
      setCalendarSyncStatus('Abra pelo link direto do Google Calendar para salvar:');
      setCalendarSyncLink(directUrl);
    }
  };

  const getStatusLabel = (status: PautaStatus) => {
    switch (status) {
      case 'pautado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#5A616E] dark:text-[#949BA8]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#949BA8]" />
            <span>Pautado</span>
          </span>
        );
      case 'em_leitura':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A7B3E] dark:text-[#D4AF63]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF63]" />
            <span>Em Leitura</span>
          </span>
        );
      case 'em_edicao':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B365D] dark:text-[#D4AF63]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B365D]" />
            <span>Redação Ajustada</span>
          </span>
        );
      case 'votacao_aberta':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
            <span className="w-2 h-2 rounded-full bg-[#D4AF63] animate-pulse" />
            <span>Votação Secreta Aberta</span>
          </span>
        );
      case 'aprovado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Aprovado</span>
          </span>
        );
      case 'rejeitado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Rejeitado</span>
          </span>
        );
      default:
        return null;
    }
  };

  const presentedPauta = pautas[presentationIndex] || null;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E5E1D8] dark:border-[#1F2838]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63]">
            Comissão Diretiva · Ordem do Dia
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight mt-0.5">
            Pautas e Deliberações
          </h1>
          <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1 font-mono-tabular">
            {currentSession.numeroAta} · {currentSession.local} · {pautas.length} matéria(s) pautada(s)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pautas.length > 0 && (
            <button
              type="button"
              onClick={() => openPresentationAt(0)}
              className="px-3.5 py-2 rounded-xl border border-[#9A7B3E]/50 dark:border-[#D4AF63]/50 bg-[#F7F6F2] dark:bg-[#121722] text-[#14181F] dark:text-[#D4AF63] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#9A7B3E] dark:text-[#D4AF63]" />
              <span>Apresentar Pauta (Tela Cheia)</span>
            </button>
          )}

          {isAdminOrPresident && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (pautas.length > 0 && pautas[0].numeroResolucao) {
                    setRenumberStartPattern(pautas[0].numeroResolucao);
                  }
                  setIsRenumberDialogOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF63]" />
                <span>Renumerar Votos</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditSessionOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#5A616E]" />
                <span>Dados da Reunião</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreatingPauta(!isCreatingPauta)}
                className="px-4 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:hover:bg-[#c39d52] text-white dark:text-[#0B0E14] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Pautar Novo Assunto</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Renumber Success Toast */}
      {renumberSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{renumberSuccessMsg}</span>
          </div>
          <button type="button" onClick={() => setRenumberSuccessMsg(null)} className="text-xs px-2 hover:underline">
            Fechar
          </button>
        </div>
      )}

      {deletePautaError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
          <span>{deletePautaError}</span>
          <button type="button" onClick={() => setDeletePautaError(null)} className="text-xs underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Calendar Sync Status Toast */}
      {calendarSyncStatus && (
        <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#121722] border border-[#E5E1D8] dark:border-[#1F2838] text-xs text-[#14181F] dark:text-[#F1EFEA] flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF63] shrink-0" />
            <span>{calendarSyncStatus}</span>
          </div>
          <div className="flex items-center gap-2">
            {calendarSyncLink && (
              <a
                href={calendarSyncLink}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] rounded-lg font-medium flex items-center gap-1 text-[11px]"
              >
                <span>Abrir Google Calendar</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button type="button" onClick={() => setCalendarSyncStatus(null)} className="text-xs px-2 hover:underline">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Form: Pautar Novo Assunto */}
      {isCreatingPauta && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#1B365D]/30 dark:border-[#D4AF63]/30 shadow-lg space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
            <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF63]" />
              <span>Pautar Assunto para Deliberação</span>
            </h3>
            <span className="text-xs text-[#5A616E] dark:text-[#949BA8]">Anexo máximo: 50MB</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Título do Assunto
              </label>
              <input
                type="text"
                required
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                placeholder="Ex: Orçamento de Missões e Evangelismo Trimestral"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Categoria
              </label>
              <select
                value={newCategoria}
                onChange={(e) => setNewCategoria(e.target.value as PautaItem['categoria'])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none"
              >
                <option value="Administrativo">Administrativo</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Patrimônio">Patrimônio</option>
                <option value="Eclesiástico">Eclesiástico</option>
                <option value="Disciplinar">Disciplinar</option>
                <option value="Evangelismo">Evangelismo</option>
                <option value="Ministérios">Ministérios</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Relator da Matéria
              </label>
              <input
                type="text"
                required
                value={newRelator}
                onChange={(e) => setNewRelator(e.target.value)}
                placeholder="Nome do relator ou comissão"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Justificativa
              </label>
              <input
                type="text"
                value={newJustificativa}
                onChange={(e) => setNewJustificativa(e.target.value)}
                placeholder="Fundamentação para apreciação da comissão..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
              Redação da Proposta de Voto
            </label>
            <textarea
              required
              rows={3}
              value={newProposta}
              onChange={(e) => setNewProposta(e.target.value)}
              placeholder="Redação oficial do voto a ser submetido..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingPauta(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:text-[#0B0E14] text-white text-xs font-semibold transition cursor-pointer"
            >
              Incluir na Ordem do Dia
            </button>
          </div>
        </form>
      )}

      {/* List of Pautas */}
      <div className="space-y-4">
        {pautas.map((pauta, index) => {
          const isVoting = pauta.status === 'votacao_aberta';
          const isBeingEdited = editingPautaId === pauta.id;
          const isObserving = activeObsPautaId === pauta.id;

          return (
            <div
              key={pauta.id}
              className={`bg-white dark:bg-[#121722] rounded-2xl p-6 border transition-all ${
                isVoting
                  ? 'border-[#9A7B3E] dark:border-[#D4AF63] ring-1 ring-[#9A7B3E]/30 dark:ring-[#D4AF63]/30'
                  : 'border-[#E5E1D8] dark:border-[#1F2838]'
              }`}
            >
              {/* Pauta Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#5A616E] dark:text-[#949BA8] flex-wrap">
                    <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                      {pauta.numeroResolucao || `Item ${index + 1}`}
                    </span>
                    <span className="opacity-35">·</span>
                    <span className="font-medium text-[#14181F] dark:text-[#F1EFEA]">{pauta.categoria}</span>
                    <span className="opacity-35">·</span>
                    <span>Relator: <strong className="font-medium text-[#14181F] dark:text-[#F1EFEA]">{pauta.relator}</strong></span>
                    <span className="opacity-35">·</span>
                    <span>{new Date(pauta.dataPautada).toLocaleDateString('pt-BR')}</span>
                    <span className="opacity-35">·</span>
                    {getStatusLabel(pauta.status)}
                    {index === 0 && isAdminOrPresident && (
                      <>
                        <span className="opacity-35">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRenumberStartPattern(pauta.numeroResolucao || 'Voto nº 01/2026');
                            setIsRenumberDialogOpen(true);
                          }}
                          className="text-[11px] font-medium text-[#1B365D] dark:text-[#D4AF63] hover:underline cursor-pointer"
                        >
                          Alterar numeração inicial
                        </button>
                      </>
                    )}
                  </div>

                  <h3 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA] pt-0.5 tracking-tight">
                    {pauta.titulo}
                  </h3>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto text-[#5A616E]">
                  <button
                    type="button"
                    onClick={() => openPresentationAt(index)}
                    title="Apresentar este item em Tela Cheia"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] hover:border-[#9A7B3E] transition cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#9A7B3E] dark:text-[#D4AF63]" />
                    <span>Apresentar</span>
                  </button>

                  {isAdminOrPresident && (
                    <button
                      type="button"
                      onClick={() => toggleSharePautaWithMembers(pauta.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                        pauta.compartilhadaComMembros
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-[#F7F6F2] dark:bg-[#181F2D] text-[#5A616E] dark:text-[#949BA8] border-[#E5E1D8] dark:border-[#1F2838]'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{pauta.compartilhadaComMembros ? 'Compartilhada' : 'Oculta'}</span>
                    </button>
                  )}

                  {isAdminOrPresident && (
                    <button
                      type="button"
                      onClick={() => setPautaToEdit(pauta)}
                      title="Editar pauta"
                      className="p-1.5 rounded-lg hover:text-[#14181F] dark:hover:text-white hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {canDeletePauta && (
                    confirmDeletePautaId === pauta.id ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePautaId(null)}
                          className="text-[#5A616E] hover:underline px-1 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setDeletePautaError(null);
                            const res = await deletePauta(pauta.id);
                            setConfirmDeletePautaId(null);
                            if (!res.success) {
                              setDeletePautaError(res.message || 'Erro ao excluir proposta.');
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-rose-600 text-white font-semibold cursor-pointer"
                        >
                          Excluir
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePautaId(pauta.id)}
                        title="Excluir proposta (Administrador)"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => handleSyncToGoogleCalendar(pauta)}
                    title="Sincronizar no Google Calendar"
                    className="p-1.5 rounded-lg hover:text-[#14181F] dark:hover:text-white hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttachmentTarget({ id: pauta.id, titulo: pauta.titulo })}
                    title="Anexar arquivo"
                    className="p-1.5 rounded-lg hover:text-[#14181F] dark:hover:text-white hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Proposal Content (Clean surface container — no border-l stripes) */}
              <div className="mt-4 space-y-2.5">
                {isBeingEdited ? (
                  <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] space-y-3">
                    <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF63]" />
                      <span>Ajustar Redação da Proposta</span>
                    </p>
                    <textarea
                      rows={3}
                      value={editedProposta}
                      onChange={(e) => setEditedProposta(e.target.value)}
                      className="w-full p-3 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPautaId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-[#5A616E] dark:text-[#949BA8] hover:bg-black/5"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditedProposta(pauta.id)}
                        className="px-4 py-1.5 rounded-lg bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold"
                      >
                        Salvar Redação
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A7B3E] dark:text-[#D4AF63]">
                        Proposta de Voto
                      </span>
                      {isAdminOrPresident && pauta.status !== 'aprovado' && pauta.status !== 'rejeitado' && !isVoting && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPautaId(pauta.id);
                            setEditedProposta(pauta.propostaTexto);
                          }}
                          className="text-xs text-[#1B365D] dark:text-[#D4AF63] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar Redação</span>
                        </button>
                      )}
                    </div>
                    <p className="text-sm sm:text-base text-[#14181F] dark:text-[#F1EFEA]/90 leading-relaxed">
                      {pauta.propostaTexto}
                    </p>
                  </div>
                )}

                {pauta.justificativa && (
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8] leading-relaxed">
                    <span className="font-semibold text-[#14181F] dark:text-[#F1EFEA]">Justificativa: </span>
                    {pauta.justificativa}
                  </p>
                )}
              </div>

              {/* Attachments */}
              {pauta.anexos && pauta.anexos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#5A616E] dark:text-[#949BA8] font-medium">Anexos:</span>
                  {pauta.anexos.map(anx => (
                    <div
                      key={anx.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs border border-[#E5E1D8] dark:border-[#1F2838] text-[#14181F] dark:text-[#F1EFEA]"
                    >
                      <Paperclip className="w-3 h-3 text-[#5A616E]" />
                      <span className="truncate max-w-[150px] font-medium">{anx.name}</span>
                      <span className="text-[10px] text-[#5A616E]">
                        ({(anx.sizeBytes / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                      {anx.dataUrl && (
                        <a href={anx.dataUrl} download={anx.name} className="p-0.5 hover:text-[#1B365D]" title="Baixar">
                          <Download className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Observations */}
              <div className="mt-3 pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838]">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#5A616E] dark:text-[#949BA8]">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Observações e Emendas ({pauta.observacoes?.length || 0})</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveObsPautaId(isObserving ? null : pauta.id)}
                    className="text-xs text-[#1B365D] dark:text-[#D4AF63] font-medium hover:underline cursor-pointer"
                  >
                    {isObserving ? 'Fechar' : '+ Registrar Observação'}
                  </button>
                </div>

                {pauta.observacoes && pauta.observacoes.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {pauta.observacoes.map(obs => (
                      <div
                        key={obs.id}
                        className="p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#5A616E] dark:text-[#949BA8] mb-0.5">
                          <span className="font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                            {obs.userName} ({getRoleLabel(obs.userRole)})
                          </span>
                          <span>{new Date(obs.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[#5A616E] dark:text-[#949BA8]">{obs.comment}</p>
                        {obs.suggestedRevision && (
                          <p className="mt-1 text-[11px] text-[#9A7B3E] dark:text-[#D4AF63]">
                            <b>Sugestão:</b> {obs.suggestedRevision}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isObserving && (
                  <div className="mt-2.5 p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] space-y-2">
                    <input
                      type="text"
                      value={newObsComment}
                      onChange={(e) => setNewObsComment(e.target.value)}
                      placeholder="Comentário ou consideração..."
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newObsSuggestion}
                      onChange={(e) => setNewObsSuggestion(e.target.value)}
                      placeholder="(Opcional) Proposta de emenda..."
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] text-xs focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveObsPautaId(null)}
                        className="px-2.5 py-1 text-xs text-[#5A616E] rounded-md"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddObservation(pauta.id)}
                        className="px-3 py-1 text-xs font-semibold bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] rounded-md"
                      >
                        Publicar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Final Revealed Result (Only rendered after conclusion) */}
              {pauta.resultadoFinal && !isVoting && (
                <div className="mt-4 pt-3.5 border-t border-[#E5E1D8] dark:border-[#1F2838] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${pauta.resultadoFinal.aprovado ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                      {pauta.resultadoFinal.aprovado ? 'Aprovado por Maioria Simples' : 'Rejeitado pelo Plenário'}
                    </span>
                    <span className="opacity-35">·</span>
                    <span className="font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">
                      {pauta.resultadoFinal.favor} a favor ({pauta.resultadoFinal.percentualFavor}%) ·{' '}
                      {pauta.resultadoFinal.contra} contra · {pauta.resultadoFinal.abstencao} abstenções
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">
                    Resolvido às{' '}
                    {new Date(pauta.resultadoFinal.dataResolucao).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )}

              {/* Bottom Admin Action Footer */}
              {isAdminOrPresident && pauta.status !== 'aprovado' && pauta.status !== 'rejeitado' && (
                <div className="mt-4 pt-3.5 border-t border-[#E5E1D8] dark:border-[#1F2838] flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    {pauta.status === 'pautado' && 'Status: Aguardando apresentação em plenário.'}
                    {pauta.status === 'em_leitura' && 'Status: Em leitura no plenário.'}
                    {pauta.status === 'em_edicao' && 'Status: Redação ajustada.'}
                    {pauta.status === 'votacao_aberta' && 'Status: Votação secreta em andamento.'}
                  </div>

                  <div className="flex items-center gap-2">
                    {pauta.status === 'pautado' && (
                      <button
                        type="button"
                        onClick={() => updatePautaStatus(pauta.id, 'em_leitura')}
                        className="px-3 py-1.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-medium transition cursor-pointer"
                      >
                        Marcar como Lido
                      </button>
                    )}

                    {!isVoting && (
                      <button
                        type="button"
                        onClick={() => startPautaVoting(pauta.id)}
                        className="px-4 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:hover:bg-[#c39d52] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Iniciar Votação Secreta</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FULL-SCREEN INDIVIDUAL PAUTA PRESENTATION OVERLAY */}
      {isPresentationMode && presentedPauta && (
        <div className="fixed inset-0 z-50 bg-[#0B0E14] text-[#F1EFEA] flex flex-col animate-fadeIn">
          {/* Top Presentation Bar */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 bg-[#121722]">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold uppercase tracking-[0.2em] text-[#D4AF63]">
                Apresentação da Ordem do Dia
              </span>
              <span className="opacity-30">·</span>
              <span className="font-mono-tabular text-white/80">
                Item {presentationIndex + 1} de {pautas.length}
              </span>
              <span className="opacity-30">·</span>
              <span className="font-mono-tabular text-[#D4AF63]">
                {presentedPauta.numeroResolucao || `Item ${presentationIndex + 1}`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsPresentationMode(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Sair da Apresentação</span>
            </button>
          </div>

          {/* Main Presentation Stage */}
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 sm:p-12">
            <div className="max-w-4xl w-full space-y-8">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#949BA8]">
                  <span className="uppercase tracking-[0.18em] text-[#D4AF63] font-semibold">
                    {presentedPauta.categoria}
                  </span>
                  <span className="opacity-35">·</span>
                  <span>Relator: <strong className="text-white">{presentedPauta.relator}</strong></span>
                  <span className="opacity-35">·</span>
                  {getStatusLabel(presentedPauta.status)}
                </div>

                <h2 className="font-display text-3xl sm:text-5xl font-semibold text-white leading-tight">
                  {presentedPauta.titulo}
                </h2>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl bg-[#121722] border border-[#D4AF63]/30 space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF63] block">
                  Proposta Submetida ao Plenário
                </span>
                <p className="text-lg sm:text-2xl text-[#F1EFEA] leading-relaxed font-light">
                  {presentedPauta.propostaTexto}
                </p>
              </div>

              {presentedPauta.justificativa && (
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#949BA8] block mb-1">
                    Justificativa
                  </span>
                  <p className="text-sm sm:text-base text-[#F1EFEA]/80 leading-relaxed">
                    {presentedPauta.justificativa}
                  </p>
                </div>
              )}

              {/* Live Voting Control or Secret Ballot inside Presentation */}
              {presentedPauta.status === 'votacao_aberta' ? (
                <div className="p-6 rounded-2xl bg-[#121722] border border-[#D4AF63]/40 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#D4AF63]">
                      <EyeOff className="w-4 h-4" />
                      <span>Votação Secreta em Curso · Apuração Oculta</span>
                    </div>
                    <span className="font-mono-tabular text-xs text-white/80">
                      {Object.keys(presentedPauta.votos || {}).length} de {presentVoters.length} votaram
                    </span>
                  </div>

                  {currentUser && !presentedPauta.votos?.[currentUser.id] && isVotingMember(currentUser) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => castPautaVote(presentedPauta.id, 'favor')}
                        className="py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>A Favor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => castPautaVote(presentedPauta.id, 'contra')}
                        className="py-3.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Contra</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => castPautaVote(presentedPauta.id, 'abstencao')}
                        className="py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                        <span>Abstenção</span>
                      </button>
                    </div>
                  ) : currentUser && presentedPauta.votos?.[currentUser.id] ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                      <Lock className="w-4 h-4" />
                      <span>Seu voto sigiloso foi registrado. Aguardando os demais membros.</span>
                    </div>
                  ) : null}

                  {isAdminOrPresident && (
                    <div className="pt-3 border-t border-white/10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => closePautaVoting(presentedPauta.id)}
                        className="px-4 py-2 rounded-xl bg-[#D4AF63] hover:bg-[#c39d52] text-[#0B0E14] text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <StopCircle className="w-4 h-4" />
                        <span>Encerrar Votação &amp; Revelar Resultado</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : presentedPauta.resultadoFinal ? (
                <div className="p-6 rounded-2xl bg-[#121722] border border-emerald-500/40 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold block">
                      Resultado Oficial Revelado
                    </span>
                    <p className="font-display text-2xl font-semibold text-white">
                      {presentedPauta.resultadoFinal.aprovado ? 'Proposta Aprovada em Plenário' : 'Proposta Rejeitada'}
                    </p>
                  </div>
                  <div className="font-mono-tabular text-sm text-white/90">
                    {presentedPauta.resultadoFinal.favor} A Favor ({presentedPauta.resultadoFinal.percentualFavor}%) ·{' '}
                    {presentedPauta.resultadoFinal.contra} Contra · {presentedPauta.resultadoFinal.abstencao} Abstenções
                  </div>
                </div>
              ) : (
                isAdminOrPresident && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => startPautaVoting(presentedPauta.id)}
                      className="px-6 py-3.5 rounded-xl bg-[#D4AF63] hover:bg-[#c39d52] text-[#0B0E14] text-sm font-bold flex items-center gap-2 shadow-xl transition cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>Iniciar Votação</span>
                    </button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Bottom Presentation Navigation Bar */}
          <div className="px-6 py-4 border-t border-white/10 bg-[#121722] flex items-center justify-between">
            <button
              type="button"
              disabled={presentationIndex === 0}
              onClick={() => setPresentationIndex(i => Math.max(i - 1, 0))}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1.5">
              {pautas.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresentationIndex(idx)}
                  aria-label={`Ir para pauta ${idx + 1}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === presentationIndex ? 'w-6 bg-[#D4AF63]' : 'w-2 bg-white/25 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={presentationIndex >= pautas.length - 1}
              onClick={() => setPresentationIndex(i => Math.min(i + 1, pautas.length - 1))}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {attachmentTarget && (
        <MediaAttachmentModal
          pautaId={attachmentTarget.id}
          pautaTitulo={attachmentTarget.titulo}
          isOpen={Boolean(attachmentTarget)}
          onClose={() => setAttachmentTarget(null)}
          onAttach={addAttachmentToPauta}
          uploaderName={currentUser?.name || 'Membro da Comissão'}
        />
      )}

      {pautaToEdit && (
        <EditPautaModal
          pauta={pautaToEdit}
          isOpen={Boolean(pautaToEdit)}
          onClose={() => setPautaToEdit(null)}
        />
      )}

      {isEditSessionOpen && (
        <EditSessionModal isOpen={isEditSessionOpen} onClose={() => setIsEditSessionOpen(false)} />
      )}

      {/* Sequential Renumbering Modal */}
      {isRenumberDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E14]/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-[#E5E1D8] dark:border-[#1F2838] overflow-hidden">
            <div className="p-6 border-b border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#181F2D] text-[#1B365D] dark:text-[#D4AF63]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                    Ordem Numeral Sequencial dos Votos
                  </h3>
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    Defina o número do primeiro voto para sequenciar automaticamente os demais.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRenumberDialogOpen(false)}
                className="p-2 rounded-xl text-[#5A616E] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-xs space-y-1">
                <div className="flex items-center gap-2 font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                  <Sparkles className="w-4 h-4" />
                  <span>Padronização de Votos da Comissão</span>
                </div>
                <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                  Todas as <b>{pautas.length} pautas</b> serão numeradas em sequência a partir do padrão informado.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1.5">
                  Número Inicial
                </label>
                <input
                  type="text"
                  value={renumberStartPattern}
                  onChange={(e) => setRenumberStartPattern(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-sm font-mono-tabular font-semibold text-[#14181F] dark:text-[#F1EFEA] focus:outline-none"
                />

                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {['Voto nº 01/2026', 'Voto nº 10/2026', '2026-001', 'Voto 01'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRenumberStartPattern(preset)}
                      className={`text-[11px] font-mono-tabular px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        renumberStartPattern === preset
                          ? 'bg-[#1B365D] text-white border-[#1B365D] dark:bg-[#D4AF63] dark:text-[#0B0E14] dark:border-[#D4AF63]'
                          : 'bg-white dark:bg-[#121722] text-[#5A616E] dark:text-[#949BA8] border-[#E5E1D8] dark:border-[#1F2838]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#9A7B3E]" />
                  <span>Prévia ({pautas.length} pautas)</span>
                </span>
                <div className="border border-[#E5E1D8] dark:border-[#1F2838] rounded-xl divide-y divide-[#E5E1D8] dark:divide-[#1F2838] overflow-hidden">
                  {pautas.map((p, i) => {
                    const parsed = parseResolutionNumber(renumberStartPattern) || {
                      prefix: 'Voto nº ',
                      num: 1,
                      pad: 2,
                      suffix: `/${new Date().getFullYear()}`
                    };
                    const nextNumber = formatResolutionNumber(parsed, i);
                    return (
                      <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63] shrink-0">
                            {nextNumber}
                          </span>
                          <span className="truncate text-[#14181F] dark:text-[#F1EFEA]">{p.titulo}</span>
                        </div>
                        <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8] shrink-0">{p.categoria}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenumberDialogOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#5A616E]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await setFirstPautaResolutionNumber(renumberStartPattern);
                  setIsRenumberDialogOpen(false);
                  setRenumberSuccessMsg(
                    `Numeração atualizada a partir de "${renumberStartPattern}" para todas as ${pautas.length} pautas.`
                  );
                }}
                className="px-5 py-2 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar Numeração</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
