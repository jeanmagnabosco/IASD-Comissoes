import React, { useState } from 'react';
import { useChurch } from '../store/churchStore';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { canSignAta, getRoleLabel, isSystemAdmin } from '../utils/roles';
import {
  Search,
  FileSpreadsheet,
  Printer,
  CheckCircle,
  XCircle,
  ShieldCheck,
  EyeOff,
  FileText,
  PenTool,
  Trash2,
  Lock,
  AlertTriangle
} from 'lucide-react';

export const HistoryArchive: React.FC = () => {
  const {
    pautas,
    approvedAtas,
    currentUser,
    currentSession,
    signArchivedAta,
    deleteArchivedAta
  } = useChurch();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [signingAtaId, setSigningAtaId] = useState<string | null>(null);
  const [confirmDeleteAtaId, setConfirmDeleteAtaId] = useState<string | null>(null);
  const [ataFeedback, setAtaFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canDeleteAta = isSystemAdmin(currentUser);
  const userCanSign = canSignAta(currentUser, currentSession);

  const defaultCargoForSigner =
    currentUser?.role === 'secretario' || currentUser?.id === currentSession.secretarioId
      ? 'Secretário(a) da Comissão'
      : currentUser?.role === 'presidente' || currentUser?.id === currentSession.presidenteId
      ? 'Presidente da Comissão'
      : `Membro Designado (${getRoleLabel(currentUser?.role || 'membro')})`;

  const filteredPautas = pautas.filter(p => {
    const matchesSearch =
      p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.relator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.propostaTexto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.numeroResolucao && p.numeroResolucao.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = filterCategory === 'all' || p.categoria === filterCategory;
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleDeleteAta = async (ataId: string) => {
    setAtaFeedback(null);
    const res = await deleteArchivedAta(ataId);
    setConfirmDeleteAtaId(null);
    if (!res.success) {
      setAtaFeedback({ type: 'err', text: res.message || 'Não foi possível excluir a ata.' });
      return;
    }
    setAtaFeedback({ type: 'ok', text: 'Ata arquivada excluída pelo Administrador com sucesso.' });
    setTimeout(() => setAtaFeedback(null), 4500);
  };

  const exportAllToCSV = () => {
    const headers = [
      'Resolucao',
      'Titulo',
      'Categoria',
      'Relator',
      'Status',
      'Votos_Favor',
      'Votos_Contra',
      'Votos_Abstencao',
      'Percentual_Aprovacao',
      'Data'
    ];
    const rows = filteredPautas.map(p => {
      const revealed = p.status !== 'votacao_aberta' && Boolean(p.resultadoFinal);
      return [
        `"${p.numeroResolucao || '-'}"`,
        `"${p.titulo.replace(/"/g, '""')}"`,
        `"${p.categoria}"`,
        `"${p.relator}"`,
        `"${p.status}"`,
        revealed ? p.resultadoFinal?.favor || 0 : 0,
        revealed ? p.resultadoFinal?.contra || 0 : 0,
        revealed ? p.resultadoFinal?.abstencao || 0 : 0,
        `"${revealed ? p.resultadoFinal?.percentualFavor || 0 : 0}%"`,
        `"${new Date(p.dataPautada).toLocaleDateString('pt-BR')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Historico_Comissao_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9A7B3E] dark:text-[#D4AF63]">
            Acervo Institucional
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14181F] dark:text-[#F1EFEA] tracking-tight mt-0.5">
            Histórico de Atas &amp; Resoluções
          </h1>
          <p className="text-xs text-[#5A616E] dark:text-[#949BA8] mt-1">
            Consulte atas arquivadas, registre assinaturas digitais e exporte resoluções da comissão.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportAllToCSV}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] hover:bg-[#F1EFE9] text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {ataFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            ataFeedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {ataFeedback.type === 'ok' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{ataFeedback.text}</span>
          </div>
          <button type="button" onClick={() => setAtaFeedback(null)} className="text-[11px] underline cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Archived Canonical Atas Section */}
      <div className="bg-white dark:bg-[#121722] p-6 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#1F2838] pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1B365D] dark:text-[#D4AF63]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Atas Canônicas Arquivadas ({approvedAtas.length})
              </h2>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Documentos oficiais lacrados. Atas assinadas por outro membro não podem ser excluídas pelo Administrador.
              </p>
            </div>
          </div>
        </div>

        {approvedAtas.length === 0 ? (
          <p className="py-4 text-xs text-[#5A616E] dark:text-[#949BA8] italic text-center">
            Nenhuma ata canônica arquivada até o momento.
          </p>
        ) : (
          <div className="space-y-4">
            {approvedAtas.map(ata => {
              const signatures = ata.assinaturasDigitais || [];
              const otherSigners = signatures.filter(
                s => (s.signerId && s.signerId !== currentUser?.id) || (!s.signerId && s.nome !== currentUser?.name)
              );
              const isLockedAgainstDelete = otherSigners.length > 0;
              const isSigningThis = signingAtaId === ata.id;
              const myExistingSig = signatures.find(
                s => (s.signerId && s.signerId === currentUser?.id) || (!s.signerId && s.nome === currentUser?.name)
              );

              return (
                <div
                  key={ata.id}
                  className="p-5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                          {ata.numeroAta}
                        </span>
                        <span className="opacity-35">·</span>
                        <span className="text-[#5A616E] dark:text-[#949BA8] font-mono-tabular">
                          Aprovada em {new Date(ata.dataAprovacao).toLocaleString('pt-BR')}
                        </span>
                        <span className="opacity-35">·</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {ata.votosAprovados.length} resolução(ões)
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                        {ata.titulo}
                      </h3>
                      <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                        Presidência: <strong className="text-[#14181F] dark:text-[#F1EFEA]">{ata.presidenteNome}</strong> ·
                        Secretaria: <strong className="text-[#14181F] dark:text-[#F1EFEA]">{ata.secretarioNome}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {userCanSign && (
                        <button
                          type="button"
                          onClick={() => setSigningAtaId(isSigningThis ? null : ata.id)}
                          className="px-3 py-1.5 rounded-xl border border-[#1B365D]/40 dark:border-[#D4AF63]/40 bg-white dark:bg-[#121722] text-[#1B365D] dark:text-[#D4AF63] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>{isSigningThis ? 'Fechar Quadro' : myExistingSig ? 'Reassinar em Tela' : 'Assinar em Tela'}</span>
                        </button>
                      )}

                      {canDeleteAta && (
                        isLockedAgainstDelete ? (
                          <span
                            title={`Bloqueada: assinada por ${otherSigners.map(s => s.nome).join(', ')}`}
                            className="px-3 py-1.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-[#5A616E] dark:text-[#949BA8] text-xs font-medium flex items-center gap-1.5 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Protegida ({otherSigners.map(s => s.nome.split(' ')[0]).join(', ')})</span>
                          </span>
                        ) : confirmDeleteAtaId === ata.id ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAtaId(null)}
                              className="px-1.5 text-[#5A616E] hover:underline cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAta(ata.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-700 text-white font-semibold cursor-pointer"
                            >
                              Confirmar Exclusão
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAtaId(ata.id)}
                            className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir Ata</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Digital Signatures List */}
                  <div className="pt-3 border-t border-[#E5E1D8] dark:border-[#1F2838]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] mb-2">
                      Assinaturas Digitais Registradas ({signatures.length})
                    </p>
                    {signatures.length === 0 ? (
                      <p className="text-xs italic text-[#5A616E] dark:text-[#949BA8]">
                        Nenhuma assinatura digital registrada ainda — passível de exclusão pelo Administrador até ser assinada por outro membro.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {signatures.map((sig, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-white dark:bg-[#121722] border border-[#E5E1D8] dark:border-[#1F2838] space-y-1.5"
                          >
                            {sig.signatureDataUrl && (
                              <div className="h-14 flex items-center justify-center bg-white rounded-lg border border-[#E5E1D8] p-1">
                                <img
                                  src={sig.signatureDataUrl}
                                  alt={`Assinatura de ${sig.nome}`}
                                  className="max-h-12 object-contain"
                                />
                              </div>
                            )}
                            <p className="text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate">{sig.nome}</p>
                            <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] truncate">{sig.cargo}</p>
                            <p className="text-[10px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                              {new Date(sig.dataHora).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline Digital Signature Pad for this Archived Ata */}
                  {isSigningThis && currentUser && (
                    <div className="pt-4 border-t border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] p-4 rounded-xl">
                      <DigitalSignaturePad
                        signerName={currentUser.name}
                        signerRoleLabel={defaultCargoForSigner}
                        existingSignatureUrl={myExistingSig?.signatureDataUrl}
                        onConfirm={async (dataUrl, cargoLabel) => {
                          const res = await signArchivedAta(ata.id, dataUrl, cargoLabel);
                          if (res.success) {
                            setSigningAtaId(null);
                            setAtaFeedback({
                              type: 'ok',
                              text: `Assinatura digital registrada na ${ata.numeroAta}.`
                            });
                            setTimeout(() => setAtaFeedback(null), 4500);
                          }
                          return res;
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#121722] p-4 rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#5A616E]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, relator, número de voto..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-xs sm:text-sm focus:outline-none"
          />
        </div>

        <div className="w-full md:w-48">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-xs sm:text-sm focus:outline-none"
          >
            <option value="all">Todas Categorias</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Patrimônio">Patrimônio</option>
            <option value="Eclesiástico">Eclesiástico</option>
            <option value="Disciplinar">Disciplinar</option>
            <option value="Evangelismo">Evangelismo</option>
            <option value="Ministérios">Ministérios</option>
          </select>
        </div>

        <div className="w-full md:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] text-xs sm:text-sm focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="aprovado">Aprovado</option>
            <option value="rejeitado">Rejeitado</option>
            <option value="votacao_aberta">Em Votação</option>
            <option value="em_leitura">Em Leitura</option>
            <option value="pautado">Pautado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#121722] rounded-2xl border border-[#E5E1D8] dark:border-[#1F2838] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#5A616E] dark:text-[#949BA8] font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Resolução</th>
                <th className="py-3 px-4">Assunto &amp; Relator</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Resultado</th>
                <th className="py-3 px-4 text-right">Integridade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D8] dark:divide-[#1F2838]">
              {filteredPautas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5A616E] text-xs italic">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredPautas.map((p) => {
                  const isOpenVoting = p.status === 'votacao_aberta';
                  const hasResult = !isOpenVoting && Boolean(p.resultadoFinal);
                  return (
                    <tr key={p.id} className="hover:bg-[#F7F6F2]/70 dark:hover:bg-[#0B0E14]/50 transition">
                      <td className="py-3.5 px-4 font-mono-tabular font-semibold text-[#1B365D] dark:text-[#D4AF63] whitespace-nowrap">
                        {p.numeroResolucao || 'Em aberto'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-semibold text-[#14181F] dark:text-[#F1EFEA] truncate">{p.titulo}</p>
                        <p className="text-[11px] text-[#5A616E] dark:text-[#949BA8] truncate">
                          Relator: {p.relator}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#5A616E] dark:text-[#949BA8]">
                        {p.categoria}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#5A616E] dark:text-[#949BA8] text-xs font-mono-tabular">
                        {new Date(p.dataPautada).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold">
                        {p.status === 'aprovado' && (
                          <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Aprovado
                          </span>
                        )}
                        {p.status === 'rejeitado' && (
                          <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Rejeitado
                          </span>
                        )}
                        {p.status !== 'aprovado' && p.status !== 'rejeitado' && (
                          <span className="text-[#5A616E] dark:text-[#949BA8]">{p.status}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {isOpenVoting ? (
                          <span className="text-[#9A7B3E] dark:text-[#D4AF63] flex items-center gap-1 font-medium">
                            <EyeOff className="w-3.5 h-3.5" /> Sigiloso
                          </span>
                        ) : hasResult ? (
                          <span className="font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]">
                            {p.resultadoFinal?.favor}F / {p.resultadoFinal?.contra}C ({p.resultadoFinal?.percentualFavor}%)
                          </span>
                        ) : (
                          <span className="text-[#5A616E] dark:text-[#949BA8]">Não votado</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>SHA-256</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
