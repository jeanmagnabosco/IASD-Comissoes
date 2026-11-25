import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  PautaItem,
  MeetingSession,
  MinistryElection,
  AuditLog,
  AttachmentFile,
  PautaStatus,
  Candidate,
  ChurchSettings,
  ApprovedAtaRecord,
  AccessLog,
  CommissionMode,
  UserRole,
  AtaSignatureRecord
} from '../types';
import { computeSha256 } from '../services/cryptoService';
import { isSystemAdmin, isVotingMember, getRoleLabel } from '../utils/roles';
import { parseResolutionNumber, formatResolutionNumber } from '../utils/resolutionNumbering';
import confetti from 'canvas-confetti';

export interface NewUserPayload {
  name: string;
  email: string;
  username: string;
  password: string;
  role: UserRole;
  isAdmin?: boolean;
  ministry?: string;
  phone?: string;
  presenceStatus?: 'presente' | 'ausente' | 'remoto';
  accountActive?: boolean;
  mustChangePassword?: boolean;
}

export interface UpdateUserPayload extends Partial<User> {
  newPassword?: string;
}

interface ChurchContextType {
  currentUser: User | null;
  users: User[];
  currentSession: MeetingSession;
  pautas: PautaItem[];
  elections: MinistryElection[];
  auditLogs: AuditLog[];
  approvedAtas: ApprovedAtaRecord[];
  accessLogs: AccessLog[];
  isOnline: boolean;
  darkMode: boolean;
  activeVotingPautaId: string | null;
  activeVotingElectionId: string | null;
  isAuthenticated: boolean;
  isBiometricAuthenticated: boolean;
  is2FAVerified: boolean;
  needsAdminSetup: boolean;
  bootstrapStatusLoaded: boolean;
  slackWebhookUrl: string;
  slackConnected: boolean;
  notificationsEnabled: boolean;

  // Access, Facial Verification & Sharing Control
  recordAccess: (action: AccessLog['action'], resourceTitle?: string, resourceId?: string) => Promise<void>;
  approveAndArchiveCurrentAta: () => Promise<ApprovedAtaRecord>;
  toggleSharePautaWithMembers: (pautaId: string) => Promise<void>;
  toggleShareElectionWithMembers: (electionId: string) => Promise<void>;
  bootstrapAdminAccount: (data: {
    name: string;
    email: string;
    username: string;
    password: string;
    role?: UserRole;
  }) => Promise<{ success: boolean; message?: string }>;
  changeOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  submitFaceForPresidentApproval: (
    snapshotDataUrl: string | null,
    method: 'camera' | 'webauthn' | 'verificacao_dispositivo'
  ) => Promise<{ success: boolean; hash: string; autoAuthorized: boolean; message?: string }>;
  verifyFacialRecognition: (
    snapshotDataUrl: string | null,
    method: 'camera' | 'webauthn' | 'verificacao_dispositivo'
  ) => Promise<{ success: boolean; hash: string; message?: string }>;
  authorizeMemberFace: (userId: string) => Promise<{ success: boolean; message?: string }>;
  rejectMemberFace: (userId: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
  revokeMemberFace: (userId: string) => Promise<{ success: boolean; message?: string }>;
  refreshUsersFromStorage: () => Promise<void>;
  resetAllVotesAndTestData: () => Promise<{ success: boolean; message?: string }>;
  setCommissionType: (mode: CommissionMode) => void;

  // Auth Actions
  loginWithCredentials: (
    loginIdentifier: string,
    passwordInput: string
  ) => Promise<{ success: boolean; message: string; user?: User; mustChangePassword?: boolean }>;
  verifyBiometrics: () => Promise<boolean>;
  verify2FA: (code: string) => boolean;
  logout: () => Promise<void>;
  setDarkMode: (enabled: boolean) => void;
  setSlackWebhookUrl: (url: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
  sendPushNotification: (title: string, body: string) => void;
  notifySlack: (text: string) => Promise<boolean>;

  // Pautas & Meetings (Comissão Diretiva)
  addPauta: (
    pauta: Omit<PautaItem, 'id' | 'status' | 'observacoes' | 'anexos' | 'votos' | 'dataPautada'>,
    files?: AttachmentFile[]
  ) => Promise<void>;
  updatePautaStatus: (pautaId: string, newStatus: PautaStatus) => Promise<void>;
  addPautaObservation: (pautaId: string, comment: string, suggestedRevision?: string) => Promise<void>;
  updatePautaProposta: (pautaId: string, updatedProposta: string) => Promise<void>;
  startPautaVoting: (pautaId: string) => Promise<void>;
  castPautaVote: (
    pautaId: string,
    choice: 'favor' | 'contra' | 'abstencao'
  ) => Promise<{ success: boolean; message: string; autoConcluded?: boolean }>;
  closePautaVoting: (pautaId: string) => Promise<void>;
  updateSession: (partial: Partial<MeetingSession>) => void;

  // Attachments
  addAttachmentToPauta: (pautaId: string, file: AttachmentFile) => Promise<void>;

  // Comissão de Nomeações / Eleições Ministeriais
  createElection: (
    ministryName: string,
    descricao: string,
    candidateNames: string[],
    autoIncorporateOthersAsMembers: boolean,
    allowMemberNomination?: boolean
  ) => Promise<void>;
  addCandidateToElection: (
    electionId: string,
    name: string,
    experiencia?: string,
    indicadoPor?: string
  ) => Promise<void>;
  updateCandidateAcceptance: (
    electionId: string,
    candidateId: string,
    status: 'pendente' | 'aceito' | 'recusado'
  ) => Promise<void>;
  startElectionVoting: (electionId: string, round: 1 | 2) => Promise<void>;
  castElectionVote: (
    electionId: string,
    candidateId: string
  ) => Promise<{ success: boolean; message: string; autoConcluded?: boolean }>;
  concludeElectionRound: (electionId: string) => Promise<void>;

  // Strict Administrator-Only User Management
  updateUser: (userId: string, partial: UpdateUserPayload) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  addNewUser: (user: NewUserPayload) => Promise<{ success: boolean; message?: string; user?: User }>;
  toggleUserPresence: (userId: string) => Promise<void>;

  // Agenda, Ata Signatures & Settings Management
  updatePauta: (pautaId: string, partial: Partial<PautaItem>, cascadeRenumber?: boolean) => Promise<void>;
  deletePauta: (pautaId: string) => Promise<{ success: boolean; message?: string }>;
  resetPautaVotes: (pautaId: string) => Promise<void>;
  renumberAllPautas: (startFormatOrNumber?: string) => Promise<void>;
  setFirstPautaResolutionNumber: (newPattern: string) => Promise<void>;
  updateElection: (electionId: string, partial: Partial<MinistryElection>) => Promise<void>;
  deleteElection: (electionId: string) => Promise<void>;
  signCurrentAta: (signatureDataUrl: string, cargoLabel?: string) => Promise<{ success: boolean; message?: string }>;
  signArchivedAta: (ataId: string, signatureDataUrl: string, cargoLabel?: string) => Promise<{ success: boolean; message?: string }>;
  toggleDesignatedSigner: (userId: string) => Promise<void>;
  deleteCurrentAta: () => Promise<{ success: boolean; message?: string }>;
  deleteArchivedAta: (ataId: string) => Promise<{ success: boolean; message?: string }>;
  churchSettings: ChurchSettings;
  updateChurchSettings: (partial: Partial<ChurchSettings>) => void;
}

const DEFAULT_SESSION: MeetingSession = {
  id: 'sess-2026-001',
  numeroAta: 'ATA ORDINÁRIA Nº 01/2026',
  titulo: 'Comissão Diretiva da Igreja — Sessão Ordinária',
  commissionType: 'diretiva',
  dataHora: new Date().toISOString(),
  local: 'Sala da Comissão Administrativa · Igreja Central',
  presidenteId: 'user-pr',
  presidenteNome: 'Pr. Jean Magnabosco',
  secretarioId: 'user-sec',
  secretarioNome: 'Débora Silveira',
  presentesIds: [],
  status: 'em_andamento',
  pautasIds: [],
  ataAprovada: false,
  designatedSignersIds: [],
  signatures: []
};

const DEFAULT_CHURCH_SETTINGS: ChurchSettings = {
  churchName: 'Igreja Adventista do Sétimo Dia Central',
  churchAddress: 'Av. das Nações, 1500 — Plenário Administrativo',
  districtConference: 'Associação Central das Igrejas',
  quorumPercentage: 50,
  autoNumberResolutions: true,
  resolutionPrefix: 'Voto nº'
};

const ChurchContext = createContext<ChurchContextType | null>(null);

export const ChurchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Token de sessão mantido exclusivamente em memória (nunca em localStorage/sessionStorage)
  const tokenRef = useRef<string | null>(null);
  const lastMutationAtRef = useRef<number>(0);

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isBiometricAuthenticated, setIsBiometricAuthenticated] = useState<boolean>(false);
  const [is2FAVerified, setIs2FAVerified] = useState<boolean>(false);
  const [needsAdminSetup, setNeedsAdminSetup] = useState<boolean>(false);
  const [bootstrapStatusLoaded, setBootstrapStatusLoaded] = useState<boolean>(false);

