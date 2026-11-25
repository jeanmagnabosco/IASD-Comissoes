import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { MinistryElection } from '../types';
import { EditElectionModal } from './EditElectionModal';
import { MemberAvatar } from './MemberAvatar';
import { isSystemAdmin, isVotingMember } from '../utils/roles';
import {
  Award,
  Users,
  Vote,
  CheckCircle,
  PlusCircle,
  UserPlus,
  Trash2,
  Lock,
  StopCircle,
  Edit3,
  EyeOff,
  Copy,
  Check,
  FileCheck2,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const MinistryElections: React.FC = () => {
  const {
    currentUser,
    users,
    elections,
    createElection,
    addCandidateToElection,
    updateCandidateAcceptance,
    startElectionVoting,
    castElectionVote,
    concludeElectionRound,
    toggleShareElectionWithMembers
  } = useChurch();

  const [isCreating, setIsCreating] = useState(false);
  const [electionToEdit, setElectionToEdit] = useState<MinistryElection | null>(null);
  const [ministryName, setMinistryName] = useState('');
  const [descricao, setDescricao] = useState('');
  const [autoIncorporate, setAutoIncorporate] = useState(true);
  const [allowMemberNomination, setAllowMemberNomination] = useState(true);
  const [candidateList, setCandidateList] = useState<string[]>(['', '', '']);
  const [votingFeedback, setVotingFeedback] = useState<{ [electionId: string]: string }>({});
  const [copiedElectionLink, setCopiedElectionLink] = useState(false);

  // Inline nomination state per election
  const [nominatingElectionId, setNominatingElectionId] = useState<string | null>(null);
  const [newNomineeName, setNewNomineeName] = useState('');
  const [newNomineeExp, setNewNomineeExp] = useState('');

  const isAdminOrPresident =
    currentUser?.role === 'presidente' || currentUser?.role === 'secretario' || isSystemAdmin(currentUser);
  const presentVoters = users.filter(
    u => u.presenceStatus === 'presente' && isVotingMember(u)
  );

  const concludedElections = elections.filter(e => e.status === 'concluido' && e.electedLeaderName);

  const votingDirectUrl =
    typeof window !== 'undefined' && window.location.origin
      ? `${window.location.origin}/?tab=eleicoes`
      : 'https://ais-pre-snkbx6sngeokfiovmirnl5-117556746211.us-east1.run.app/?tab=eleicoes';

  const handleCopyVotingLink = () => {
    navigator.clipboard.writeText(votingDirectUrl);
    setCopiedElectionLink(true);
    setTimeout(() => setCopiedElectionLink(false), 2500);
  };

  const handleAddCandidateField = () => {
    setCandidateList(prev => [...prev, '']);
  };

  const handleCandidateChange = (index: number, val: string) => {
    setCandidateList(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveCandidate = (index: number) => {
    if (candidateList.length <= 2) return;
    setCandidateList(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    const validCandidates = candidateList.map(c => c.trim()).filter(Boolean);
    if (!ministryName.trim() || validCandidates.length < 2) {
      return;
    }

    await createElection(
      ministryName.trim(),
      descricao.trim(),
      validCandidates,
      autoIncorporate,
      allowMemberNomination
    );
    setMinistryName('');
    setDescricao('');
    setCandidateList(['', '', '']);
    setIsCreating(false);
  };

  const handleAddInlineNominee = async (e: React.FormEvent, electionId: string) => {
    e.preventDefault();
    if (!newNomineeName.trim()) return;
    await addCandidateToElection(
      electionId,
      newNomineeName.trim(),
      newNomineeExp.trim() || undefined,
      currentUser?.name
    );
    setNewNomineeName('');
    setNewNomineeExp('');
    setNominatingElectionId(null);
  };

  const handleVoteCandidate = async (electionId: string, candidateId: string) => {
    const result = await castElectionVote(electionId, candidateId);
    setVotingFeedback(prev => ({ ...prev, [electionId]: result.message }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E5E1D8] dark:border-[#1F2838]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63]">
            Comissão de Nomeações · Eleições Ministeriais
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight mt-0.5">
            Indicação e Eleição de Líderes
          </h1>
          <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">
            Voto secreto em dois turnos (50% + 1 para eleição direta) · Apuração revelada somente após todos votarem ou encerramento pela presidência
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyVotingLink}
            className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedElectionLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#9A7B3E] dark:text-[#D4AF63]" />
            )}
            <span>{copiedElectionLink ? 'Link Copiado!' : 'Copiar Link de Votação'}</span>
          </button>

          {isAdminOrPresident && (
            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="px-4 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:hover:bg-[#c39d52] text-white dark:text-[#0B0E14] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Novo Cargo / Ministério</span>
            </button>
          )}
        </div>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateElection}
          className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#1B365D]/30 dark:border-[#D4AF63]/30 shadow-lg space-y-5 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
            <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#9A7B3E] dark:text-[#D4AF63]" />
              Configurar Cargo na Comissão de Nomeações
            </h3>
            <span className="text-xs text-[#5A616E] dark:text-[#949BA8]">Regra Canônica 50% + 1</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Cargo ou Ministério
              </label>
              <input
                type="text"
                required
                value={ministryName}
                onChange={(e) => setMinistryName(e.target.value)}
                placeholder="Ex: Primeiro Ancião, Ministério de Louvor, Diaconia..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                Descrição do Mandato / Requisitos
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Exercício 2026-2027, coordenação ministerial..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Nomes Indicados Inicialmente (mínimo 2)
              </label>
              <button
                type="button"
                onClick={handleAddCandidateField}
                className="text-xs text-[#1B365D] dark:text-[#D4AF63] hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Mais um Nome</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {candidateList.map((cand, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F1EFE9] dark:bg-[#181F2D] text-[#1B365D] dark:text-[#D4AF63] font-mono-tabular font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    required
                    value={cand}
                    onChange={(e) => handleCandidateChange(idx, e.target.value)}
                    placeholder={`Nome completo do indicado ${idx + 1}...`}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none"
                  />
                  {candidateList.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCandidate(idx)}
                      className="p-2 text-[#5A616E] hover:text-rose-500 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#181F2D] border border-[#E5E1D8] dark:border-[#1F2838] flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoIncorporate}
                onChange={(e) => setAutoIncorporate(e.target.checked)}
                className="mt-1 rounded text-[#1B365D] w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] block">
                  Integrar demais indicados como equipe
                </span>
                <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8] block mt-0.5">
                  Os demais nomes compõem o corpo de apoio do ministério.
                </span>
              </div>
            </label>

            <label className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#181F2D] border border-[#E5E1D8] dark:border-[#1F2838] flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowMemberNomination}
                onChange={(e) => setAllowMemberNomination(e.target.checked)}
                className="mt-1 rounded text-[#1B365D] w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] block">
                  Permitir indicações dos membros na comissão
                </span>
                <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8] block mt-0.5">
                  Qualquer membro pode sugerir nomes antes de abrir a urna.
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:text-[#0B0E14] text-white text-xs font-semibold transition cursor-pointer"
            >
              Salvar Cargo &amp; Preparar Eleição
            </button>
          </div>
        </form>
      )}

      {/* Elections List */}
      <div className="space-y-6">
        {elections.map((election) => {
          const isVotingR1 = election.status === 'votacao_turno_1';
          const isVotingR2 = election.status === 'votacao_turno_2';
          const isVotingAny = isVotingR1 || isVotingR2;
          const isConcluded = election.status === 'concluido';
          const isAwaitingR2 = election.status === 'apuracao_turno_1';
          const isConfig = election.status === 'configuracao';

          // CRITICAL: Results are strictly revealed ONLY after voting concludes or round 1 closes!
          const resultsRevealed = isConcluded || isAwaitingR2;

          const voterList = election.round === 1 ? election.votersWhoCastVoteRound1 : election.votersWhoCastVoteRound2;
          const userHasVoted = currentUser ? voterList.includes(currentUser.id) : false;
          const totalVotesCast = voterList.length;
          const majorityNeeded = Math.floor(presentVoters.length / 2) + 1;
          const participationPct =
            presentVoters.length > 0 ? Math.min((totalVotesCast / presentVoters.length) * 100, 100) : 0;

          const canNominate =
            isConfig &&
            (isAdminOrPresident ||
              (election.allowMemberNomination && isVotingMember(currentUser)));

          return (
            <div
              key={election.id}
              className={`bg-white dark:bg-[#121722] rounded-2xl p-6 border transition-all ${
                isVotingAny
                  ? 'border-[#1B365D] dark:border-[#D4AF63] ring-1 ring-[#1B365D]/30 dark:ring-[#D4AF63]/30'
                  : 'border-[#E5E1D8] dark:border-[#1F2838]'
              }`}
            >
              {/* Election Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E5E1D8] dark:border-[#1F2838]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#5A616E] dark:text-[#949BA8] flex-wrap">
                    <span className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                      {election.ministryName}
                    </span>
                    <span className="opacity-35">·</span>
                    {isConcluded ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Eleição Concluída</span>
                      </span>
                    ) : isVotingAny ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
                        <span className="w-2 h-2 rounded-full bg-[#D4AF63] animate-pulse" />
                        <span>Votação Secreta Aberta ({election.round}º Turno)</span>
                      </span>
                    ) : isAwaitingR2 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>2º Turno Definido (Top 2)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#5A616E] dark:text-[#949BA8]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#949BA8]" />
                        <span>Indicações &amp; Preparação</span>
                      </span>
                    )}

                    {election.autoIncorporateOthersAsMembers && (
                      <>
                        <span className="opacity-35">·</span>
                        <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                          Demais indicados integram equipe
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    {election.descricao || 'Deliberação em comissão de nomeações.'}
                  </p>
                </div>

                {/* Quorum Participation & Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="text-right text-xs">
                    <span className="font-mono-tabular font-semibold text-[#14181F] dark:text-[#F1EFEA] block">
                      {totalVotesCast} / {presentVoters.length} votaram
                    </span>
                    <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                      Maioria requerida: {majorityNeeded} (50% + 1)
                    </span>
                  </div>

                  {isAdminOrPresident && (
                    <button
                      type="button"
                      onClick={() => toggleShareElectionWithMembers(election.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                        election.compartilhadaComMembros
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-[#F7F6F2] dark:bg-[#181F2D] text-[#5A616E] dark:text-[#949BA8] border-[#E5E1D8] dark:border-[#1F2838]'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{election.compartilhadaComMembros ? 'Compartilhada' : 'Oculta'}</span>
                    </button>
                  )}

                  {isAdminOrPresident && (
                    <button
                      type="button"
                      onClick={() => setElectionToEdit(election)}
                      title="Editar cargo e candidatos"
                      className="p-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] text-[#5A616E] dark:text-[#949BA8] transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Secret Voting Banner while Voting is Open */}
              {isVotingAny && (
                <div className="mt-4 p-4 rounded-xl bg-[#0B0E14] text-[#F1EFEA] border border-[#D4AF63]/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#D4AF63] flex items-center gap-1.5">
                      <EyeOff className="w-4 h-4" />
                      <span>Votação Secreta em Andamento · Votos Ocultos</span>
                    </span>
                    <span className="font-mono-tabular text-white/80">
                      {totalVotesCast} de {presentVoters.length} votos registrados
                    </span>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#D4AF63] h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${participationPct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#949BA8]">
                    <span>
                      Nenhum resultado parcial é exibido durante o escrutínio. A apuração abre automaticamente ao último voto ou encerramento pelo Presidente.
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {presentVoters.map(v => {
                        const voted = voterList.includes(v.id);
                        return (
                          <span
                            key={v.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border ${
                              voted
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                : 'bg-white/5 text-[#949BA8] border-white/10'
                            }`}
                          >
                            {voted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            <span>{v.name.split(' ')[0]}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {votingFeedback[election.id] && (
                <div className="my-3 p-3 rounded-xl bg-[#F1EFE9] dark:bg-[#181F2D] text-[#14181F] dark:text-[#F1EFEA] text-xs border border-[#E5E1D8] dark:border-[#1F2838]">
                  {votingFeedback[election.id]}
                </div>
              )}

              {/* Concluded Winner Announcement */}
              {isConcluded && election.electedLeaderName && (
                <div className="my-5 p-6 rounded-2xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#9A7B3E]/40 dark:border-[#D4AF63]/40 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] flex items-center justify-center">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63]">
                      Nomeado(a) pela Comissão
                    </span>
                    <h3 className="font-display text-2xl font-semibold text-[#14181F] dark:text-[#F1EFEA] mt-0.5">
                      {election.electedLeaderName}
                    </h3>
                    <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">
                      Eleito(a) para {election.ministryName} no {election.round}º turno.
                    </p>
                  </div>

                  {election.assignedMembers && election.assignedMembers.length > 0 && (
                    <div className="pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838] max-w-xl mx-auto">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] mb-2">
                        Equipe de Apoio Ministerial Integrada
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {election.assignedMembers.map((m, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#121722] text-xs text-[#14181F] dark:text-[#F1EFEA] border border-[#E5E1D8] dark:border-[#1F2838]"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Candidates Grid */}
              <div className="my-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8]">
                    Nomes Apresentados {isVotingR2 && '· 2º Turno (Dois Mais Votados)'}
                  </h4>

                  <div className="flex items-center gap-3">
                    {userHasVoted && isVotingAny && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Seu voto no {election.round}º turno foi registrado</span>
                      </span>
                    )}

                    {canNominate && (
                      <button
                        type="button"
                        onClick={() =>
                          setNominatingElectionId(nominatingElectionId === election.id ? null : election.id)
                        }
                        className="text-xs font-semibold text-[#1B365D] dark:text-[#D4AF63] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Indicar Nome</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Nomination Form */}
                {nominatingElectionId === election.id && (
                  <form
                    onSubmit={(e) => handleAddInlineNominee(e, election.id)}
                    className="mb-4 p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] grid grid-cols-1 sm:grid-cols-3 gap-3 items-end animate-fadeIn"
                  >
                    <div>
                      <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                        Nome do(a) Indicado(a)
                      </label>
                      <input
                        type="text"
                        required
                        value={newNomineeName}
                        onChange={(e) => setNewNomineeName(e.target.value)}
                        placeholder="Nome completo..."
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs text-[#14181F] dark:text-[#F1EFEA] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                        Experiência / Observação
                      </label>
                      <input
                        type="text"
                        value={newNomineeExp}
                        onChange={(e) => setNewNomineeExp(e.target.value)}
                        placeholder="Atuação ministerial prévia..."
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs text-[#14181F] dark:text-[#F1EFEA] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNominatingElectionId(null)}
                        className="px-3 py-2 rounded-lg text-xs text-[#5A616E] dark:text-[#949BA8] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-3 py-2 rounded-lg bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold cursor-pointer"
                      >
                        Incluir na Lista
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {election.candidates.map((cand) => {
                    const votesThisRound = election.round === 1 ? cand.round1Votes : cand.round2Votes;
                    const percentVotes = totalVotesCast > 0 ? (votesThisRound / totalVotesCast) * 100 : 0;
                    const isCandidateDisabledInRound2 = isVotingR2 && cand.status !== 'segundo_turno';
                    const acceptance = cand.aceitouIndicacao || 'pendente';

                    return (
                      <div
                        key={cand.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                          cand.status === 'eleito'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-500/60'
                            : cand.status === 'segundo_turno'
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-[#D4AF63]/60'
                            : isCandidateDisabledInRound2
                            ? 'opacity-40 bg-[#F7F6F2] dark:bg-[#0B0E14] border-[#E5E1D8] dark:border-[#1F2838]'
                            : 'bg-[#F7F6F2]/70 dark:bg-[#0B0E14]/60 border-[#E5E1D8] dark:border-[#1F2838]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <MemberAvatar name={cand.name} size="sm" />
                              <div className="min-w-0">
                                <h5 className="font-semibold text-sm text-[#14181F] dark:text-[#F1EFEA] truncate">
                                  {cand.name}
                                </h5>
                                {cand.indicadoPor && (
                                  <p className="text-[10px] text-[#5A616E] dark:text-[#949BA8] truncate">
                                    Indicado por {cand.indicadoPor}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Only show numeric vote count if resultsRevealed */}
                            {resultsRevealed ? (
                              <div className="text-right shrink-0">
                                <span className="text-lg font-bold text-[#14181F] dark:text-[#F1EFEA] font-mono-tabular">
                                  {votesThisRound}
                                </span>
                                <span className="text-[10px] text-[#5A616E] dark:text-[#949BA8] block">
                                  votos
                                </span>
                              </div>
                            ) : isVotingAny ? (
                              <span className="text-[10px] font-medium text-[#9A7B3E] dark:text-[#D4AF63] flex items-center gap-1 shrink-0">
                                <Lock className="w-3 h-3" />
                                Sigilo
                              </span>
                            ) : null}
                          </div>

                          {/* Status label (plain typographic, no pill spam) */}
                          <div className="flex items-center gap-2 mt-2 text-[11px]">
                            {cand.status === 'eleito' && (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                ELEITO(A)
                              </span>
                            )}
                            {cand.status === 'segundo_turno' && (
                              <span className="font-bold text-[#9A7B3E] dark:text-[#D4AF63]">
                                2º TURNO
                              </span>
                            )}
                            {cand.status === 'incorporado_membro' && (
                              <span className="font-medium text-[#1B365D] dark:text-[#949BA8]">
                                Equipe Ministerial
                              </span>
                            )}
                            {isConfig && (
                              <span
                                className={`font-medium ${
                                  acceptance === 'aceito'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : acceptance === 'recusado'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-[#5A616E] dark:text-[#949BA8]'
                                }`}
                              >
                                Aceite: {acceptance === 'aceito' ? 'Confirmado' : acceptance === 'recusado' ? 'Declinou' : 'Aguardando consulta'}
                              </span>
                            )}
                          </div>

                          {cand.experiencia && (
                            <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1.5 line-clamp-2">
                              {cand.experiencia}
                            </p>
                          )}
                        </div>

                        {/* Revealed Tally Bar — ONLY rendered after conclusion / round close */}
                        {resultsRevealed && (
                          <div className="mt-3 pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838]">
                            <div className="w-full bg-[#E5E1D8] dark:bg-[#1F2838] rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  cand.status === 'eleito' ? 'bg-emerald-600' : 'bg-[#1B365D] dark:bg-[#D4AF63]'
                                }`}
                                style={{ width: `${percentVotes}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-[#5A616E] dark:text-[#949BA8] mt-1 font-mono-tabular">
                              <span>{percentVotes.toFixed(1)}%</span>
                              <span>
                                {votesThisRound} de {totalVotesCast}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Admin Acceptance Quick Controls during Config */}
                        {isConfig && isAdminOrPresident && (
                          <div className="mt-3 pt-2.5 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between gap-1 text-[11px]">
                            <span className="text-[#5A616E] dark:text-[#949BA8]">Consulta:</span>
                            <div className="flex items-center gap-1">
                              {(['pendente', 'aceito', 'recusado'] as const).map(st => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => updateCandidateAcceptance(election.id, cand.id, st)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition cursor-pointer ${
                                    acceptance === st
                                      ? 'bg-[#1B365D] text-white border-[#1B365D] dark:bg-[#D4AF63] dark:text-[#0B0E14] dark:border-[#D4AF63]'
                                      : 'border-[#E5E1D8] dark:border-[#1F2838] text-[#5A616E] dark:text-[#949BA8]'
                                  }`}
                                >
                                  {st === 'pendente' ? 'Pendente' : st === 'aceito' ? 'Aceitou' : 'Recusou'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Vote Action Button */}
                        {isVotingAny &&
                          !userHasVoted &&
                          !isCandidateDisabledInRound2 &&
                          isVotingMember(currentUser) && (
                            <button
                              type="button"
                              onClick={() => handleVoteCandidate(election.id, cand.id)}
                              className="mt-3 w-full py-2 px-3 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:hover:bg-[#c39d52] text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <Vote className="w-3.5 h-3.5" />
                              <span>Votar em {cand.name.split(' ')[0]}</span>
                            </button>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons for Administrator / President */}
              {isAdminOrPresident && !isConcluded && (
                <div className="pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    Maioria absoluta (<b>50% + 1</b>) elege em 1º turno. Encerramento automático quando todos votarem.
                  </div>

                  <div className="flex items-center gap-2">
                    {isConfig && (
                      <button
                        type="button"
                        onClick={() => startElectionVoting(election.id, 1)}
                        className="px-4 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:text-[#0B0E14] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <Vote className="w-4 h-4" />
                        <span>Iniciar Votação Secreta (1º Turno)</span>
                      </button>
                    )}

                    {isVotingR1 && (
                      <button
                        type="button"
                        onClick={() => concludeElectionRound(election.id)}
                        className="px-4 py-2 rounded-xl bg-[#9A7B3E] hover:bg-[#826630] dark:bg-[#D4AF63] dark:text-[#0B0E14] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <StopCircle className="w-4 h-4" />
                        <span>Encerrar &amp; Revelar 1º Turno</span>
                      </button>
                    )}

                    {isAwaitingR2 && (
                      <button
                        type="button"
                        onClick={() => startElectionVoting(election.id, 2)}
                        className="px-4 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:text-[#0B0E14] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <Vote className="w-4 h-4" />
                        <span>Iniciar Votação do 2º Turno</span>
                      </button>
                    )}

                    {isVotingR2 && (
                      <button
                        type="button"
                        onClick={() => concludeElectionRound(election.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Encerrar &amp; Revelar Eleito</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quadro Final de Nomeações (Summary of elected slate) */}
      {concludedElections.length > 0 && (
        <div className="bg-white dark:bg-[#121722] rounded-2xl p-6 border border-[#9A7B3E]/40 dark:border-[#D4AF63]/40 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="w-5 h-5 text-[#9A7B3E] dark:text-[#D4AF63]" />
              <div>
                <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                  Quadro Final de Nomeações
                </h3>
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                  Relatório consolidado dos cargos preenchidos pela Comissão de Nomeações
                </p>
              </div>
            </div>
            <span className="font-mono-tabular text-xs font-semibold text-[#1B365D] dark:text-[#D4AF63]">
              {concludedElections.length} cargo(s) definido(s)
            </span>
          </div>

          <div className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838]">
            {concludedElections.map((el) => (
              <div key={el.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-[#14181F] dark:text-[#F1EFEA]">{el.ministryName}</span>
                  {el.assignedMembers.length > 0 && (
                    <span className="block text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                      Equipe integrada: {el.assignedMembers.join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {el.electedLeaderName}
                  </span>
                  <span className="block text-[10px] font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">
                    Eleito(a) no {el.round}º turno
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {electionToEdit && (
        <EditElectionModal
          election={electionToEdit}
          isOpen={Boolean(electionToEdit)}
          onClose={() => setElectionToEdit(null)}
        />
      )}
    </div>
  );
};
