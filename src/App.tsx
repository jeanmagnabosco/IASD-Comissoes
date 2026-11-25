/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChurchProvider, useChurch } from './store/churchStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { MeetingManager } from './components/MeetingManager';
import { VotingArena } from './components/VotingArena';
import { MinistryElections } from './components/MinistryElections';
import { MinutesGenerator } from './components/MinutesGenerator';
import { HistoryArchive } from './components/HistoryArchive';
import { AdminPanel } from './components/AdminPanel';
import { MemberPortal } from './components/MemberPortal';
import { isSystemAdmin } from './utils/roles';
import { WifiOff, ShieldCheck } from 'lucide-react';

const ALLOWED_TABS = new Set(['membro', 'pautas', 'eleicoes', 'ata', 'historico', 'admin']);

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('membro');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isOnline, currentSession, currentUser } = useChurch();
  const canOpenAdminPanel = isSystemAdmin(currentUser) || currentUser?.role === 'presidente';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ALLOWED_TABS.has(tabParam)) {
      if (tabParam === 'admin' && !canOpenAdminPanel) {
        setActiveTab('membro');
      } else {
        setActiveTab(tabParam);
      }
    }
  }, [canOpenAdminPanel]);

  const commissionLabel =
    currentSession.commissionType === 'nomeacoes' ? 'Comissão de Nomeações' : 'Comissão Diretiva';

  return (
    <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#0B0E14] text-[#14181F] dark:text-[#F1EFEA] flex font-sans transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col lg:pl-72 transition-all">
        <Header activeTab={activeTab} onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        {!isOnline && (
          <div className="bg-[#9A7B3E] text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>
              Modo Offline: pautas e votos permanecem armazenados localmente e serão sincronizados ao restabelecer a conexão.
            </span>
          </div>
        )}

        {/* Mandatory Credentials + Facial Recognition Gate */}
        <LoginModal />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <VotingArena />

          {activeTab === 'membro' && <MemberPortal />}
          {activeTab === 'pautas' && <MeetingManager />}
          {activeTab === 'eleicoes' && <MinistryElections />}
          {activeTab === 'ata' && <MinutesGenerator />}
          {activeTab === 'historico' && <HistoryArchive />}
          {activeTab === 'admin' && (canOpenAdminPanel ? <AdminPanel /> : <MemberPortal />)}
        </main>

        <footer className="border-t border-[#E5E1D8] dark:border-[#1F2838] bg-white/70 dark:bg-[#121722]/70 py-4 text-xs text-[#5A616E] dark:text-[#949BA8]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                IASD Comissões
              </span>
              <span className="opacity-35">·</span>
              <span>{commissionLabel}</span>
              <span className="opacity-35">·</span>
              <span>{currentSession.numeroAta}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Escrutínio Sigiloso &amp; Auditoria Canônica</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ChurchProvider>
      <MainContent />
    </ChurchProvider>
  );
}