  const [currentSession, setCurrentSession] = useState<MeetingSession>(DEFAULT_SESSION);
  const [pautas, setPautas] = useState<PautaItem[]>([]);
  const [elections, setElections] = useState<MinistryElection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvedAtas, setApprovedAtas] = useState<ApprovedAtaRecord[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [churchSettings, setChurchSettings] = useState<ChurchSettings>(DEFAULT_CHURCH_SETTINGS);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('iasd_dark_mode') === 'true';
  });

  const [activeVotingPautaId, setActiveVotingPautaId] = useState<string | null>(null);
  const [activeVotingElectionId, setActiveVotingElectionId] = useState<string | null>(null);

  const [slackWebhookUrl, setSlackWebhookUrlState] = useState<string>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('iasd_slack_webhook') || '' : '';
  });
  const [slackConnected, setSlackConnected] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined)
    };
    if (tokenRef.current) {
      headers.Authorization = `Bearer ${tokenRef.current}`;
    }
    return fetch(url, { ...options, headers });
  }, []);

  // Wipe any legacy browser storage credentials/tokens on startup
  useEffect(() => {
    try {
      const legacyKeys = [
        'eclesia_diretiva_nomeacoes_v2_users',
        'eclesia_diretiva_nomeacoes_v2_active_user',
        'eclesia_diretiva_nomeacoes_v2_pautas',
        'eclesia_diretiva_nomeacoes_v2_elections',
        'eclesia_diretiva_nomeacoes_v2_session',
        'eclesia_diretiva_nomeacoes_v2_audit',
        'eclesia_diretiva_nomeacoes_v2_approved_atas',
        'eclesia_diretiva_nomeacoes_v2_access_logs',
        'iasd_comissoes_v3_users',
        'iasd_comissoes_v3_active_user',
        'iasd_comissoes_v3_pautas',
        'iasd_comissoes_v3_elections',
        'iasd_comissoes_v3_session',
        'iasd_comissoes_v3_audit',
        'iasd_comissoes_v3_approved_atas',
        'iasd_comissoes_v3_access_logs'
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('eclesia_facial_verified_v2');
      sessionStorage.removeItem('iasd_facial_verified_v3');
    } catch {
      // ignore storage access issues
    }
  }, []);

  // Check initial Administrator setup status
  useEffect(() => {
    let active = true;
    fetch('/api/auth/bootstrap-status')
      .then(res => res.json())
      .then(data => {
        if (active) {
          setNeedsAdminSetup(Boolean(data?.needsAdminSetup));
          setBootstrapStatusLoaded(true);
        }
      })
      .catch(() => {
        if (active) setBootstrapStatusLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('iasd_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('iasd_dark_mode', 'false');
    }
  }, [darkMode]);

  const applyCommissionPayload = useCallback((data: any) => {
    if (!data) return;
    if (Array.isArray(data.users)) {
      setUsers(data.users);
      setCurrentUser(prev => {
        if (!prev) return prev;
        const fresh = data.users.find((u: User) => u.id === prev.id);
        return fresh || prev;
      });
    }
    if (data.currentSession) setCurrentSession(data.currentSession);
    if (Array.isArray(data.pautas)) {
      setPautas(data.pautas);
      const openPauta = data.pautas.find((p: PautaItem) => p.status === 'votacao_aberta');
      setActiveVotingPautaId(openPauta?.id || null);
    }
    if (Array.isArray(data.elections)) {
      setElections(data.elections);
      const openEl = data.elections.find(
        (e: MinistryElection) => e.status === 'votacao_turno_1' || e.status === 'votacao_turno_2'
      );
      setActiveVotingElectionId(openEl?.id || null);
    }
    if (Array.isArray(data.approvedAtas)) setApprovedAtas(data.approvedAtas);
    if (Array.isArray(data.accessLogs)) setAccessLogs(data.accessLogs);
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    if (data.churchSettings) setChurchSettings(data.churchSettings);
  }, []);

  const fetchCommissionState = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await apiFetch('/api/commission');
      if (res.ok) {
        const data = await res.json();
        if (Date.now() - lastMutationAtRef.current > 1500) {
          applyCommissionPayload(data);
        }
      } else if (res.status === 401) {
        tokenRef.current = null;
        setIsAuthenticated(false);
        setIsBiometricAuthenticated(false);
        setIs2FAVerified(false);
        setCurrentUser(null);
      }
    } catch {
      // offline or transient failure
    }
  }, [apiFetch, applyCommissionPayload]);

  const syncCommissionToServer = useCallback(
    async (override?: {
      currentSession?: MeetingSession;
      pautas?: PautaItem[];
      elections?: MinistryElection[];
      approvedAtas?: ApprovedAtaRecord[];
      accessLogs?: AccessLog[];
      auditLogs?: AuditLog[];
      churchSettings?: ChurchSettings;
    }) => {
      if (!tokenRef.current) return;
      lastMutationAtRef.current = Date.now();
      try {
        await apiFetch('/api/commission', {
          method: 'PUT',
          body: JSON.stringify({
            currentSession: override?.currentSession ?? currentSession,
            pautas: override?.pautas ?? pautas,
            elections: override?.elections ?? elections,
            approvedAtas: override?.approvedAtas ?? approvedAtas,
            accessLogs: override?.accessLogs ?? accessLogs,
            auditLogs: override?.auditLogs ?? auditLogs,
            churchSettings: override?.churchSettings ?? churchSettings
          })
        });
      } catch {
        // ignore transient network errors
      }
    },
    [apiFetch, currentSession, pautas, elections, approvedAtas, accessLogs, auditLogs, churchSettings]
  );

  // Load commission state once authenticated + facial verified, and poll every 4s
  useEffect(() => {
    if (!isAuthenticated || !isBiometricAuthenticated) return;
    fetchCommissionState();
    const timer = setInterval(fetchCommissionState, 4000);
    return () => clearInterval(timer);
  }, [isAuthenticated, isBiometricAuthenticated, fetchCommissionState]);

  const addAuditLog = async (
    action: string,
    details: string,
    actor?: User | null,
    explicitLogs?: AuditLog[]
  ): Promise<AuditLog[]> => {
    const who = actor || currentUser;
    const timestamp = new Date().toISOString();
    const hash = await computeSha256(`${who?.name || 'Sistema'}|${action}|${details}|${timestamp}`);
    const newLog: AuditLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp,
      userId: who?.id || 'sys',
      userName: who?.name || 'Sistema IASD Comissões',
      action,
      details,
      encryptedHash: hash
    };
    const next = [newLog, ...(explicitLogs ?? auditLogs).slice(0, 199)];
    setAuditLogs(next);
    return next;
  };

  const recordAccess = async (
    action: AccessLog['action'],
    resourceTitle?: string,
    resourceId?: string,
    actor?: User | null
  ) => {
    const who = actor || currentUser;
    const timestamp = new Date().toISOString();
    const newLog: AccessLog = {
      id: 'acc-' + Math.random().toString(36).substring(2, 9),
      timestamp,
      userId: who?.id || 'anonimo',
      userName: who?.name || 'Membro da Comissão',
      userRole: who?.role || 'membro',
      action,
      resourceTitle,
      resourceId,
      deviceInfo:
        typeof navigator !== 'undefined'
          ? navigator.userAgent.includes('Mobile')
            ? 'Dispositivo Móvel'
            : 'Navegador Seguro'
          : 'Terminal'
    };
    const next = [newLog, ...accessLogs.slice(0, 299)];
    setAccessLogs(next);
    if (isBiometricAuthenticated) {
      await syncCommissionToServer({ accessLogs: next });
    }
  };

  const setDarkMode = (enabled: boolean) => {
    setDarkModeState(enabled);
  };

  const setSlackWebhookUrl = (url: string) => {
    setSlackWebhookUrlState(url);
    localStorage.setItem('iasd_slack_webhook', url);
    if (url.trim()) {
      setSlackConnected(true);
      notifySlack('🔔 *IASD Comissões*: Canal da Comissão conectado com sucesso.');
    } else {
      setSlackConnected(false);
    }
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        const granted = perm === 'granted';
        setNotificationsEnabled(granted);
        return granted;
      } catch {
        return false;
      }
    }
    return false;
  };

  const sendPushNotification = (title: string, body: string) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch {
        // ignore
      }
    }
  };

  const notifySlack = async (text: string): Promise<boolean> => {
    if (!slackWebhookUrl) return false;
    try {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        mode: 'no-cors'
      });
      return true;
    } catch {
      return true;
    }
  };

  const bootstrapAdminAccount = async (data: {
    name: string;
    email: string;
    username: string;
    password: string;
    role?: UserRole;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, message: json.error || 'Falha ao configurar Administrador.' };
      }

      tokenRef.current = json.token;
      setCurrentUser(json.user);
      setIsAuthenticated(true);
      setIsBiometricAuthenticated(Boolean(json.facialVerified));
      setIs2FAVerified(Boolean(json.facialVerified));
      setNeedsAdminSetup(false);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão com o servidor ao configurar Administrador.' };
    }
  };

  const loginWithCredentials = async (
    loginIdentifier: string,
    passwordInput: string
  ): Promise<{ success: boolean; message: string; user?: User; mustChangePassword?: boolean }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: passwordInput
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: data.error || 'Usuário ou senha inválidos.'
        };
      }

      tokenRef.current = data.token;
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setIsBiometricAuthenticated(false);
      setIs2FAVerified(false);

      return {
        success: true,
        message: data.mustChangePassword
          ? 'Defina sua nova senha pessoal para prosseguir.'
          : 'Credenciais confirmadas. Conclua o reconhecimento facial para acessar.',
        user: data.user,
        mustChangePassword: Boolean(data.mustChangePassword)
      };
    } catch {
      return {
        success: false,
        message: 'Falha de conexão com o servidor de autenticação.'
      };
    }
  };

  const changeOwnPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Não foi possível alterar a senha.' };
      }
      setCurrentUser(data.user);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de rede ao atualizar senha.' };
    }
  };

  const refreshUsersFromStorage = async () => {
    if (!tokenRef.current) return;
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          setUsers(prev => {
            const exists = prev.some(u => u.id === data.user.id);
            return exists ? prev.map(u => (u.id === data.user.id ? data.user : u)) : prev;
          });
        }
      }
    } catch {
      // ignore
    }
  };

  const submitFaceForPresidentApproval = async (
    snapshotDataUrl: string | null,
    method: 'camera' | 'webauthn' | 'verificacao_dispositivo'
  ): Promise<{ success: boolean; hash: string; autoAuthorized: boolean; message?: string }> => {
    try {
      const res = await apiFetch('/api/faces/submit', {
        method: 'POST',
        body: JSON.stringify({ snapshotDataUrl, method })
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          hash: '',
          autoAuthorized: false,
          message: data.error || 'Falha ao enviar captura facial.'
        };
      }

      if (data.user) setCurrentUser(data.user);
      if (data.facialVerified) {
        setIsBiometricAuthenticated(true);
        setIs2FAVerified(true);
        await fetchCommissionState();
      } else {
        setIsBiometricAuthenticated(false);
        setIs2FAVerified(false);
      }

      return {
        success: true,
        hash: data.hash || '',
        autoAuthorized: Boolean(data.autoAuthorized)
      };
    } catch {
      return { success: false, hash: '', autoAuthorized: false, message: 'Erro de conexão com o servidor.' };
    }
  };

  const verifyFacialRecognition = async (
    snapshotDataUrl: string | null,
    method: 'camera' | 'webauthn' | 'verificacao_dispositivo'
  ): Promise<{ success: boolean; hash: string; message?: string }> => {
    if (!currentUser) return { success: false, hash: '' };

    const canVerifyDirectly =
      currentUser.role === 'presidente' ||
      isSystemAdmin(currentUser) ||
      currentUser.facialAuthorizationStatus === 'autorizada';

    if (!canVerifyDirectly) {
      const submitted = await submitFaceForPresidentApproval(snapshotDataUrl, method);
      return {
        success: submitted.autoAuthorized,
        hash: submitted.hash,
        message: submitted.message
      };
    }

    try {
      const res = await apiFetch('/api/faces/verify', {
        method: 'POST',
        body: JSON.stringify({ snapshotDataUrl, method })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, hash: '', message: data.error || 'Verificação facial recusada.' };
      }

      if (data.user) setCurrentUser(data.user);
      setIsBiometricAuthenticated(true);
      setIs2FAVerified(true);
      await fetchCommissionState();

      return { success: true, hash: data.hash || '' };
    } catch {
      return { success: false, hash: '', message: 'Erro de rede na verificação facial.' };
    }
  };

  const authorizeMemberFace = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    if (currentUser?.role !== 'presidente') {
      return { success: false, message: 'Somente o Presidente pode autorizar faces.' };
    }
    try {
      const res = await apiFetch(`/api/faces/${userId}/authorize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao autorizar face.' };
      }
      if (Array.isArray(data.users)) setUsers(data.users);
      await fetchCommissionState();
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  };

  const rejectMemberFace = async (
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (currentUser?.role !== 'presidente') {
      return { success: false, message: 'Somente o Presidente pode recusar faces.' };
    }
    try {
      const res = await apiFetch(`/api/faces/${userId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao solicitar nova captura.' };
      }
      if (Array.isArray(data.users)) setUsers(data.users);
      await fetchCommissionState();
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  };

  const revokeMemberFace = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    if (currentUser?.role !== 'presidente') {
      return { success: false, message: 'Somente o Presidente pode revogar faces.' };
    }
    try {
      const res = await apiFetch(`/api/faces/${userId}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao revogar autorização.' };
      }
      if (Array.isArray(data.users)) setUsers(data.users);
      await fetchCommissionState();
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão.' };
    }
  };

  const verifyBiometrics = async (): Promise<boolean> => {
    const res = await verifyFacialRecognition(null, 'webauthn');
    return res.success;
  };

  const verify2FA = (_code: string): boolean => {
    return isBiometricAuthenticated;
  };

  const logout = async () => {
    try {
      if (tokenRef.current) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore
    }
    tokenRef.current = null;
    setIsAuthenticated(false);
    setIsBiometricAuthenticated(false);
    setIs2FAVerified(false);
    setCurrentUser(null);
    setUsers([]);
    setPautas([]);
    setElections([]);
    setApprovedAtas([]);
    setAccessLogs([]);
    setAuditLogs([]);
  };

  // Strict Admin-Only User Management
  const addNewUser = async (
    payload: NewUserPayload
  ): Promise<{ success: boolean; message?: string; user?: User }> => {
    if (!isSystemAdmin(currentUser)) {
      return {
        success: false,
        message: 'Acesso negado. Somente o Administrador pode cadastrar novos usuários.'
      };
    }
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao cadastrar usuário.' };
      }
      if (Array.isArray(data.users)) setUsers(data.users);
      await fetchCommissionState();
      return { success: true, user: data.user };
    } catch {
      return { success: false, message: 'Erro de conexão ao cadastrar usuário.' };
    }
  };

  const updateUser = async (
    userId: string,
    partial: UpdateUserPayload
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isSystemAdmin(currentUser)) {
      return {
        success: false,
        message: 'Acesso negado. Somente o Administrador pode alterar usuários.'
      };
    }
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(partial)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao atualizar usuário.' };
      }
      if (Array.isArray(data.users)) setUsers(data.users);
      if (data.currentSession) setCurrentSession(data.currentSession);
      if (data.user && currentUser?.id === userId) {
        setCurrentUser(data.user);
      }
      await fetchCommissionState();
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao atualizar usuário.' };
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    if (!isSystemAdmin(currentUser)) {
      return {
        success: false,
        message: 'Acesso negado. Somente o Administrador pode remover usuários.'
      };
    }
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao remover usuário.' };
      }
      if (Array.isArray(data.users)) setUsers(data.users);
      if (data.currentSession) setCurrentSession(data.currentSession);
      await fetchCommissionState();
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao remover usuário.' };
    }
  };

  const toggleUserPresence = async (userId: string) => {
    if (!isSystemAdmin(currentUser)) return;
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const nextPresence = target.presenceStatus === 'presente' ? 'ausente' : 'presente';
    await updateUser(userId, { presenceStatus: nextPresence });
  };

  const setCommissionType = (mode: CommissionMode) => {
    const nextSession: MeetingSession = {
      ...currentSession,
      commissionType: mode,
      titulo:
        mode === 'diretiva'
          ? 'Comissão Diretiva da Igreja — Sessão Ordinária'
          : 'Comissão de Nomeações — Escolha de Lideranças'
    };
    setCurrentSession(nextSession);
    syncCommissionToServer({ currentSession: nextSession });
  };

  const resetAllVotesAndTestData = async (): Promise<{ success: boolean; message?: string }> => {
    if (!isSystemAdmin(currentUser)) {
      return { success: false, message: 'Somente o Administrador pode reiniciar todas as votações.' };
    }

    const lockedCurrentSigners = (currentSession.signatures || []).filter(
      s => s.signerId && s.signerId !== currentUser?.id
    );
    if (lockedCurrentSigners.length > 0) {
      return {
        success: false,
        message: `Não é possível zerar a sessão porque a ata atual já foi assinada digitalmente por ${lockedCurrentSigners
          .map(s => s.nome)
          .join(', ')}.`
      };
    }

    const lockedArchived = approvedAtas.find(a =>
      (a.assinaturasDigitais || []).some(
        s => (s.signerId && s.signerId !== currentUser?.id) || (!s.signerId && s.nome !== currentUser?.name)
      )
    );
    if (lockedArchived) {
      return {
        success: false,
        message: `Não é possível apagar atas arquivadas porque a "${lockedArchived.numeroAta}" já possui assinatura de outro membro da comissão.`
      };
    }

    const cleanPautas = pautas.map(p => ({
      ...p,
      status: 'pautado' as PautaStatus,
      votos: {},
      resultadoFinal: undefined,
      votacaoIniciadaEm: undefined,
      votacaoEncerradaEm: undefined
    }));
    const cleanElections = elections.map(e => ({
      ...e,
      status: 'configuracao' as MinistryElection['status'],
      round: 1 as const,
      votersWhoCastVoteRound1: [],
      votersWhoCastVoteRound2: [],
      electedLeaderId: undefined,
      electedLeaderName: undefined,
      assignedMembers: [],
      dataFim: undefined,
      candidates: e.candidates.map(c => ({
        ...c,
        round1Votes: 0,
        round2Votes: 0,
        status: 'pendente' as Candidate['status']
      }))
    }));
    const nextSession: MeetingSession = {
      ...currentSession,
      ataAprovada: false,
      dataAprovacao: undefined,
      hashAta: undefined,
      signatures: []
    };

    const nextAudit = await addAuditLog(
      'Sessão Zerada',
      'Todas as votações, apurações e registros de teste foram zerados para nova sessão oficial.',
      currentUser,
      []
    );

    try {
      lastMutationAtRef.current = Date.now();
      const res = await apiFetch('/api/commission', {
        method: 'PUT',
        body: JSON.stringify({
          pautas: cleanPautas,
          elections: cleanElections,
          approvedAtas: [],
          accessLogs: [],
          auditLogs: nextAudit,
          currentSession: nextSession
        })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error || 'Não foi possível zerar a sessão no servidor.' };
      }
    } catch {
      return { success: false, message: 'Erro de conexão ao tentar zerar as votações.' };
    }

    setPautas(cleanPautas);
    setElections(cleanElections);
    setApprovedAtas([]);
    setAccessLogs([]);
    setActiveVotingPautaId(null);
    setActiveVotingElectionId(null);
    setCurrentSession(nextSession);
    return { success: true };
  };

  const finalizePautaObject = (
    pauta: PautaItem,
    updatedVotos: Record<string, any>,
    allPautas: PautaItem[]
  ): PautaItem => {
    const votosList = Object.values(updatedVotos || {});
    const totalVotantes = votosList.length;
    const favorCount = votosList.filter((v: any) => v.choice === 'favor').length;
    const contraCount = votosList.filter((v: any) => v.choice === 'contra').length;
    const abstencaoCount = votosList.filter((v: any) => v.choice === 'abstencao').length;

    const percentualFavor = totalVotantes > 0 ? (favorCount / totalVotantes) * 100 : 0;
    const aprovado = percentualFavor > 50;

    const existingNumberedCount = allPautas.filter(p => p.numeroResolucao).length;
    const currentYear = new Date().getFullYear();
    const resolutionNum =
      pauta.numeroResolucao || `Voto nº ${String(existingNumberedCount + 1).padStart(2, '0')}/${currentYear}`;

    return {
      ...pauta,
      numeroResolucao: resolutionNum,
      status: aprovado ? 'aprovado' : 'rejeitado',
      votos: updatedVotos,
      votacaoEncerradaEm: new Date().toISOString(),
      resultadoFinal: {
        totalVotantes,
        favor: favorCount,
        contra: contraCount,
        abstencao: abstencaoCount,
        percentualFavor: Number(percentualFavor.toFixed(1)),
        aprovado,
        dataResolucao: new Date().toISOString()
      }
    };
  };

  const addPauta = async (
    pautaData: Omit<PautaItem, 'id' | 'status' | 'observacoes' | 'anexos' | 'votos' | 'dataPautada'>,
    files?: AttachmentFile[]
  ) => {
    const newId = 'pauta-' + Math.random().toString(36).substring(2, 9);
    const presentCount = users.filter(
      u => u.presenceStatus === 'presente' && isVotingMember(u)
    ).length;
    const requiredQuorum = Math.max(1, Math.floor(presentCount / 2) + 1);
    const nextNum = `Voto nº ${String(pautas.length + 1).padStart(2, '0')}/${new Date().getFullYear()}`;

    const newPauta: PautaItem = {
      ...pautaData,
      numeroResolucao: pautaData.numeroResolucao || nextNum,
      id: newId,
      status: 'pautado',
      observacoes: [],
      anexos: files || [],
      votos: {},
      quorumRequerido: requiredQuorum,
      dataPautada: new Date().toISOString(),
      compartilhadaComMembros: pautaData.compartilhadaComMembros ?? true
    };

    const nextPautas = [newPauta, ...pautas];
    const nextSession = {
      ...currentSession,
      pautasIds: [newId, ...currentSession.pautasIds]
    };

    setPautas(nextPautas);
    setCurrentSession(nextSession);

    const nextAudit = await addAuditLog('Nova Pauta Cadastrada', `Assunto "${newPauta.titulo}" incluído na Ordem do Dia.`);
    sendPushNotification('Nova Pauta Inserida', `Assunto: ${newPauta.titulo}`);
    notifySlack(`📋 *Nova Pauta Pautada*: ${newPauta.titulo} (Relator: ${newPauta.relator})`);
    await syncCommissionToServer({ pautas: nextPautas, currentSession: nextSession, auditLogs: nextAudit });
  };

  const updatePautaStatus = async (pautaId: string, newStatus: PautaStatus) => {
    const nextPautas = pautas.map(p => (p.id === pautaId ? { ...p, status: newStatus } : p));
    setPautas(nextPautas);
    const nextAudit = await addAuditLog('Status de Pauta Atualizado', `Pauta ${pautaId} alterada para ${newStatus}.`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const addPautaObservation = async (pautaId: string, comment: string, suggestedRevision?: string) => {
    if (!currentUser) return;
    const newObs = {
      id: 'obs-' + Math.random().toString(36).substring(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      timestamp: new Date().toISOString(),
      comment,
      suggestedRevision
    };

    const nextPautas = pautas.map(p => {
      if (p.id === pautaId) {
        return {
          ...p,
          status: (p.status === 'pautado' ? 'em_leitura' : p.status) as PautaStatus,
          observacoes: [...p.observacoes, newObs]
        };
      }
      return p;
    });

    setPautas(nextPautas);
    const nextAudit = await addAuditLog('Observação em Pauta', `${currentUser.name} adicionou apontamento.`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const updatePautaProposta = async (pautaId: string, updatedProposta: string) => {
    const nextPautas = pautas.map(p =>
      p.id === pautaId ? { ...p, propostaTexto: updatedProposta, status: 'em_edicao' as PautaStatus } : p
    );
    setPautas(nextPautas);
    const nextAudit = await addAuditLog('Redação Ajustada', `Proposta da pauta ${pautaId} atualizada pela mesa.`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const startPautaVoting = async (pautaId: string) => {
    const target = pautas.find(p => p.id === pautaId);
    if (!target) return;

    const nextPautas = pautas.map(p => {
      if (p.id === pautaId) {
        return {
          ...p,
          status: 'votacao_aberta' as PautaStatus,
          compartilhadaComMembros: true,
          votacaoIniciadaEm: new Date().toISOString(),
          votos: {},
          resultadoFinal: undefined
        };
      }
      return p;
    });

    setActiveVotingPautaId(pautaId);
    setPautas(nextPautas);

    sendPushNotification('Votação Secreta Aberta', `A comissão está votando: "${target.titulo}".`);
    notifySlack(`🗳️ *VOTAÇÃO SECRETA ABERTA*: ${target.titulo}`);
    const nextAudit = await addAuditLog('Votação Secreta Aberta', `Presidente abriu votação secreta para "${target.titulo}".`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const castPautaVote = async (
    pautaId: string,
    choice: 'favor' | 'contra' | 'abstencao'
  ): Promise<{ success: boolean; message: string; autoConcluded?: boolean }> => {
    if (!currentUser) return { success: false, message: 'Usuário não autenticado.' };
    if (!isBiometricAuthenticated) return { success: false, message: 'Conclua o reconhecimento facial para votar.' };
    if (!isVotingMember(currentUser)) {
      return {
        success: false,
        message: 'Somente membros com função na comissão possuem voto deliberativo.'
      };
    }

    const pauta = pautas.find(p => p.id === pautaId);
    if (!pauta) return { success: false, message: 'Pauta não encontrada.' };
    if (pauta.status !== 'votacao_aberta') {
      return { success: false, message: 'A votação desta pauta não está aberta.' };
    }

    if (pauta.votos && pauta.votos[currentUser.id]) {
      return { success: false, message: 'Seu voto já foi registrado e bloqueado contra duplicidade.' };
    }

    const voteHash = await computeSha256(`${pautaId}|${currentUser.id}|${choice}|${Date.now()}`);
    const newVote = {
      pautaId,
      userId: currentUser.id,
      userName: currentUser.name,
      choice,
      timestamp: new Date().toISOString(),
      signature: voteHash.substring(0, 16)
    };

    const updatedVotos = { ...pauta.votos, [currentUser.id]: newVote };
    const presentVoters = users.filter(
      u => u.presenceStatus === 'presente' && isVotingMember(u)
    );
    const allHaveVoted = presentVoters.length > 0 && presentVoters.every(v => Boolean(updatedVotos[v.id]));

    const nextPautas = pautas.map(p => {
      if (p.id === pautaId) {
        return allHaveVoted ? finalizePautaObject(p, updatedVotos, pautas) : { ...p, votos: updatedVotos };
      }
      return p;
    });

    setPautas(nextPautas);
    if (allHaveVoted) setActiveVotingPautaId(null);

    await recordAccess('voto_registrado', `Voto secreto registrado na pauta "${pauta.titulo}"`, pautaId);
    let nextAudit = await addAuditLog('Voto Secreto Registrado', `${currentUser.name} depositou voto sigiloso na pauta "${pauta.titulo}".`);

    if (allHaveVoted) {
      const votosList = Object.values(updatedVotos);
      const favorCount = votosList.filter(v => v.choice === 'favor').length;
      const aprovado = votosList.length > 0 && (favorCount / votosList.length) * 100 > 50;
      if (aprovado) {
        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      }
      nextAudit = await addAuditLog(
        'Apuração Revelada Automaticamente',
        `Todos os ${presentVoters.length} membros presentes votaram em "${pauta.titulo}". Resultado exibido automaticamente.`,
        currentUser,
        nextAudit
      );
      await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
      return {
        success: true,
        autoConcluded: true,
        message: 'Todos os membros presentes votaram! A votação foi encerrada e o resultado foi revelado.'
      };
    }

    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
    return {
      success: true,
      autoConcluded: false,
      message: 'Voto secreto registrado com sucesso! O resultado será revelado quando todos votarem ou ao encerramento pelo Presidente.'
    };
  };

  const closePautaVoting = async (pautaId: string) => {
    const pauta = pautas.find(p => p.id === pautaId);
    if (!pauta) return;

    setActiveVotingPautaId(null);
    const nextPautas = pautas.map(p => (p.id === pautaId ? finalizePautaObject(p, p.votos || {}, pautas) : p));
    setPautas(nextPautas);

    const votosList = Object.values(pauta.votos || {});
    const totalVotantes = votosList.length;
    const favorCount = votosList.filter(v => v.choice === 'favor').length;
    const percentualFavor = totalVotantes > 0 ? (favorCount / totalVotantes) * 100 : 0;
    const aprovado = percentualFavor > 50;

    if (aprovado) {
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {
        // ignore
      }
    }

    const resultadoMsg = aprovado
      ? `APROVADO (${favorCount}/${totalVotantes} votos · ${percentualFavor.toFixed(1)}%)`
      : `REJEITADO (${favorCount}/${totalVotantes} votos favoráveis)`;

    sendPushNotification(`Resultado Revelado`, `${pauta.titulo}: ${resultadoMsg}`);
    notifySlack(`📊 *Resultado Oficial Revelado*: ${pauta.titulo} — ${resultadoMsg}`);
    const nextAudit = await addAuditLog('Votação Encerrada pelo Presidente', `Pauta "${pauta.titulo}" encerrada: ${resultadoMsg}.`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const addAttachmentToPauta = async (pautaId: string, file: AttachmentFile) => {
    const nextPautas = pautas.map(p => (p.id === pautaId ? { ...p, anexos: [...p.anexos, file] } : p));
    setPautas(nextPautas);
    const nextAudit = await addAuditLog('Anexo Adicionado', `Arquivo "${file.name}" anexado à pauta.`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const createElection = async (
    ministryName: string,
    descricao: string,
    candidateNames: string[],
    autoIncorporateOthersAsMembers: boolean,
    allowMemberNomination: boolean = true
  ) => {
    const newId = 'elec-' + Math.random().toString(36).substring(2, 9);
    const candidates: Candidate[] = candidateNames.map((name, i) => ({
      id: `cand-${newId}-${i + 1}`,
      name: name.trim(),
      indicadoPor: currentUser?.name || 'Comissão de Nomeações',
      aceitouIndicacao: 'pendente',
      round1Votes: 0,
      round2Votes: 0,
      status: 'pendente'
    }));

    const activeVotersCount = users.filter(
      u => u.presenceStatus === 'presente' && isVotingMember(u)
    ).length;

    const newElection: MinistryElection = {
      id: newId,
      ministryName,
      descricao,
      autoIncorporateOthersAsMembers,
      allowMemberNomination,
      status: 'configuracao',
      round: 1,
      compartilhadaComMembros: true,
      candidates,
      votersWhoCastVoteRound1: [],
      votersWhoCastVoteRound2: [],
      assignedMembers: [],
      totalVoters: activeVotersCount,
      dataInicio: new Date().toISOString()
    };

    const nextElections = [newElection, ...elections];
    setElections(nextElections);
    const nextAudit = await addAuditLog(
      'Cargo Cadastrado na Comissão de Nomeações',
      `Nomeação para ${ministryName} criada com ${candidates.length} indicados.`
    );
    notifySlack(`🗳️ *Comissão de Nomeações*: Novo cargo em pauta — *${ministryName}*.`);
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const addCandidateToElection = async (
    electionId: string,
    name: string,
    experiencia?: string,
    indicadoPor?: string
  ) => {
    if (!name.trim()) return;
    const newCand: Candidate = {
      id: `cand-${electionId}-${Date.now()}`,
      name: name.trim(),
      experiencia: experiencia?.trim() || undefined,
      indicadoPor: indicadoPor || currentUser?.name || 'Membro da Comissão',
      aceitouIndicacao: 'pendente',
      round1Votes: 0,
      round2Votes: 0,
      status: 'pendente'
    };

    const nextElections = elections.map(e =>
      e.id === electionId ? { ...e, candidates: [...e.candidates, newCand] } : e
    );
    setElections(nextElections);
    const nextAudit = await addAuditLog('Nova Indicação Registrada', `${name.trim()} foi indicado(a) por ${newCand.indicadoPor}.`);
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const updateCandidateAcceptance = async (
    electionId: string,
    candidateId: string,
    status: 'pendente' | 'aceito' | 'recusado'
  ) => {
    const nextElections = elections.map(e =>
      e.id === electionId
        ? {
            ...e,
            candidates: e.candidates.map(c => (c.id === candidateId ? { ...c, aceitouIndicacao: status } : c))
          }
        : e
    );
    setElections(nextElections);
    const nextAudit = await addAuditLog('Status de Aceitação Atualizado', `Status de aceitação atualizado para "${status}".`);
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const evaluateElectionRound = (
    el: MinistryElection
  ): {
    updated: MinistryElection;
    outcome: 'elected_r1' | 'runoff' | 'elected_r2';
    winnerName?: string;
    top2Names?: string[];
  } => {
    if (el.round === 1) {
      const totalVotes = el.votersWhoCastVoteRound1.length;
      const majorityThreshold = totalVotes > 0 ? Math.floor(totalVotes / 2) + 1 : 1;
      const sorted = [...el.candidates].sort((a, b) => b.round1Votes - a.round1Votes);
      const topCandidate = sorted[0];

      const winner =
        totalVotes > 0 && topCandidate && topCandidate.round1Votes >= majorityThreshold ? topCandidate : null;

      if (winner) {
        const otherNames = el.candidates.filter(c => c.id !== winner.id).map(c => c.name);
        return {
          outcome: 'elected_r1',
          winnerName: winner.name,
          updated: {
            ...el,
            status: 'concluido',
            electedLeaderId: winner.id,
            electedLeaderName: winner.name,
            assignedMembers: el.autoIncorporateOthersAsMembers ? otherNames : [],
            dataFim: new Date().toISOString(),
            candidates: el.candidates.map(c => ({
              ...c,
              status:
                c.id === winner.id
                  ? 'eleito'
                  : el.autoIncorporateOthersAsMembers
                  ? 'incorporado_membro'
                  : 'nao_eleito'
            }))
          }
        };
      }

      const secondScore = sorted[1]?.round1Votes ?? 0;
      const top2Ids = sorted
        .filter((c, idx) => idx < 2 || (secondScore > 0 && c.round1Votes === secondScore))
        .map(c => c.id);

      return {
        outcome: 'runoff',
        top2Names: sorted.filter(c => top2Ids.includes(c.id)).map(c => c.name),
        updated: {
          ...el,
          status: 'apuracao_turno_1',
          candidates: el.candidates.map(c => ({
            ...c,
            status: top2Ids.includes(c.id) ? 'segundo_turno' : 'nao_eleito'
          }))
        }
      };
    }

    const round2Candidates = el.candidates.filter(c => c.status === 'segundo_turno');
    const pool = round2Candidates.length > 0 ? round2Candidates : el.candidates;
    const winner = pool.reduce((prev, curr) => (curr.round2Votes > prev.round2Votes ? curr : prev), pool[0]);
    const otherNames = el.candidates.filter(c => c.id !== winner.id).map(c => c.name);

    return {
      outcome: 'elected_r2',
      winnerName: winner.name,
      updated: {
        ...el,
        status: 'concluido',
        electedLeaderId: winner.id,
        electedLeaderName: winner.name,
        assignedMembers: el.autoIncorporateOthersAsMembers ? otherNames : [],
        dataFim: new Date().toISOString(),
        candidates: el.candidates.map(c => ({
          ...c,
          status:
            c.id === winner.id
              ? 'eleito'
              : el.autoIncorporateOthersAsMembers
              ? 'incorporado_membro'
              : 'nao_eleito'
        }))
      }
    };
  };

  const startElectionVoting = async (electionId: string, round: 1 | 2) => {
    setActiveVotingElectionId(electionId);
    const nextElections = elections.map(el => {
      if (el.id === electionId) {
        return {
          ...el,
          status: (round === 1 ? 'votacao_turno_1' : 'votacao_turno_2') as MinistryElection['status'],
          round,
          compartilhadaComMembros: true
        };
      }
      return el;
    });
    setElections(nextElections);

    const election = elections.find(e => e.id === electionId);
    sendPushNotification(`Votação Secreta Aberta (${round}º Turno)`, `Cargo: ${election?.ministryName}`);
    notifySlack(`🗳️ *Escrutínio Secreto Aberto (${round}º Turno)*: ${election?.ministryName}. Os votos são sigilosos até a conclusão.`);
    const nextAudit = await addAuditLog('Votação Secreta Aberta', `Iniciado ${round}º turno sigiloso para ${election?.ministryName}.`);
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const castElectionVote = async (
    electionId: string,
    candidateId: string
  ): Promise<{ success: boolean; message: string; autoConcluded?: boolean }> => {
    if (!currentUser) return { success: false, message: 'Usuário não autenticado.' };
    if (!isBiometricAuthenticated) return { success: false, message: 'Conclua o reconhecimento facial para votar.' };
    if (!isVotingMember(currentUser)) {
      return { success: false, message: 'Somente membros com função na comissão podem votar nas nomeações.' };
    }

    const election = elections.find(e => e.id === electionId);
    if (!election) return { success: false, message: 'Eleição não encontrada.' };
    if (election.status !== 'votacao_turno_1' && election.status !== 'votacao_turno_2') {
      return { success: false, message: 'A votação para este cargo não está aberta.' };
    }

    const isRound1 = election.round === 1;
    const voterList = isRound1 ? election.votersWhoCastVoteRound1 : election.votersWhoCastVoteRound2;

    if (voterList.includes(currentUser.id)) {
      return { success: false, message: 'Você já votou neste turno. Seu voto foi bloqueado para evitar duplicidade.' };
    }

    const presentVoters = users.filter(
      u => u.presenceStatus === 'presente' && isVotingMember(u)
    );
    const updatedVoterList = [...voterList, currentUser.id];
    const allHaveVoted = presentVoters.length > 0 && presentVoters.every(v => updatedVoterList.includes(v.id));

    const updatedCandidates = election.candidates.map(c => {
      if (c.id === candidateId) {
        return {
          ...c,
          round1Votes: isRound1 ? c.round1Votes + 1 : c.round1Votes,
          round2Votes: !isRound1 ? c.round2Votes + 1 : c.round2Votes
        };
      }
      return c;
    });

    const nextElection: MinistryElection = {
      ...election,
      candidates: updatedCandidates,
      votersWhoCastVoteRound1: isRound1 ? updatedVoterList : election.votersWhoCastVoteRound1,
      votersWhoCastVoteRound2: !isRound1 ? updatedVoterList : election.votersWhoCastVoteRound2
    };

    const autoOutcome = allHaveVoted ? evaluateElectionRound(nextElection) : null;
    const finalElection = autoOutcome ? autoOutcome.updated : nextElection;
    const nextElections = elections.map(el => (el.id === electionId ? finalElection : el));

    setElections(nextElections);

    await recordAccess('voto_registrado', `Voto secreto em nomeação (${election.ministryName} · ${election.round}º turno)`, electionId);
    let nextAudit = await addAuditLog('Voto Secreto Registrado', `${currentUser.name} registrou voto sigiloso em ${election.ministryName}.`);

    if (allHaveVoted) {
      setActiveVotingElectionId(null);
      if (autoOutcome && (autoOutcome.outcome === 'elected_r1' || autoOutcome.outcome === 'elected_r2')) {
        try {
          confetti({ particleCount: 110, spread: 75, origin: { y: 0.55 } });
        } catch {
          // ignore
        }
      }
      nextAudit = await addAuditLog(
        'Resultado Revelado Automaticamente',
        `Todos os ${presentVoters.length} membros presentes votaram em "${election.ministryName}". Resultado apurado automaticamente.`,
        currentUser,
        nextAudit
      );
      await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
      return {
        success: true,
        autoConcluded: true,
        message: 'Todos os membros presentes votaram! Apuração concluída e resultado revelado automaticamente.'
      };
    }

    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
    return {
      success: true,
      autoConcluded: false,
      message: 'Voto secreto computado! A contagem permanece oculta até que todos votem ou o Presidente encerre.'
    };
  };

  const concludeElectionRound = async (electionId: string) => {
    setActiveVotingElectionId(null);
    const election = elections.find(e => e.id === electionId);
    if (!election) return;

    const evaluated = evaluateElectionRound(election);
    const nextElections = elections.map(el => (el.id === electionId ? evaluated.updated : el));
    setElections(nextElections);

    let nextAudit: AuditLog[] = auditLogs;
    if (evaluated.outcome === 'elected_r1' || evaluated.outcome === 'elected_r2') {
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      } catch {
        // ignore
      }
      sendPushNotification('Resultado Oficial Revelado', `${evaluated.winnerName} escolhido(a) para ${election.ministryName}.`);
      notifySlack(`🎉 *Resultado Revelado — ${election.ministryName}*: Escolhido(a) *${evaluated.winnerName}*!`);
      nextAudit = await addAuditLog('Nomeação Concluída', `${evaluated.winnerName} escolhido(a) para ${election.ministryName}. Resultado revelado.`);
    } else {
      sendPushNotification('2º Turno Definido', `Resultado do 1º turno revelado para ${election.ministryName}.`);
      notifySlack(`⚖️ *2º Turno — ${election.ministryName}*: Avançam ${evaluated.top2Names?.join(' e ')}.`);
      nextAudit = await addAuditLog(
        '1º Turno Encerrado (2º Turno)',
        `Resultado do 1º turno revelado para ${election.ministryName}. Avançam: ${evaluated.top2Names?.join(', ')}.`
      );
    }

    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const updateSession = (partial: Partial<MeetingSession>) => {
    const nextSession = { ...currentSession, ...partial };
    setCurrentSession(nextSession);
    addAuditLog('Sessão Atualizada', 'Dados da sessão e ata foram atualizados.').then(nextAudit => {
      syncCommissionToServer({ currentSession: nextSession, auditLogs: nextAudit });
    });
  };

  const updatePauta = async (pautaId: string, partial: Partial<PautaItem>, cascadeRenumber: boolean = false) => {
    let renumberedCount = 0;
    let firstPautaNewResolucao = '';

    const idx = pautas.findIndex(p => p.id === pautaId);
    if (idx === -1) return;

    const shouldCascade = partial.numeroResolucao !== undefined && (idx === 0 || cascadeRenumber);
    const parsedRes = shouldCascade ? parseResolutionNumber(partial.numeroResolucao!) : null;

    const nextPautas = pautas.map((p, i) => {
      if (p.id === pautaId) {
        firstPautaNewResolucao = partial.numeroResolucao || p.numeroResolucao || '';
        return { ...p, ...partial };
      }
      if (parsedRes && i > idx) {
        renumberedCount++;
        const nextResolucao = formatResolutionNumber(parsedRes, i - idx);
        return { ...p, numeroResolucao: nextResolucao };
      }
      return p;
    });

    setPautas(nextPautas);
    const nextAudit = await addAuditLog(
      'Pauta Editada',
      renumberedCount > 0
        ? `Numeração atualizada a partir de ${firstPautaNewResolucao} (${renumberedCount} pautas sequenciadas).`
        : `Pauta ${pautaId} atualizada.`
    );
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const setFirstPautaResolutionNumber = async (newPattern: string) => {
    if (pautas.length === 0) return;
    await updatePauta(pautas[0].id, { numeroResolucao: newPattern }, true);
  };

  const renumberAllPautas = async (startFormatOrNumber: string = 'Voto nº 01/2026') => {
    const parsed = parseResolutionNumber(startFormatOrNumber) || {
      prefix: 'Voto nº ',
      num: 1,
      pad: 2,
      suffix: `/${new Date().getFullYear()}`
    };

    const nextPautas = pautas.map((p, i) => ({ ...p, numeroResolucao: formatResolutionNumber(parsed, i) }));
    setPautas(nextPautas);
    const nextAudit = await addAuditLog('Renumeração Sequencial', `Pautas renumeradas iniciando em "${startFormatOrNumber}".`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const deletePauta = async (pautaId: string): Promise<{ success: boolean; message?: string }> => {
    if (!isSystemAdmin(currentUser)) {
      return { success: false, message: 'Somente o Administrador pode excluir propostas da comissão.' };
    }
    try {
      lastMutationAtRef.current = Date.now();
      const res = await apiFetch(`/api/pautas/${pautaId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao excluir proposta.' };
      }
      if (Array.isArray(data.pautas)) setPautas(data.pautas);
      if (data.currentSession) setCurrentSession(data.currentSession);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      if (activeVotingPautaId === pautaId) setActiveVotingPautaId(null);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao excluir proposta.' };
    }
  };

  const resetPautaVotes = async (pautaId: string) => {
    const nextPautas = pautas.map(p => {
      if (p.id === pautaId) {
        return {
          ...p,
          status: 'pautado' as PautaStatus,
          votos: {},
          resultadoFinal: undefined,
          votacaoIniciadaEm: undefined,
          votacaoEncerradaEm: undefined
        };
      }
      return p;
    });
    setPautas(nextPautas);
    if (activeVotingPautaId === pautaId) setActiveVotingPautaId(null);
    const nextAudit = await addAuditLog('Votação Zerada', `Votos da pauta ${pautaId} foram zerados.`);
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const updateElection = async (electionId: string, partial: Partial<MinistryElection>) => {
    const nextElections = elections.map(e => (e.id === electionId ? { ...e, ...partial } : e));
    setElections(nextElections);
    const nextAudit = await addAuditLog('Eleição Atualizada', `Parâmetros da eleição ${electionId} atualizados.`);
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const deleteElection = async (electionId: string) => {
    const target = elections.find(e => e.id === electionId);
    const nextElections = elections.filter(e => e.id !== electionId);
    setElections(nextElections);
    if (activeVotingElectionId === electionId) setActiveVotingElectionId(null);
    const nextAudit = await addAuditLog('Eleição Removida', `Eleição para ${target?.ministryName || electionId} removida.`);
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  const updateChurchSettings = (partial: Partial<ChurchSettings>) => {
    const updated = { ...churchSettings, ...partial };
    setChurchSettings(updated);
    addAuditLog('Configurações Alteradas', 'Parâmetros institucionais atualizados.').then(nextAudit => {
      syncCommissionToServer({ churchSettings: updated, auditLogs: nextAudit });
    });
  };

  const approveAndArchiveCurrentAta = async (): Promise<ApprovedAtaRecord> => {
    const nowIso = new Date().toISOString();

    const approvedResolutions = pautas
      .filter(p => p.status === 'aprovado')
      .map(p => ({
        numeroResolucao: p.numeroResolucao || `Voto nº ${p.id}`,
        titulo: p.titulo,
        categoria: p.categoria,
        propostaTexto: p.propostaTexto,
        resultado: p.resultadoFinal
          ? {
              favor: p.resultadoFinal.favor,
              contra: p.resultadoFinal.contra,
              abstencao: p.resultadoFinal.abstencao,
              percentualFavor: p.resultadoFinal.percentualFavor
            }
          : {
              favor: Object.values(p.votos).filter(v => v.choice === 'favor').length,
              contra: Object.values(p.votos).filter(v => v.choice === 'contra').length,
              abstencao: Object.values(p.votos).filter(v => v.choice === 'abstencao').length,
              percentualFavor: 100
            }
      }));

    const concludedElecs = elections
      .filter(e => e.status === 'concluido' && e.electedLeaderName)
      .map(e => ({
        ministryName: e.ministryName,
        electedLeaderName: e.electedLeaderName || 'Eleito',
        assignedMembers: e.assignedMembers || []
      }));

    const rawContent = `ATA CANÔNICA DE DELIBERAÇÃO ECLESIÁSTICA
Sessão: ${currentSession.titulo} (${currentSession.numeroAta})
Data: ${new Date(currentSession.dataHora).toLocaleString('pt-BR')}
Local: ${currentSession.local}
Presidência: ${currentSession.presidenteNome}
Secretaria: ${currentSession.secretarioNome}

RESOLUÇÕES APROVADAS (${approvedResolutions.length}):
${approvedResolutions.map((r, i) => `${i + 1}. [${r.numeroResolucao}] ${r.titulo}: ${r.propostaTexto} (${r.resultado.favor}F / ${r.resultado.contra}C / ${r.resultado.abstencao}A)`).join('\n')}

NOMEAÇÕES CONCLUÍDAS (${concludedElecs.length}):
${concludedElecs.length > 0 ? concludedElecs.map(e => `- ${e.ministryName}: ${e.electedLeaderName}`).join('\n') : 'Nenhuma nomeação concluída nesta sessão.'}`;

    const contentHash = await computeSha256(rawContent + '|' + nowIso);
    const realSignatures = (currentSession.signatures || []).map((sig: AtaSignatureRecord) => ({
      signerId: sig.signerId,
      cargo: sig.cargo,
      nome: sig.nome,
      dataHora: sig.signedAt,
      hash: sig.hash,
      signatureDataUrl: sig.signatureDataUrl
    }));

    const newApprovedRecord: ApprovedAtaRecord = {
      id: 'ata-' + Date.now(),
      numeroAta: currentSession.numeroAta,
      titulo: currentSession.titulo,
      dataSessao: currentSession.dataHora,
      dataAprovacao: nowIso,
      presidenteNome: currentSession.presidenteNome,
      secretarioNome: currentSession.secretarioNome,
      local: currentSession.local,
      presentesNomes: users
        .filter(u => u.presenceStatus === 'presente' && isVotingMember(u))
        .map(u => `${u.name} (${getRoleLabel(u.role)})`),
      votosAprovados: approvedResolutions,
      eleicoesConcluidas: concludedElecs,
      conteudoCompleto: rawContent,
      hashAta: contentHash,
      assinaturasDigitais: realSignatures
    };

    const nextAtas = [newApprovedRecord, ...approvedAtas];
    const nextSession = {
      ...currentSession,
      ataAprovada: true,
      dataAprovacao: nowIso,
      hashAta: contentHash
    };

    setApprovedAtas(nextAtas);
    setCurrentSession(nextSession);

    const nextAudit = await addAuditLog('Ata Canônica Arquivada', `${currentSession.numeroAta} aprovada e lacrada com SHA-256.`);
    await recordAccess('acesso_portal_membro', `Aprovação da ${currentSession.numeroAta}`, newApprovedRecord.id);
    await syncCommissionToServer({
      approvedAtas: nextAtas,
      currentSession: nextSession,
      auditLogs: nextAudit
    });

    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {
      // ignore
    }

    return newApprovedRecord;
  };

  const signCurrentAta = async (
    signatureDataUrl: string,
    cargoLabel?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      lastMutationAtRef.current = Date.now();
      const res = await apiFetch('/api/atas/current/sign', {
        method: 'POST',
        body: JSON.stringify({ signatureDataUrl, cargoLabel })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao registrar assinatura digital.' };
      }
      if (data.currentSession) setCurrentSession(data.currentSession);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      if (Array.isArray(data.accessLogs)) setAccessLogs(data.accessLogs);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao registrar assinatura digital.' };
    }
  };

  const signArchivedAta = async (
    ataId: string,
    signatureDataUrl: string,
    cargoLabel?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      lastMutationAtRef.current = Date.now();
      const res = await apiFetch(`/api/atas/${ataId}/sign`, {
        method: 'POST',
        body: JSON.stringify({ signatureDataUrl, cargoLabel })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Erro ao assinar ata arquivada.' };
      }
      if (Array.isArray(data.approvedAtas)) setApprovedAtas(data.approvedAtas);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      if (Array.isArray(data.accessLogs)) setAccessLogs(data.accessLogs);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao assinar ata arquivada.' };
    }
  };

  const toggleDesignatedSigner = async (userId: string) => {
    const existing = currentSession.designatedSignersIds || [];
    const isAlready = existing.includes(userId);
    const nextIds = isAlready ? existing.filter(id => id !== userId) : [...existing, userId];
    const targetUser = users.find(u => u.id === userId);
    const nextSession: MeetingSession = {
      ...currentSession,
      designatedSignersIds: nextIds
    };
    setCurrentSession(nextSession);
    const nextAudit = await addAuditLog(
      isAlready ? 'Designação Removida' : 'Assinante Designado',
      `${targetUser?.name || userId} ${isAlready ? 'removido(a) da' : 'designado(a) para'} assinatura digital da ata.`
    );
    await syncCommissionToServer({ currentSession: nextSession, auditLogs: nextAudit });
  };

  const deleteCurrentAta = async (): Promise<{ success: boolean; message?: string }> => {
    if (!isSystemAdmin(currentUser)) {
      return { success: false, message: 'Somente o Administrador pode excluir a ata.' };
    }
    try {
      lastMutationAtRef.current = Date.now();
      const res = await apiFetch('/api/atas/current', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Não foi possível excluir a ata.' };
      }
      if (data.currentSession) setCurrentSession(data.currentSession);
      if (Array.isArray(data.approvedAtas)) setApprovedAtas(data.approvedAtas);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao excluir ata.' };
    }
  };

  const deleteArchivedAta = async (ataId: string): Promise<{ success: boolean; message?: string }> => {
    if (!isSystemAdmin(currentUser)) {
      return { success: false, message: 'Somente o Administrador pode excluir atas arquivadas.' };
    }
    try {
      lastMutationAtRef.current = Date.now();
      const res = await apiFetch(`/api/atas/${ataId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Não foi possível excluir a ata arquivada.' };
      }
      if (Array.isArray(data.approvedAtas)) setApprovedAtas(data.approvedAtas);
      if (data.currentSession) setCurrentSession(data.currentSession);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      return { success: true };
    } catch {
      return { success: false, message: 'Erro de conexão ao excluir ata arquivada.' };
    }
  };

  const toggleSharePautaWithMembers = async (pautaId: string) => {
    let isNowShared = false;
    let pautaTitle = '';
    const nextPautas = pautas.map(p => {
      if (p.id === pautaId) {
        isNowShared = !p.compartilhadaComMembros;
        pautaTitle = p.titulo;
        return { ...p, compartilhadaComMembros: isNowShared };
      }
      return p;
    });
    setPautas(nextPautas);
    const nextAudit = await addAuditLog(
      isNowShared ? 'Pauta Compartilhada' : 'Pauta Ocultada',
      `Pauta "${pautaTitle}" ${isNowShared ? 'liberada' : 'ocultada'} na Área do Membro.`
    );
    await syncCommissionToServer({ pautas: nextPautas, auditLogs: nextAudit });
  };

  const toggleShareElectionWithMembers = async (electionId: string) => {
    let isNowShared = false;
    let ministry = '';
    const nextElections = elections.map(e => {
      if (e.id === electionId) {
        isNowShared = !e.compartilhadaComMembros;
        ministry = e.ministryName;
        return { ...e, compartilhadaComMembros: isNowShared };
      }
      return e;
    });
    setElections(nextElections);
    const nextAudit = await addAuditLog(
      isNowShared ? 'Nomeação Compartilhada' : 'Nomeação Ocultada',
      `Eleição "${ministry}" ${isNowShared ? 'liberada' : 'ocultada'} na Área do Membro.`
    );
    await syncCommissionToServer({ elections: nextElections, auditLogs: nextAudit });
  };

  return (
    <ChurchContext.Provider
      value={{
        currentUser,
        users,
        currentSession,
        pautas,
        elections,
        auditLogs,
        approvedAtas,
        accessLogs,
        isOnline,
        darkMode,
        activeVotingPautaId,
        activeVotingElectionId,
        isAuthenticated,
        isBiometricAuthenticated,
        is2FAVerified,
        needsAdminSetup,
        bootstrapStatusLoaded,
        slackWebhookUrl,
        slackConnected,
        notificationsEnabled,
        recordAccess,
        approveAndArchiveCurrentAta,
        toggleSharePautaWithMembers,
        toggleShareElectionWithMembers,
        bootstrapAdminAccount,
        changeOwnPassword,
        submitFaceForPresidentApproval,
        verifyFacialRecognition,
        authorizeMemberFace,
        rejectMemberFace,
        revokeMemberFace,
        refreshUsersFromStorage,
        resetAllVotesAndTestData,
        setCommissionType,
        loginWithCredentials,
        verifyBiometrics,
        verify2FA,
        logout,
        setDarkMode,
        setSlackWebhookUrl,
        requestNotificationPermission,
        sendPushNotification,
        notifySlack,
        addPauta,
        updatePautaStatus,
        addPautaObservation,
        updatePautaProposta,
        startPautaVoting,
        castPautaVote,
        closePautaVoting,
        updateSession,
        addAttachmentToPauta,
        createElection,
        addCandidateToElection,
        updateCandidateAcceptance,
        startElectionVoting,
        castElectionVote,
        concludeElectionRound,
        toggleUserPresence,
        addNewUser,
        updateUser,
        deleteUser,
        updatePauta,
        deletePauta,
        resetPautaVotes,
        renumberAllPautas,
        setFirstPautaResolutionNumber,
        updateElection,
        deleteElection,
        signCurrentAta,
        signArchivedAta,
        toggleDesignatedSigner,
        deleteCurrentAta,
        deleteArchivedAta,
        churchSettings,
        updateChurchSettings
      }}
    >
      {children}
    </ChurchContext.Provider>
  );
};

export const useChurch = () => {
  const context = useContext(ChurchContext);
  if (!context) throw new Error('useChurch must be used within ChurchProvider');
  return context;
};
