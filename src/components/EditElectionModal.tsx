import React, { useState, useEffect } from 'react';
import { MinistryElection, Candidate } from '../types';
import { useChurch } from '../store/churchStore';
import { 
  X, 
  Save, 
  Trash2, 
  RotateCcw, 
  Award, 
  AlertTriangle, 
  PlusCircle, 
  Users, 
  CheckCircle 
} from 'lucide-react';

interface Props {
  election: MinistryElection | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditElectionModal: React.FC<Props> = ({ election, isOpen, onClose }) => {
  const { updateElection, deleteElection } = useChurch();

  const [ministryName, setMinistryName] = useState('');
  const [descricao, setDescricao] = useState('');
  const [autoIncorporate, setAutoIncorporate] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<MinistryElection['status']>('configuracao');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (election) {
      setMinistryName(election.ministryName);
      setDescricao(election.descricao || '');
      setAutoIncorporate(election.autoIncorporateOthersAsMembers);
      setCandidates(election.candidates);
      setStatus(election.status);
      setConfirmDelete(false);
    }
  }, [election, isOpen]);

  if (!isOpen || !election) return null;

  const handleCandidateNameChange = (id: string, newName: string) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
  };

  const handleAddCandidate = () => {
    const newCand: Candidate = {
      id: `cand-${election.id}-${Date.now()}`,
      name: '',
      round1Votes: 0,
      round2Votes: 0,
      status: 'pendente'
    };
    setCandidates(prev => [...prev, newCand]);
  };

  const handleRemoveCandidate = (id: string) => {
    if (candidates.length <= 2) return;
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryName.trim()) return;

    await updateElection(election.id, {
      ministryName: ministryName.trim(),
      descricao: descricao.trim(),
      autoIncorporateOthersAsMembers: autoIncorporate,
      candidates,
      status
    });

    onClose();
  };

  const handleResetElection = async () => {
    await updateElection(election.id, {
      status: 'configuracao',
      round: 1,
      votersWhoCastVoteRound1: [],
      votersWhoCastVoteRound2: [],
      electedLeaderId: undefined,
      electedLeaderName: undefined,
      assignedMembers: [],
      candidates: candidates.map(c => ({
        ...c,
        round1Votes: 0,
        round2Votes: 0,
        status: 'pendente'
      }))
    });
    onClose();
  };

  const handleDelete = async () => {
    await deleteElection(election.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Eleição de Ministério
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {election.ministryName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Ministério
              </label>
              <input
                type="text"
                required
                value={ministryName}
                onChange={(e) => setMinistryName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Eleitoral
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="configuracao">Configuração Inicial</option>
                <option value="votacao_turno_1">Votação 1º Turno</option>
                <option value="apuracao_turno_1">Apuração 1º Turno (2º Turno Definido)</option>
                <option value="votacao_turno_2">Votação 2º Turno</option>
                <option value="concluido">Eleição Concluída</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição / Mandato
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Candidates List Editable */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Candidatos Concorrentes ({candidates.length})
              </label>
              <button
                type="button"
                onClick={handleAddCandidate}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Adicionar Candidato</span>
              </button>
            </div>

            <div className="space-y-2">
              {candidates.map((cand, idx) => (
                <div key={cand.id} className="flex items-center gap-2">
                  <span className="w-6 text-center font-bold text-xs text-slate-400">{idx + 1}.</span>
                  <input
                    type="text"
                    required
                    value={cand.name}
                    onChange={(e) => handleCandidateNameChange(cand.id, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] font-mono text-slate-400 px-2">
                    {cand.round1Votes}v (T1) | {cand.round2Votes}v (T2)
                  </span>
                  {candidates.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCandidate(cand.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Auto incorporate option */}
          <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoIncorporate}
                onChange={(e) => setAutoIncorporate(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                Integrar automaticamente os candidatos não eleitos como membros da equipe do ministério
              </span>
            </label>
          </div>

          {/* Reset Election Votes */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Reiniciar Processo Eleitoral
              </p>
              <p className="text-[11px] text-slate-500">
                Zera os votos dos turnos 1 e 2 mantendo os candidatos cadastrados
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetElection}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar Votos</span>
            </button>
          </div>

          {/* Delete Danger Zone */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {confirmDelete ? (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Excluir permanentemente esta eleição de ministério?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                  >
                    Sim, Excluir Eleição
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir esta eleição ministerial</span>
              </button>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
