import React, { useState, useEffect } from 'react';
import { useChurch } from '../store/churchStore';
import { ApprovedAtaRecord } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { canSignAta, formatUserRoleSummary, getRoleLabel, isVotingMember } from '../utils/roles';
import {
  Vote,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Printer,
  Search,
  Check,
  Church,
  Award,
  Paperclip,
  CheckCircle,
  UserPlus,
  ScanFace,
  X,
  PenTool
} from 'lucide-react';

export const MemberPortal: React.FC = () => {
  const {
    currentUser,
    currentSession,
    pautas,
    elections,
    approvedAtas,
    accessLogs,
    recordAccess,
    castPautaVote,
    castElectionVote,
    addCandidateToElection,
    signArchivedAta,
    churchSettings,
    users,
    activeVotingPautaId
  } = useChurch();

  const [activeSubTab, setActiveSubTab] = useState<'pautas' | 'eleicoes' | 'atas' | 'acessos'>('pautas');
  const [selectedAta, setSelectedAta] = useState<ApprovedAtaRecord | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [modalSignMsg, setModalSignMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [votingFeedback, setVotingFeedback] = useState<{ [id: string]: string }>({});
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  // Member nomination inline form
  const [nominatingElectionId, setNominatingElectionId] = useState<string | null>(null);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeExp, setNomineeExp] = useState('');

  useEffect(() => {
    recordAccess('acesso_portal_membro', 'Acesso ao Portal dos Membros da Comissão');
  }, []);

  const sharedPautas = pautas.filter(p => p.compartilhadaComMembros === true);
  const sharedElections = elections.filter(e => e.compartilhadaComMembros === true);
  const presentVoters = users.filter(
    u => u.presenceStatus === 'presente' && isVotingMember(u)
  );

  const handleOpenAta = (ata: ApprovedAtaRecord) => {
    setSelectedAta(ata);
    setShowSignInModal(false);
    setModalSignMsg(null);
    recordAccess('leitura_ata', `Leitura da ${ata.numeroAta}`, ata.id);
  };

  const activeSelectedAta = selectedAta
    ? approvedAtas.find(a => a.id === selectedAta.id) || selectedAta
    : null;
  const userCanSignModalAta = canSignAta(currentUser, currentSession);

  const handlePautaVote = async (pautaId: string, choice: 'favor' | 'contra' | 'abstencao') => {
    if (!currentUser) return;
    setIsSubmittingVote(true);
    const res = await castPautaVote(pautaId, choice);
    setVotingFeedback(prev => ({ ...prev, [pautaId]: res.message }));
    setIsSubmittingVote(false);
    setTimeout(() => {
      setVotingFeedback(prev => {
        const next = { ...prev };
        delete next[pautaId];
        return next;
      });
    }, 4500);
  };

  const handleElectionVote = async (electionId: string, candidateId: string) => {
    if (!currentUser) return;
    setIsSubmittingVote(true);
    const res = await castElectionVote(electionId, candidateId);
    setVotingFeedback(prev => ({ ...prev, [electionId]: res.message }));
    setIsSubmittingVote(false);
    setTimeout(() => {
      setVotingFeedback(prev => {
        const next = { ...prev };
        delete next[electionId];
        return next;
      });
    }, 4500);
  };

  const handleMemberNomination = async (e: React.FormEvent, electionId: string) => {
    e.preventDefault();
    if (!nomineeName.trim()) return;
    await addCandidateToElection(electionId, nomineeName.trim(), nomineeExp.trim() || undefined, currentUser?.name);
    setNomineeName('');
    setNomineeExp('');
    setNominatingElectionId(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome & Member Context Banner */}
      <div className="bg-white dark:bg-[#121722] border border-[#E5E1D8] dark:border-[#1F2838] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <MemberAvatar
                name={currentUser?.name || 'Membro'}
                src={currentUser?.facialSnapshotDataUrl || currentUser?.avatarUrl}
                size="xl"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#121722] rounded-full" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold uppercase tracking-[0.18em] text-[#9A7B3E] dark:text-[#D4AF63]">
                  Área Exclusiva da Comissão
                </span>
                <span className="opacity-35">·</span>
                <span className="text-[#5A616E] dark:text-[#949BA8]">
                  {formatUserRoleSummary(currentUser)}
                </span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight">
                  {currentUser?.name}
                </h1>
                {currentUser?.username && (
                  <span className="font-mono-tabular text-xs text-[#1B365D] dark:text-[#D4AF63]">
                    @{currentUser.username}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#5A616E] dark:text-[#949BA8]">
                {currentUser?.ministry || 'Membro da Comissão'} · Sessão atual:{' '}
                <strong className="text-[#14181F] dark:text-[#F1EFEA] font-medium">
                  {currentSession.titulo}
                </strong>
              </p>
            </div>
          </div>

          {/* Access & Biometric Verification Summary */}
          <div className="flex flex-col items-start md:items-end gap-1.5 text-xs text-[#5A616E] dark:text-[#949BA8] bg-[#F7F6F2] dark:bg-[#0B0E14] p-4 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838]">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <ScanFace className="w-4 h-4" />
              <span>Reconhecimento Facial Verificado</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular">
              <Clock className="w-3.5 h-3.5 text-[#9A7B3E] dark:text-[#D4AF63]" />
              <span>
                {currentUser?.facialVerifiedAt
                  ? `Verificado em ${new Date(currentUser.facialVerifiedAt).toLocaleDateString('pt-BR')} às ${new Date(currentUser.facialVerifiedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : `Sessão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
            <div className="text-[11px]">Presidência: {currentSession.presidenteNome}</div>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="mt-7 pt-5 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('pautas')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'pautas'
                ? 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14]'
                : 'text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]'
            }`}
          >
            <Vote className="w-4 h-4" />
            <span>Pautas Compartilhadas ({sharedPautas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('eleicoes')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'eleicoes'
                ? 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14]'
                : 'text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Comissão de Nomeações ({sharedElections.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('atas')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'atas'
                ? 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14]'
                : 'text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Atas Canônicas Aprovadas ({approvedAtas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('acessos')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'acessos'
                ? 'bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14]'
                : 'text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Registro de Acessos ({accessLogs.length})</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PAUTAS COMPARTILHADAS */}
      {activeSubTab === 'pautas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Pautas Disponibilizadas pela Presidência
              </h2>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Matérias liberadas para leitura e voto secreto em comissão diretiva.
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">
              {sharedPautas.length} pauta(s) compartilhada(s)
            </span>
          </div>

          {sharedPautas.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#121722] rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-3">
              <Church className="w-10 h-10 text-[#9A7B3E]/60 dark:text-[#D4AF63]/60 mx-auto" />
              <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Nenhuma Pauta Compartilhada no Momento
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] max-w-md mx-auto">
                O Presidente ou Secretário ainda não liberou pautas para o plenário. Assim que compartilhadas, aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {sharedPautas.map((pauta) => {
                const userVote = currentUser ? pauta.votos[currentUser.id] : undefined;
                const isVotingOpen = pauta.status === 'votacao_aberta' || activeVotingPautaId === pauta.id;
                const hasVoted = !!userVote;
                const isResolved = Boolean(pauta.resultadoFinal) && !isVotingOpen;

                return (
                  <div
                    key={pauta.id}
                    className="bg-white dark:bg-[#121722] rounded-2xl p-6 border border-[#E5E1D8] dark:border-[#1F2838] space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap text-xs text-[#5A616E] dark:text-[#949BA8]">
                          <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                            {pauta.numeroResolucao || 'Ordem do Dia'}
                          </span>
                          <span className="opacity-35">·</span>
                          <span>{pauta.categoria}</span>
                          <span className="opacity-35">·</span>
                          <span>Relator: <strong className="font-medium text-[#14181F] dark:text-[#F1EFEA]">{pauta.relator}</strong></span>
                        </div>
                        <h3 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                          {pauta.titulo}
                        </h3>
                      </div>

                      <div className="text-xs font-semibold shrink-0">
                        {isVotingOpen ? (
                          <span className="inline-flex items-center gap-1.5 text-[#9A7B3E] dark:text-[#D4AF63]">
                            <span className="w-2 h-2 rounded-full bg-[#D4AF63] animate-pulse" />
                            Votação Secreta Aberta
                          </span>
                        ) : pauta.status === 'aprovado' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Aprovada em Plenário
                          </span>
                        ) : pauta.status === 'rejeitado' ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                            <XCircle className="w-4 h-4" />
                            Rejeitada
                          </span>
                        ) : (
                          <span className="text-[#5A616E] dark:text-[#949BA8]">
                            Aguardando Deliberação
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#F7F6F2] dark:bg-[#0B0E14] p-4 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-sm text-[#14181F] dark:text-[#F1EFEA]/90">
                      <span className="block text-[10px] uppercase tracking-[0.18em] text-[#5A616E] dark:text-[#949BA8] font-semibold mb-1">
                        Texto da Proposta
                      </span>
                      {pauta.propostaTexto}
                    </div>

                    {pauta.justificativa && (
                      <div className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                        <strong className="text-[#14181F] dark:text-[#F1EFEA]">Justificativa:</strong> {pauta.justificativa}
                      </div>
                    )}

                    {pauta.anexos && pauta.anexos.length > 0 && (
                      <div className="pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-[#5A616E] dark:text-[#949BA8] flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5" /> Anexos:
                        </span>
                        {pauta.anexos.map(anx => (
                          <div
                            key={anx.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[#F7F6F2] dark:bg-[#181F2D] text-[#1B365D] dark:text-[#D4AF63] font-medium flex items-center gap-1 border border-[#E5E1D8] dark:border-[#1F2838]"
                          >
                            <span>{anx.name}</span>
                            <span className="text-[10px] text-[#5A616E] dark:text-[#949BA8]">
                              ({(anx.sizeBytes / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Voting Ballot — tallies are strictly hidden while open */}
                    {isVotingOpen && (
                      <div className="pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] p-4 rounded-xl space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-1.5">
                              <EyeOff className="w-4 h-4 text-[#9A7B3E] dark:text-[#D4AF63]" />
                              <span>Cédula Secreta de Deliberação</span>
                            </h4>
                            <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                              A apuração só será exibida quando todos votarem ou ao encerramento pelo Presidente.
                            </p>
                          </div>

                          {hasVoted && (
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              Voto registrado ({userVote.choice.toUpperCase()})
                            </span>
                          )}
                        </div>

                        {!hasVoted && isVotingMember(currentUser) && (
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <button
                              type="button"
                              disabled={isSubmittingVote}
                              onClick={() => handlePautaVote(pauta.id, 'favor')}
                              className="py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>A Favor</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSubmittingVote}
                              onClick={() => handlePautaVote(pauta.id, 'contra')}
                              className="py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white transition cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Contra</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSubmittingVote}
                              onClick={() => handlePautaVote(pauta.id, 'abstencao')}
                              className="py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 bg-white dark:bg-[#121722] text-[#14181F] dark:text-[#F1EFEA] border border-[#E5E1D8] dark:border-[#1F2838] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
                            >
                              <AlertCircle className="w-4 h-4" />
                              <span>Abstenção</span>
                            </button>
                          </div>
                        )}

                        {votingFeedback[pauta.id] && (
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{votingFeedback[pauta.id]}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto-revealed result once voting is concluded */}
                    {isResolved && pauta.resultadoFinal && (
                      <div className="pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              pauta.resultadoFinal.aprovado ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-[#14181F] dark:text-[#F1EFEA]">
                            {pauta.resultadoFinal.aprovado ? 'Aprovado em Plenário' : 'Rejeitado em Plenário'}
                          </span>
                          <span className="opacity-35">·</span>
                          <span className="font-mono-tabular text-[#5A616E] dark:text-[#949BA8] font-normal">
                            {pauta.resultadoFinal.favor} a favor ({pauta.resultadoFinal.percentualFavor}%) ·{' '}
                            {pauta.resultadoFinal.contra} contra · {pauta.resultadoFinal.abstencao} abstenções
                          </span>
                        </div>
                        {hasVoted && (
                          <span className="text-[#5A616E] dark:text-[#949BA8]">
                            Seu voto: <strong className="uppercase">{userVote.choice}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ELEIÇÕES / COMISSÃO DE NOMEAÇÕES */}
      {activeSubTab === 'eleicoes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Comissão de Nomeações — Eleições Ministeriais
              </h2>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Indique nomes e registre seu voto sigiloso. Os votos individuais só são revelados ao concluir a votação.
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">
              {sharedElections.length} cargo(s) compartilhado(s)
            </span>
          </div>

          {sharedElections.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#121722] rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-3">
              <Award className="w-10 h-10 text-[#9A7B3E]/60 dark:text-[#D4AF63]/60 mx-auto" />
              <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Nenhuma Nomeação Compartilhada
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] max-w-md mx-auto">
                Quando a presidência liberar cargos ou ministérios para eleição, a cédula aparecerá automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {sharedElections.map((election) => {
                const isVotingOpen = election.status === 'votacao_turno_1' || election.status === 'votacao_turno_2';
                const isConcluded = election.status === 'concluido';
                const resultsRevealed = isConcluded || election.status === 'apuracao_turno_1';
                const currentRound = election.round;
                const votersWhoVoted =
                  currentRound === 1 ? election.votersWhoCastVoteRound1 : election.votersWhoCastVoteRound2;
                const alreadyVotedInRound = currentUser ? votersWhoVoted.includes(currentUser.id) : false;
                const canMemberNominate =
                  election.status === 'configuracao' &&
                  (election.allowMemberNomination || currentUser?.role === 'presidente' || currentUser?.role === 'secretario') &&
                  isVotingMember(currentUser);

                return (
                  <div
                    key={election.id}
                    className="bg-white dark:bg-[#121722] rounded-2xl p-6 sm:p-8 border border-[#E5E1D8] dark:border-[#1F2838] space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E5E1D8] dark:border-[#1F2838]">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9A7B3E] dark:text-[#D4AF63]">
                          Comissão de Nomeações · {election.round}º Turno
                        </span>
                        <h3 className="font-display text-2xl font-semibold text-[#14181F] dark:text-[#F1EFEA] mt-0.5">
                          {election.ministryName}
                        </h3>
                        <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">{election.descricao}</p>
                      </div>

                      <div className="text-xs font-semibold shrink-0">
                        {isConcluded ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Eleito(a): {election.electedLeaderName}
                          </span>
                        ) : isVotingOpen ? (
                          <div className="text-right space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 text-[#9A7B3E] dark:text-[#D4AF63]">
                              <EyeOff className="w-3.5 h-3.5" />
                              Votação Secreta ({votersWhoVoted.length}/{presentVoters.length})
                            </span>
                            <span className="block text-[11px] font-normal text-[#5A616E] dark:text-[#949BA8]">
                              Resultado oculto até encerramento
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#5A616E] dark:text-[#949BA8]">
                            Aguardando abertura pelo Presidente
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8]">
                          {isVotingOpen ? 'Escolha o indicado de sua preferência:' : 'Nomes Indicados:'}
                        </h4>

                        <div className="flex items-center gap-3">
                          {alreadyVotedInRound && (
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              Voto registrado neste turno
                            </span>
                          )}
                          {canMemberNominate && (
                            <button
                              type="button"
                              onClick={() =>
                                setNominatingElectionId(nominatingElectionId === election.id ? null : election.id)
                              }
                              className="text-xs font-semibold text-[#1B365D] dark:text-[#D4AF63] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Indicar Nome</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {nominatingElectionId === election.id && (
                        <form
                          onSubmit={(e) => handleMemberNomination(e, election.id)}
                          className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                        >
                          <div>
                            <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                              Nome Completo
                            </label>
                            <input
                              type="text"
                              required
                              value={nomineeName}
                              onChange={(e) => setNomineeName(e.target.value)}
                              placeholder="Nome do membro indicado..."
                              className="w-full px-3 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs text-[#14181F] dark:text-[#F1EFEA]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                              Qualificação / Área
                            </label>
                            <input
                              type="text"
                              value={nomineeExp}
                              onChange={(e) => setNomineeExp(e.target.value)}
                              placeholder="Observação ministerial..."
                              className="w-full px-3 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs text-[#14181F] dark:text-[#F1EFEA]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setNominatingElectionId(null)}
                              className="px-3 py-2 rounded-lg text-xs text-[#5A616E] dark:text-[#949BA8]"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="flex-1 px-3 py-2 rounded-lg bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold cursor-pointer"
                            >
                              Indicar
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {election.candidates.map((cand) => {
                          const isElected = election.electedLeaderId === cand.id;
                          const votesInRound = currentRound === 1 ? cand.round1Votes : cand.round2Votes;
                          const isDisabledR2 =
                            election.status === 'votacao_turno_2' && cand.status !== 'segundo_turno';

                          return (
                            <div
                              key={cand.id}
                              className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                                isElected
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/60'
                                  : isDisabledR2
                                  ? 'opacity-40 bg-[#F7F6F2] dark:bg-[#0B0E14] border-[#E5E1D8] dark:border-[#1F2838]'
                                  : 'bg-[#F7F6F2]/70 dark:bg-[#0B0E14]/60 border-[#E5E1D8] dark:border-[#1F2838]'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <MemberAvatar name={cand.name} size="sm" />
                                    <h5 className="font-semibold text-[#14181F] dark:text-[#F1EFEA] text-sm truncate">
                                      {cand.name}
                                    </h5>
                                  </div>
                                  {isElected && (
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                      ELEITO
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#5A616E] dark:text-[#949BA8] line-clamp-2">
                                  {cand.experiencia || 'Membro indicado pela comissão.'}
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between gap-2">
                                {/* STRICT SECRET BALLOT: NEVER show votesInRound while voting is open! */}
                                {resultsRevealed ? (
                                  <span className="text-xs font-mono-tabular font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                                    {votesInRound} voto(s)
                                  </span>
                                ) : isVotingOpen ? (
                                  <span className="text-[11px] text-[#9A7B3E] dark:text-[#D4AF63] flex items-center gap-1">
                                    <EyeOff className="w-3 h-3" /> Sigiloso
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                                    Aguardando
                                  </span>
                                )}

                                {isVotingOpen &&
                                  !alreadyVotedInRound &&
                                  !isDisabledR2 &&
                                  isVotingMember(currentUser) && (
                                    <button
                                      type="button"
                                      disabled={isSubmittingVote}
                                      onClick={() => handleElectionVote(election.id, cand.id)}
                                      className="px-3.5 py-1.5 rounded-lg bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:text-[#0B0E14] text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Vote className="w-3.5 h-3.5" />
                                      <span>Votar</span>
                                    </button>
                                  )}

                                {alreadyVotedInRound && isVotingOpen && (
                                  <span className="text-[11px] font-medium text-[#5A616E] dark:text-[#949BA8]">
                                    Cédula enviada
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {votingFeedback[election.id] && (
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{votingFeedback[election.id]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ATAS CANÔNICAS APROVADAS */}
      {activeSubTab === 'atas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Atas Canônicas Aprovadas da Comissão
              </h2>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Atas lavradas e aprovadas em plenário, disponíveis para consulta dos membros.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#5A616E] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por número ou título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs text-[#14181F] dark:text-[#F1EFEA] focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63]"
              />
            </div>
          </div>

          {approvedAtas.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#121722] rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-2">
              <FileText className="w-10 h-10 text-[#9A7B3E]/60 dark:text-[#D4AF63]/60 mx-auto" />
              <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Nenhuma Ata Aprovada Nesta Sessão
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] max-w-md mx-auto">
                Após a conclusão das votações e aprovação formal na aba &ldquo;Ata Canônica&rdquo;, o documento ficará arquivado aqui para leitura oficial.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvedAtas
                .filter(
                  a =>
                    a.numeroAta.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.titulo.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((ata) => (
                  <div
                    key={ata.id}
                    className="bg-white dark:bg-[#121722] rounded-2xl p-6 border border-[#E5E1D8] dark:border-[#1F2838] space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                          {ata.numeroAta}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovada e Lacrada
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                        {ata.titulo}
                      </h3>

                      <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                        Sessão em {new Date(ata.dataSessao).toLocaleDateString('pt-BR')} · Aprovada em{' '}
                        {new Date(ata.dataAprovacao).toLocaleDateString('pt-BR')}
                      </p>

                      <div className="text-xs text-[#5A616E] dark:text-[#949BA8] pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838]">
                        Presidente: <strong className="text-[#14181F] dark:text-[#F1EFEA]">{ata.presidenteNome}</strong> ·
                        Secretaria: <strong className="text-[#14181F] dark:text-[#F1EFEA]">{ata.secretarioNome}</strong>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838] flex items-center justify-between">
                      <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                        {ata.votosAprovados.length} resoluções · {ata.presentesNomes.length} presentes
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenAta(ata)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ler Ata Completa</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: REGISTRO DE ACESSOS E AUDITORIA */}
      {activeSubTab === 'acessos' && (
        <div className="bg-white dark:bg-[#121722] rounded-2xl p-6 sm:p-8 border border-[#E5E1D8] dark:border-[#1F2838] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E1D8] dark:border-[#1F2838]">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Registro Oficial de Acessos &amp; Biometria Facial
              </h2>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Todos os logins, verificações faciais, leituras de atas e registros de voto são gravados com data e hora.
              </p>
            </div>

            <span className="text-xs font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63]">
              {accessLogs.length} registro(s)
            </span>
          </div>

          {accessLogs.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#5A616E] dark:text-[#949BA8] italic">
              Nenhum registro de acesso nesta sessão ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E1D8] dark:border-[#1F2838] text-[#5A616E] dark:text-[#949BA8] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pr-4">Data &amp; Hora</th>
                    <th className="pb-3 pr-4">Membro</th>
                    <th className="pb-3 pr-4">Evento</th>
                    <th className="pb-3 pr-4">Detalhes</th>
                    <th className="pb-3">Terminal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838] text-[#14181F] dark:text-[#F1EFEA]">
                  {accessLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F7F6F2] dark:hover:bg-[#0B0E14]/50 transition">
                      <td className="py-3 pr-4 font-mono-tabular text-[11px] text-[#5A616E] dark:text-[#949BA8] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-semibold">{log.userName}</div>
                        <span className="text-[10px] text-[#5A616E] dark:text-[#949BA8]">
                          {getRoleLabel(log.userRole)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold">
                        {log.action === 'verificacao_facial' ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Reconhecimento Facial</span>
                        ) : log.action === 'leitura_ata' ? (
                          <span className="text-[#1B365D] dark:text-[#D4AF63]">Leitura de Ata</span>
                        ) : log.action === 'voto_registrado' ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Voto Registrado</span>
                        ) : log.action === 'login' ? (
                          <span className="text-[#9A7B3E] dark:text-[#D4AF63]">Autenticação</span>
                        ) : (
                          <span className="text-[#5A616E] dark:text-[#949BA8]">Acesso ao Portal</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[#5A616E] dark:text-[#949BA8]">
                        {log.resourceTitle || 'Navegação geral'}
                      </td>
                      <td className="py-3 text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                        {log.deviceInfo || 'Terminal Seguro'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FULL CANONICAL ATA READER MODAL */}
      {activeSelectedAta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E14]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#121722] border border-[#E5E1D8] dark:border-[#1F2838] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-10 space-y-6">
            <div className="flex items-start justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-4">
              <div>
                <span className="font-mono-tabular text-xs font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
                  Documento Canônico Oficial
                </span>
                <h2 className="font-display text-2xl font-semibold text-[#14181F] dark:text-[#F1EFEA] mt-1">
                  {activeSelectedAta.numeroAta}
                </h2>
                <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                  {activeSelectedAta.titulo} · Aprovada em {new Date(activeSelectedAta.dataAprovacao).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {userCanSignModalAta && (
                  <button
                    type="button"
                    onClick={() => setShowSignInModal(!showSignInModal)}
                    className="px-3 py-2 rounded-xl border border-[#1B365D]/40 dark:border-[#D4AF63]/40 text-[#1B365D] dark:text-[#D4AF63] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{showSignInModal ? 'Ocultar Quadro' : 'Assinar em Tela'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
                  title="Imprimir Ata"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAta(null)}
                  className="p-2 rounded-xl text-[#5A616E] hover:text-[#14181F] dark:hover:text-white hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {modalSignMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{modalSignMsg}</span>
              </div>
            )}

            {showSignInModal && userCanSignModalAta && currentUser && (
              <div className="p-5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838]">
                <DigitalSignaturePad
                  signerName={currentUser.name}
                  signerRoleLabel={
                    currentUser.role === 'secretario' || currentUser.id === currentSession.secretarioId
                      ? 'Secretário(a) da Comissão'
                      : currentUser.role === 'presidente' || currentUser.id === currentSession.presidenteId
                      ? 'Presidente da Comissão'
                      : `Membro Designado (${getRoleLabel(currentUser.role)})`
                  }
                  existingSignatureUrl={
                    activeSelectedAta.assinaturasDigitais.find(
                      s => s.signerId === currentUser.id || s.nome === currentUser.name
                    )?.signatureDataUrl
                  }
                  onConfirm={async (dataUrl, cargoLabel) => {
                    const res = await signArchivedAta(activeSelectedAta.id, dataUrl, cargoLabel);
                    if (res.success) {
                      setShowSignInModal(false);
                      setModalSignMsg('Sua assinatura digital foi registrada nesta ata.');
                      setTimeout(() => setModalSignMsg(null), 4000);
                    }
                    return res;
                  }}
                />
              </div>
            )}

            <div className="space-y-6 font-display text-[#14181F] dark:text-[#F1EFEA] leading-relaxed text-base bg-[#F7F6F2] dark:bg-[#0B0E14] p-6 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838]">
              <div className="text-center space-y-1 border-b border-[#E5E1D8] dark:border-[#1F2838] pb-4">
                <h3 className="font-semibold text-lg">{churchSettings.churchName}</h3>
                <p className="text-xs font-sans text-[#5A616E] dark:text-[#949BA8]">
                  {churchSettings.districtConference} · {activeSelectedAta.local}
                </p>
                <p className="text-xs font-sans font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
                  {activeSelectedAta.numeroAta}
                </p>
              </div>

              <div className="text-sm font-sans space-y-2">
                <p>
                  Aos <strong>{new Date(activeSelectedAta.dataSessao).toLocaleDateString('pt-BR')}</strong>, reuniu-se a comissão sob a presidência de <strong>{activeSelectedAta.presidenteNome}</strong> e secretariada por <strong>{activeSelectedAta.secretarioNome}</strong>.
                </p>
                <p>
                  <strong>Membros Presentes:</strong> {activeSelectedAta.presentesNomes.join(', ')}.
                </p>
              </div>

              <div className="space-y-3 font-sans pt-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8]">
                  Resoluções Aprovadas
                </h4>
                {activeSelectedAta.votosAprovados.map((voto, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white dark:bg-[#121722] rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                        {voto.numeroResolucao}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        {voto.resultado.percentualFavor}% favorável ({voto.resultado.favor}F / {voto.resultado.contra}C /{' '}
                        {voto.resultado.abstencao}A)
                      </span>
                    </div>
                    <div className="font-semibold text-sm">
                      {voto.titulo} ({voto.categoria})
                    </div>
                    <div className="text-xs text-[#5A616E] dark:text-[#949BA8]">{voto.propostaTexto}</div>
                  </div>
                ))}
              </div>

              {activeSelectedAta.eleicoesConcluidas && activeSelectedAta.eleicoesConcluidas.length > 0 && (
                <div className="space-y-2 font-sans pt-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8]">
                    Nomeações &amp; Eleições Concluídas
                  </h4>
                  {activeSelectedAta.eleicoesConcluidas.map((el, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white dark:bg-[#121722] rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-xs"
                    >
                      {el.ministryName} — Eleito(a): <strong>{el.electedLeaderName}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] font-sans space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSelectedAta.assinaturasDigitais.length === 0 ? (
                    <div className="sm:col-span-2 p-3 bg-white dark:bg-[#121722] rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-xs text-[#5A616E] dark:text-[#949BA8] italic">
                      Nenhuma assinatura digital manuscrita registrada nesta ata até o momento.
                    </div>
                  ) : (
                    activeSelectedAta.assinaturasDigitais.map((sig, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-[#121722] rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] text-xs space-y-1.5"
                      >
                        {sig.signatureDataUrl && (
                          <div className="h-14 flex items-center justify-center bg-white rounded-lg border border-[#E5E1D8] p-1">
                            <img
                              src={sig.signatureDataUrl}
                              alt={`Assinatura digital de ${sig.nome}`}
                              className="max-h-12 object-contain"
                            />
                          </div>
                        )}
                        <div className="font-semibold flex items-center justify-between">
                          <span>{sig.nome}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Assinada em tela</span>
                        </div>
                        <div className="text-[#5A616E] dark:text-[#949BA8] text-[11px]">{sig.cargo}</div>
                        <div className="text-[10px] font-mono-tabular text-[#5A616E] dark:text-[#949BA8]">
                          {new Date(sig.dataHora).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 bg-white dark:bg-[#121722] rounded-xl text-[11px] text-[#5A616E] font-mono-tabular flex items-center justify-between border border-[#E5E1D8] dark:border-[#1F2838]">
                  <span className="truncate">SHA-256: {activeSelectedAta.hashAta}</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E5E1D8] dark:border-[#1F2838]">
              <button
                type="button"
                onClick={() => setSelectedAta(null)}
                className="px-5 py-2 rounded-xl bg-[#1B365D] dark:bg-[#D4AF63] text-white dark:text-[#0B0E14] text-xs font-semibold transition cursor-pointer"
              >
                Fechar Leitura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
