import React, { useState, useEffect } from 'react';
import { useChurch } from '../store/churchStore';
import { 
  X, 
  Save, 
  Calendar, 
  MapPin, 
  FileText, 
  Clock, 
  Users, 
  UserCheck,
  CheckCircle,
  Church
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EditSessionModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentSession, updateSession, users } = useChurch();

  const [numeroAta, setNumeroAta] = useState('');
  const [titulo, setTitulo] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [local, setLocal] = useState('');
  const [presidenteNome, setPresidenteNome] = useState('');
  const [secretarioNome, setSecretarioNome] = useState('');
  const [customClosingNotes, setCustomClosingNotes] = useState('');

  useEffect(() => {
    if (currentSession) {
      setNumeroAta(currentSession.numeroAta);
      setTitulo(currentSession.titulo);
      // Format to datetime-local (YYYY-MM-DDTHH:mm)
      const dt = new Date(currentSession.dataHora);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      setDataHora(`${year}-${month}-${day}T${hours}:${minutes}`);
      
      setLocal(currentSession.local);
      setPresidenteNome(currentSession.presidenteNome);
      setSecretarioNome(currentSession.secretarioNome);
      setCustomClosingNotes(
        currentSession.customClosingNotes || 
        'Nada mais havendo a tratar, o Pastor Presidente encerrou os trabalhos com uma oração de gratidão e súplica pelas bênçãos sobre as decisões tomadas. Eu, Secretária da Comissão, lavrei a presente ata que, lida e achada conforme, vai assinada pela mesa e membros presentes.'
      );
    }
  }, [currentSession, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSession({
      numeroAta: numeroAta.trim(),
      titulo: titulo.trim(),
      dataHora: new Date(dataHora).toISOString(),
      local: local.trim(),
      presidenteNome: presidenteNome.trim(),
      secretarioNome: secretarioNome.trim(),
      customClosingNotes: customClosingNotes.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Dados da Reunião e Ata
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajuste datas, número da ata, local e mesa diretora
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
                Número Canônico da Ata
              </label>
              <input
                type="text"
                required
                value={numeroAta}
                onChange={(e) => setNumeroAta(e.target.value)}
                placeholder="Ex: ATA ORDINÁRIA Nº 04/2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data e Horário Oficial da Sessão
              </label>
              <input
                type="datetime-local"
                required
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título da Sessão da Comissão
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Comissão Administrativa da Igreja - Sessão Ordinária Trimestral"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Local / Plenário da Reunião
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Plenário da Igreja Central / Sala de Decisões"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Presidente da Comissão
              </label>
              <input
                type="text"
                required
                value={presidenteNome}
                onChange={(e) => setPresidenteNome(e.target.value)}
                placeholder="Pr. Jean Magnabosco"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Secretário(a) que Lavrou a Ata
              </label>
              <input
                type="text"
                required
                value={secretarioNome}
                onChange={(e) => setSecretarioNome(e.target.value)}
                placeholder="Débora Silveira"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Texto de Fechamento / Encerramento Canônico da Ata
            </label>
            <textarea
              rows={3}
              value={customClosingNotes}
              onChange={(e) => setCustomClosingNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
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
              <span>Salvar Dados da Ata</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
