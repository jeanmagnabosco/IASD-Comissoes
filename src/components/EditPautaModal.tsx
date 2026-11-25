import React, { useState, useEffect } from 'react';
import { PautaItem, PautaStatus } from '../types';
import { useChurch } from '../store/churchStore';
import { parseResolutionNumber, formatResolutionNumber } from '../utils/resolutionNumbering';
import { isSystemAdmin } from '../utils/roles';
import { 
  X, 
  Save, 
  Trash2, 
  RotateCcw, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Tag, 
  Clock, 
  Users,
  Sparkles,
  Hash
} from 'lucide-react';

interface Props {
  pauta: PautaItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditPautaModal: React.FC<Props> = ({ pauta, isOpen, onClose }) => {
  const { currentUser, updatePauta, deletePauta, resetPautaVotes, pautas } = useChurch();
  const canDeletePauta = isSystemAdmin(currentUser);

  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<PautaItem['categoria']>('Administrativo');
  const [relator, setRelator] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [propostaTexto, setPropostaTexto] = useState('');
  const [numeroResolucao, setNumeroResolucao] = useState('');
  const [status, setStatus] = useState<PautaStatus>('pautado');
  const [quorumRequerido, setQuorumRequerido] = useState(4);
  const [cascadeRenumber, setCascadeRenumber] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const pautaIndex = pautas.findIndex(p => p.id === pauta?.id);
  const isFirstPauta = pautaIndex === 0;
  const subsequentPautas = pautaIndex >= 0 ? pautas.slice(pautaIndex + 1) : [];

  useEffect(() => {
    if (pauta) {
      setTitulo(pauta.titulo);
      setCategoria(pauta.categoria);
      setRelator(pauta.relator);
      setJustificativa(pauta.justificativa || '');
      setPropostaTexto(pauta.propostaTexto);
      setNumeroResolucao(pauta.numeroResolucao || '');
      setStatus(pauta.status);
      setQuorumRequerido(pauta.quorumRequerido || 4);
      setCascadeRenumber(true);
      setConfirmDelete(false);
      setConfirmReset(false);
      setDeleteError(null);
    }
  }, [pauta, isOpen]);

  if (!isOpen || !pauta) return null;

  // Calculate live preview of subsequent items
  const getSubsequentPreview = () => {
    if (!numeroResolucao) return [];
    const parsed = parseResolutionNumber(numeroResolucao);
    if (!parsed) return [];

    return subsequentPautas.map((subPauta, i) => {
      const nextStr = formatResolutionNumber(parsed, i + 1);
      return { id: subPauta.id, titulo: subPauta.titulo, nextNum: nextStr };
    });
  };

  const previewList = getSubsequentPreview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !propostaTexto.trim()) return;

    await updatePauta(pauta.id, {
      titulo: titulo.trim(),
      categoria,
      relator: relator.trim(),
      justificativa: justificativa.trim(),
      propostaTexto: propostaTexto.trim(),
      numeroResolucao: numeroResolucao.trim() || undefined,
      status,
      quorumRequerido: Number(quorumRequerido)
    }, cascadeRenumber);

    onClose();
  };

  const handleResetVotes = async () => {
    await resetPautaVotes(pauta.id);
    setConfirmReset(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleteError(null);
    const res = await deletePauta(pauta.id);
    if (!res.success) {
      setDeleteError(res.message || 'Não foi possível excluir a proposta.');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Assunto da Pauta
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {pauta.titulo}
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
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título do Assunto
              </label>
              <input
                type="text"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Relator da Matéria
              </label>
              <input
                type="text"
                required
                value={relator}
                onChange={(e) => setRelator(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Número do Voto / Resolução
                </label>
                {isFirstPauta && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Voto Inicial (1ª Pauta)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={numeroResolucao}
                onChange={(e) => setNumeroResolucao(e.target.value)}
                placeholder="Ex: Voto nº 01/2026 ou 2026-001"
                className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {/* Presets */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Modelos:</span>
                {['Voto nº 01/2026', '2026-001', 'Voto 01', '1'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNumeroResolucao(preset)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 hover:text-indigo-700 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Atual
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="pautado">Pautado</option>
                <option value="em_leitura">Em Leitura</option>
                <option value="em_edicao">Em Edição</option>
                <option value="votacao_aberta">Votação Aberta</option>
                <option value="aprovado">Aprovado</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </div>
          </div>

          {/* Cascade Renumbering Option for Subsequent Pautas */}
          {subsequentPautas.length > 0 && (
            <div className={`p-4 rounded-2xl border space-y-2.5 transition-all ${
              isFirstPauta 
                ? 'bg-gradient-to-r from-indigo-50/90 to-purple-50/70 dark:from-indigo-950/50 dark:to-purple-950/30 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/10'
                : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
            }`}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cascadeRenumber}
                  onChange={(e) => setCascadeRenumber(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    {isFirstPauta && <Sparkles className="w-3.5 h-3.5 text-amber-500 inline" />}
                    {isFirstPauta 
                      ? 'Renumerar automaticamente todas as propostas seguintes em ordem sequencial'
                      : 'Renumerar automaticamente os assuntos subsequentes em ordem sequencial'}
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5 leading-relaxed">
                    {isFirstPauta ? (
                      <>Ao editar o número da <b>primeira proposta</b>, os demais <b>{subsequentPautas.length} assuntos pautados</b> acompanharão rigorosamente a sequência numeral ({numeroResolucao || '...'} &rarr; {previewList[0]?.nextNum || '...'}).</>
                    ) : (
                      <>As <b>{subsequentPautas.length} pautas seguintes</b> na lista acompanharão a sequência numeral iniciada neste voto.</>
                    )}
                  </span>
                </div>
              </label>

              {cascadeRenumber && previewList.length > 0 && (
                <div className="pt-2.5 border-t border-indigo-200/70 dark:border-indigo-800/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1.5 flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Ordem numeral gerada automaticamente para os próximos itens:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {previewList.map(item => (
                      <div
                        key={item.id}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/80 text-[11px] flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {item.nextNum}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 truncate text-[11px] text-right">
                          {item.titulo}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Justificativa
            </label>
            <input
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Texto da Proposta a Votar
            </label>
            <textarea
              rows={3}
              required
              value={propostaTexto}
              onChange={(e) => setPropostaTexto(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Reset Votes Action */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
            {confirmReset ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Zerar todos os votos desta pauta para nova votação?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleResetVotes}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    Confirmar &amp; Zerar Votos
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Controle de Votos ({Object.keys(pauta.votos || {}).length} votos registrados)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Permite reabrir deliberação ou realizar nova contagem
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Zerar Votos</span>
                </button>
              </div>
            )}
          </div>

          {/* Delete Pauta Zone (Strictly Administrator-Only) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {deleteError}
              </div>
            )}
            {canDeletePauta ? (
              confirmDelete ? (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Excluir permanentemente esta proposta da ordem do dia?
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Sim, Excluir Proposta
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir esta proposta da comissão</span>
                </button>
              )
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Exclusão de propostas permitida somente ao Administrador do sistema.
              </p>
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
              <span>Salvar Alterações da Pauta</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
