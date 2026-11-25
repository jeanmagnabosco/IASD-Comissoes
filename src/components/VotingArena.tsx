import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { MemberAvatar } from './MemberAvatar';
import { isSystemAdmin, isVotingMember } from '../utils/roles';
import {
  Check,
  X,
  Minus,
  Lock,
  ShieldCheck,
  Vote,
  Clock,
  CheckCircle2,
  StopCircle,
  EyeOff
} from 'lucide-react';

export const VotingArena: React.FC = () => {
  const {
    currentUser,
    users,
    pautas,
    activeVotingPautaId,
    castPautaVote,
    closePautaVoting
  } = useChurch();

  const [voteFeedback, setVoteFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeVotingPautaId) return null;

  const currentPauta = pautas.find(p => p.id === activeVotingPautaId);
  if (!currentPauta) return null;

  const presentVoters = users.filter(
    u => u.presenceStatus === 'presente' && isVotingMember(u)
  );
  const userHasVoted = currentUser ? Boolean(currentPauta.votos && currentPauta.votos[currentUser.id]) : false;
  const userExistingVote = currentUser && currentPauta.votos ? currentPauta.votos[currentUser.id] : null;

  const votosList = Object.values(currentPauta.votos || {});
  const totalVotesCast = votosList.length;
  const totalPossibleVoters = presentVoters.length || 1;
  const participationPercent = Math.min((totalVotesCast / totalPossibleVoters) * 100, 100);
  const majorityNeeded = Math.floor(totalPossibleVoters / 2) + 1;

  const isAdminOrPresident =
    currentUser?.role === 'presidente' || currentUser?.role === 'secretario' || isSystemAdmin(currentUser);

  const handleVote = async (choice: 'favor' | 'contra' | 'abstencao') => {
    if (userHasVoted || isSubmitting) return;
    setIsSubmitting(true);
    setVoteFeedback(null);

    const result = await castPautaVote(currentPauta.id, choice);
    setVoteFeedback(result.message);
    setIsSubmitting(false);
  };

  const handleCloseVoting = async () => {
    await closePautaVoting(currentPauta.id);
  };

  return (
    <div className="mb-8 relative overflow-hidden rounded-3xl bg-[#0B0E14] text-[#F1EFEA] shadow-2xl border border-[#D4AF63]/35 p-6 md:p-8 animate-fadeIn">
      {/* Subtle architectural brass hairline glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-72 h-72 bg-[#1B365D]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-72 h-72 bg-[#9A7B3E]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-widest text-[#D4AF63]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF63] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF63]" />
                </span>
                Votação Secreta em Curso
              </span>
              <span className="opacity-30">·</span>
              <span className="font-mono-tabular text-white/70">
                {currentPauta.numeroResolucao || 'Deliberação'}
              </span>
              <span className="opacity-30">·</span>
              <span className="text-white/60">{currentPauta.categoria}</span>
            </div>

            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-white">
              {currentPauta.titulo}
            </h2>
          </div>

          {isAdminOrPresident && (
            <button
              onClick={handleCloseVoting}
              className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-[#D4AF63] hover:bg-[#c39d52] text-[#0B0E14] text-xs font-bold shadow-lg flex items-center gap-2 transition cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              <span>Encerrar &amp; Revelar Resultado</span>
            </button>
          )}
        </div>

        {/* Proposal Body */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 md:p-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF63] block mb-1.5">
            Proposta em Deliberação
          </span>
          <p className="text-sm md:text-base text-[#F1EFEA]/90 leading-relaxed">
            {currentPauta.propostaTexto}
          </p>
        </div>

        {/* Ballot Casting Section */}
        <div className="p-5 rounded-2xl bg-[#121722] border border-white/10">
          {userHasVoted ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-emerald-300">
                    Seu voto sigiloso foi registrado
                  </p>
                  <p className="text-xs text-[#949BA8] mt-0.5">
                    Cédula registrada às{' '}
                    {userExistingVote ? new Date(userExistingVote.timestamp).toLocaleTimeString('pt-BR') : ''}.
                    O resultado consolidado será revelado automaticamente ao término da votação.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#D4AF63] font-mono-tabular flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Recibo: {userExistingVote?.signature?.slice(0, 14) || 'verificado'}</span>
              </div>
            </div>
          ) : !isVotingMember(currentUser) ? (
            <div className="text-center py-2 text-[#949BA8] text-xs">
              {currentUser?.role === 'administrador'
                ? 'Esta conta está configurada somente como Administrador do sistema (sem função votante). O Administrador pode assumir uma função na comissão pelo Painel de Controle.'
                : 'Membros observadores acompanham a sessão sem direito a voto deliberativo.'}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs md:text-sm font-medium text-[#F1EFEA]">
                  Registre seu voto secreto, <b>{currentUser?.name}</b>:
                </p>
                <span className="text-[11px] text-[#D4AF63] flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Escrutínio sigiloso até a conclusão</span>
                </span>
              </div>

              {voteFeedback && (
                <div className="mb-3 p-3 rounded-xl bg-white/5 text-xs text-[#F1EFEA] border border-white/15">
                  {voteFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleVote('favor')}
                  disabled={isSubmitting}
                  className="py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>A Favor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVote('contra')}
                  disabled={isSubmitting}
                  className="py-3.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-600 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                  <span>Contra</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVote('abstencao')}
                  disabled={isSubmitting}
                  className="py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                  <span>Abstenção</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Secret Ballot Participation Status (Tallies strictly hidden) */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-black/35 border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#D4AF63] flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Apuração Sigilosa · Participação do Quórum</span>
              </span>
              <span className="font-mono-tabular text-white/80">
                {totalVotesCast} de {totalPossibleVoters} votaram · Maioria: {majorityNeeded}
              </span>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#D4AF63] h-2 rounded-full transition-all duration-500"
                style={{ width: `${participationPercent}%` }}
              />
            </div>

            <p className="text-[11px] text-[#949BA8] flex items-center gap-1.5">
              <Vote className="w-3.5 h-3.5 text-[#D4AF63]" />
              <span>
                Os quantitativos de votos (A Favor / Contra / Abstenção) permanecem ocultos para todos até que todos os membros presentes votem ou o Presidente encerre a votação.
              </span>
            </p>
          </div>

          {/* Present Roll Call (Vote cast status only — choice never exposed) */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#949BA8] mb-2">
              Quórum Presente na Sessão:
            </p>
            <div className="flex flex-wrap gap-2">
              {presentVoters.map(voter => {
                const hasVoted = Boolean(currentPauta.votos && currentPauta.votos[voter.id]);
                return (
                  <div
                    key={voter.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition ${
                      hasVoted
                        ? 'bg-emerald-950/50 text-emerald-200 border-emerald-700/50'
                        : 'bg-white/[0.04] text-[#949BA8] border-white/10'
                    }`}
                  >
                    <MemberAvatar
                      name={voter.name}
                      src={voter.facialSnapshotDataUrl || voter.avatarUrl}
                      size="xs"
                    />
                    <span>{voter.name.split(' ')[0]}</span>
                    {hasVoted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-[#D4AF63]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
