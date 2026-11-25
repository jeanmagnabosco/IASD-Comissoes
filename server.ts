import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

type UserRole = 'administrador' | 'presidente' | 'secretario' | 'tesoureiro' | 'membro' | 'conselheiro' | 'observador';
type FacialAuthStatus = 'nao_cadastrada' | 'pendente_autorizacao' | 'autorizada' | 'recusada';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  isAdmin: boolean;
  avatarUrl: string;
  biometricRegistered: boolean;
  twoFactorEnabled: boolean;
  presenceStatus: 'presente' | 'ausente' | 'remoto';
  phone?: string;
  ministry?: string;
  accountActive: boolean;
  passwordConfigured: boolean;
  mustChangePassword: boolean;
  passwordSalt?: string;
  passwordHash?: string;
  facialEnrolled: boolean;
  facialSignatureHash?: string;
  facialVerifiedAt?: string;
  facialSnapshotDataUrl?: string;
  facialAuthorizationStatus: FacialAuthStatus;
  facialAuthorizedBy?: string;
  facialAuthorizedAt?: string;
  facialRejectionReason?: string;
  lastLoginAt?: string;
}

interface SessionRecord {
  tokenId: string;
  userId: string;
  facialVerified: boolean;
  createdAt: number;
  expiresAt: number;
}

interface LoginAttemptRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

interface PersistedStore {
  adminClaimed: boolean;
  users: StoredUser[];
  currentSession: Record<string, unknown>;
  pautas: Array<Record<string, unknown>>;
  elections: Array<Record<string, unknown>>;
  approvedAtas: Array<Record<string, unknown>>;
  accessLogs: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  churchSettings: Record<string, unknown>;
}

function readCliFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
    if (arg === `--${name}` && i + 1 < process.argv.length) {
      return process.argv[i + 1].trim();
    }
  }
  return undefined;
}

function resolvePort(): number {
  const cliPort = Number(readCliFlag('port'));
  if (Number.isInteger(cliPort) && cliPort > 0 && cliPort < 65536) {
    return cliPort;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT || 8080);
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT || 3000);
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NGINX_PORT &&
    Number.isInteger(envPort) &&
    envPort === nginxPort
  ) {
    return Number.isInteger(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 3000;
  }
  if (Number.isInteger(envPort) && envPort > 0 && envPort < 65536) {
    return envPort;
  }
  return Number.isInteger(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 3000;
}

const PORT = resolvePort();
const HOST = readCliFlag('host') || process.env.HOST || '0.0.0.0';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'iasd-state.json');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_LOGIN_FAILURES = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;

function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password: string, salt?: string, expectedHash?: string): boolean {
  if (!salt || !expectedHash) return false;
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, message: 'A senha deve ter no mínimo 8 caracteres.' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'A senha excede o limite de 128 caracteres.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra e um número.' };
  }
  return { valid: true };
}

function computeSha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function signToken(tokenId: string, userId: string): string {
  const payload = Buffer.from(JSON.stringify({ tid: tokenId, uid: userId })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedToken(token: string): { tid: string; uid: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed.tid === 'string' && typeof parsed.uid === 'string') {
      return { tid: parsed.tid, uid: parsed.uid };
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizeUser(u: StoredUser): Omit<StoredUser, 'passwordSalt' | 'passwordHash'> {
  const { passwordSalt: _s, passwordHash: _h, ...safe } = u;
  return safe;
}

function isVotingRole(role: UserRole | string): boolean {
  return role !== 'observador' && role !== 'administrador';
}

function getDefaultMinistryForRole(role: UserRole): string {
  switch (role) {
    case 'presidente':
      return 'Presidência Pastoral';
    case 'secretario':
      return 'Secretaria Geral';
    case 'tesoureiro':
      return 'Tesouraria & Finanças';
    case 'membro':
      return 'Comissão Administrativa';
    default:
      return 'Administração do Sistema';
  }
}

function syncSessionParticipants(session: Record<string, unknown>, usersList: StoredUser[]): void {
  session.presentesIds = usersList
    .filter(u => u.accountActive !== false && u.presenceStatus === 'presente' && isVotingRole(u.role))
    .map(u => u.id);

  const pres = usersList.find(u => u.accountActive !== false && u.role === 'presidente');
  if (pres) {
    session.presidenteId = pres.id;
    session.presidenteNome = pres.name;
  }

  const sec = usersList.find(u => u.accountActive !== false && u.role === 'secretario');
  if (sec) {
    session.secretarioId = sec.id;
    session.secretarioNome = sec.name;
  }
}

function hasSignatureFromAnotherMember(
  signatures: unknown,
  actor: StoredUser
): { blocked: boolean; otherSigners: string[] } {
  if (!Array.isArray(signatures) || signatures.length === 0) {
    return { blocked: false, otherSigners: [] };
  }
  const otherSigners: string[] = [];
  for (const raw of signatures) {
    if (!raw || typeof raw !== 'object') continue;
    const sig = raw as Record<string, unknown>;
    const signerId = typeof sig.signerId === 'string' ? sig.signerId : '';
    const nome = typeof sig.nome === 'string' ? sig.nome.trim() : '';
    const isSelf =
      (signerId && signerId === actor.id) ||
      (!signerId && nome && nome.toLowerCase() === actor.name.trim().toLowerCase());
    if (!isSelf && (signerId || nome)) {
      otherSigners.push(nome || signerId);
    }
  }
  return { blocked: otherSigners.length > 0, otherSigners };
}

function canUserSignSession(user: StoredUser, session: Record<string, unknown>): boolean {
  if (user.role === 'secretario' || user.role === 'presidente') return true;
  if (session.secretarioId === user.id || session.presidenteId === user.id) return true;
  if (Array.isArray(session.designatedSignersIds) && session.designatedSignersIds.includes(user.id)) {
    return true;
  }
  return false;
}

function createInitialState(): PersistedStore {
  const now = new Date().toISOString();
  const initialUsers: StoredUser[] = [
    {
      id: 'user-pr',
      name: 'Pr. Jean Magnabosco',
      email: 'magnabosco.jean@gmail.com',
      username: 'jean.pastor',
      role: 'presidente',
      isAdmin: false,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: 'presente',
      phone: '+55 11 98765-4321',
      ministry: 'Presidência Pastoral',
      accountActive: true,
      passwordConfigured: false,
      mustChangePassword: true,
      facialEnrolled: true,
      facialAuthorizationStatus: 'autorizada',
      facialAuthorizedBy: 'Presidência IASD Comissões',
      facialAuthorizedAt: now
    },
    {
      id: 'user-sec',
      name: 'Débora Silveira',
      email: 'debora.secretaria@igreja.org',
      username: 'debora.sec',
      role: 'secretario',
      isAdmin: false,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: 'presente',
      phone: '+55 11 98888-1234',
      ministry: 'Secretaria Geral',
      accountActive: true,
      passwordConfigured: false,
      mustChangePassword: true,
      facialEnrolled: false,
      facialAuthorizationStatus: 'nao_cadastrada'
    },
    {
      id: 'user-tes',
      name: 'Carlos Alberto Mendes',
      email: 'carlos.tesouraria@igreja.org',
      username: 'carlos.tesoureiro',
      role: 'tesoureiro',
      isAdmin: false,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: 'presente',
      phone: '+55 11 97777-5678',
      ministry: 'Tesouraria & Finanças',
      accountActive: true,
      passwordConfigured: false,
      mustChangePassword: true,
      facialEnrolled: false,
      facialAuthorizationStatus: 'nao_cadastrada'
    },
    {
      id: 'user-anc',
      name: 'Marcos Aurelio Vasconcelos',
      email: 'marcos.ancionato@igreja.org',
      username: 'marcos.anciao',
      role: 'membro',
      isAdmin: false,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: 'presente',
      phone: '+55 11 96666-9012',
      ministry: 'Ancionato e Família',
      accountActive: true,
      passwordConfigured: false,
      mustChangePassword: true,
      facialEnrolled: false,
      facialAuthorizationStatus: 'nao_cadastrada'
    },
    {
      id: 'user-jov',
      name: 'Beatriz Vasquez',
      email: 'beatriz.jovens@igreja.org',
      username: 'beatriz.jovem',
      role: 'membro',
      isAdmin: false,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: 'presente',
      phone: '+55 11 95555-3456',
      ministry: 'Ministério Jovem',
      accountActive: true,
      passwordConfigured: false,
      mustChangePassword: true,
      facialEnrolled: false,
      facialAuthorizationStatus: 'nao_cadastrada'
    },
    {
      id: 'user-diac',
      name: 'Ezequiel Prado',
      email: 'ezequiel.diaconia@igreja.org',
      username: 'ezequiel.diacono',
      role: 'membro',
      isAdmin: false,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: 'presente',
      phone: '+55 11 94444-7890',
      ministry: 'Diaconia e Patrimônio',
      accountActive: true,
      passwordConfigured: false,
      mustChangePassword: true,
      facialEnrolled: false,
      facialAuthorizationStatus: 'nao_cadastrada'
    }
  ];

  return {
    adminClaimed: false,
    users: initialUsers,
    currentSession: {
      id: 'sess-2026-001',
      numeroAta: 'ATA ORDINÁRIA Nº 01/2026',
      titulo: 'Comissão Diretiva da Igreja — Sessão Ordinária',
      commissionType: 'diretiva',
      dataHora: now,
      local: 'Sala da Comissão Administrativa · Igreja Central',
      presidenteId: 'user-pr',
      presidenteNome: 'Pr. Jean Magnabosco',
      secretarioId: 'user-sec',
      secretarioNome: 'Débora Silveira',
      presentesIds: ['user-pr', 'user-sec', 'user-tes', 'user-anc', 'user-jov', 'user-diac'],
      designatedSignersIds: [],
      signatures: [],
      status: 'em_andamento',
      pautasIds: ['pauta-01', 'pauta-02'],
      ataAprovada: false
    },
    pautas: [
      {
        id: 'pauta-01',
        numeroResolucao: 'Voto nº 01/2026',
        titulo: 'Planejamento Financeiro e Fundo de Manutenção do Templo',
        categoria: 'Financeiro',
        relator: 'Carlos Alberto Mendes (Tesoureiro)',
        propostaTexto:
          'Aprovar a destinação mensal de 15% do orçamento de manutenção para o fundo de reserva estrutural e adequação acústica do santuário principal.',
        textoOriginal: 'Aprovar a destinação mensal de 15% do orçamento para o fundo de reserva estrutural.',
        justificativa:
          'Assegurar previsibilidade orçamentária e preservação preventiva do patrimônio da igreja ao longo do exercício anual.',
        status: 'pautado',
        quorumRequerido: 4,
        dataPautada: now,
        compartilhadaComMembros: true,
        observacoes: [],
        anexos: [],
        votos: {}
      },
      {
        id: 'pauta-02',
        numeroResolucao: 'Voto nº 02/2026',
        titulo: 'Calendário Trimestral de Evangelismo e Ação Comunitária',
        categoria: 'Evangelismo',
        relator: 'Pr. Jean Magnabosco',
        propostaTexto:
          'Autorizar a realização do programa de atendimento comunitário e feira de saúde no próximo trimestre, envolvendo os departamentos de Diaconia, Jovens e Escola Bíblica.',
        textoOriginal: 'Autorizar realização de programa evangelístico e feira de saúde comunitária.',
        justificativa:
          'Cumprir o planejamento missionário anual da igreja local com integração entre todos os ministérios.',
        status: 'pautado',
        quorumRequerido: 4,
        dataPautada: now,
        compartilhadaComMembros: true,
        observacoes: [],
        anexos: [],
        votos: {}
      }
    ],
    elections: [
      {
        id: 'elec-01',
        ministryName: 'Ancionato — Primeiro Ancião',
        descricao:
          'Indicação e votação secreta para a função de Primeiro Ancião da Igreja para o próximo exercício eclesiástico.',
        autoIncorporateOthersAsMembers: true,
        allowMemberNomination: true,
        status: 'configuracao',
        round: 1,
        compartilhadaComMembros: true,
        candidates: [
          {
            id: 'cand-1',
            name: 'Marcos Aurelio Vasconcelos',
            experiencia: 'Experiência pastoral leiga, coordenação de grupos pequenos e visitação.',
            indicadoPor: 'Comissão de Nomeações',
            aceitouIndicacao: 'pendente',
            round1Votes: 0,
            round2Votes: 0,
            status: 'pendente'
          },
          {
            id: 'cand-2',
            name: 'Ezequiel Prado',
            experiencia: 'Atuação consolidada em diaconia, recepção e liderança familiar.',
            indicadoPor: 'Comissão de Nomeações',
            aceitouIndicacao: 'pendente',
            round1Votes: 0,
            round2Votes: 0,
            status: 'pendente'
          }
        ],
        votersWhoCastVoteRound1: [],
        votersWhoCastVoteRound2: [],
        assignedMembers: [],
        totalVoters: 6,
        dataInicio: now
      },
      {
        id: 'elec-02',
        ministryName: 'Ministério de Louvor e Adoração',
        descricao:
          'Escolha do diretor(a) responsável pela coordenação musical, escalas e equipe de adoração.',
        autoIncorporateOthersAsMembers: true,
        allowMemberNomination: true,
        status: 'configuracao',
        round: 1,
        compartilhadaComMembros: true,
        candidates: [
          {
            id: 'cand-3',
            name: 'Felipe Santana',
            experiencia: '10 anos de ministério de louvor, violonista e arranjador.',
            indicadoPor: 'Comissão de Nomeações',
            aceitouIndicacao: 'pendente',
            round1Votes: 0,
            round2Votes: 0,
            status: 'pendente'
          },
          {
            id: 'cand-4',
            name: 'Camila Albuquerque',
            experiencia: 'Pianista e regente do coral jovem há 4 anos.',
            indicadoPor: 'Comissão de Nomeações',
            aceitouIndicacao: 'pendente',
            round1Votes: 0,
            round2Votes: 0,
            status: 'pendente'
          },
          {
            id: 'cand-5',
            name: 'Rodrigo Medeiros',
            experiencia: 'Coordenador técnico de áudio e grupo instrumental.',
            indicadoPor: 'Comissão de Nomeações',
            aceitouIndicacao: 'pendente',
            round1Votes: 0,
            round2Votes: 0,
            status: 'pendente'
          }
        ],
        votersWhoCastVoteRound1: [],
        votersWhoCastVoteRound2: [],
        assignedMembers: [],
        totalVoters: 6,
        dataInicio: now
      }
    ],
    approvedAtas: [],
    accessLogs: [],
    auditLogs: [],
    churchSettings: {
      churchName: 'Igreja Adventista do Sétimo Dia Central',
      churchAddress: 'Av. das Nações, 1500 — Plenário Administrativo',
      districtConference: 'Associação Central das Igrejas',
      quorumPercentage: 50,
      autoNumberResolutions: true,
      resolutionPrefix: 'Voto nº'
    }
  };
}

function loadStore(): PersistedStore {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PersistedStore;
      if (parsed && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to initial clean store
  }
  const initial = createInitialState();
  saveStore(initial);
  return initial;
}

function saveStore(data: PersistedStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

const store: PersistedStore = loadStore();
const activeSessions = new Map<string, SessionRecord>();
const loginAttempts = new Map<string, LoginAttemptRecord>();

function appendServerAudit(userId: string, userName: string, action: string, details: string): void {
  const timestamp = new Date().toISOString();
  const hash = computeSha256(`${userName}|${action}|${details}|${timestamp}`);
  store.auditLogs = [
    {
      id: 'log-' + crypto.randomBytes(4).toString('hex'),
      timestamp,
      userId,
      userName,
      action,
      details,
      encryptedHash: hash
    },
    ...store.auditLogs.slice(0, 199)
  ];
}

function appendServerAccess(
  user: Pick<StoredUser, 'id' | 'name' | 'role'>,
  action: string,
  resourceTitle?: string,
  resourceId?: string,
  deviceInfo?: string
): void {
  const timestamp = new Date().toISOString();
  store.accessLogs = [
    {
      id: 'acc-' + crypto.randomBytes(4).toString('hex'),
      timestamp,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      resourceTitle,
      resourceId,
      deviceInfo: deviceInfo || 'Sessão Verificada'
    },
    ...store.accessLogs.slice(0, 299)
  ];
}

interface AuthedRequest extends Request {
  authSession?: SessionRecord;
  authUser?: StoredUser;
}

function requireAuth(requireFacial: boolean = true) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Sessão não autenticada.' });
      return;
    }

    const token = header.slice(7).trim();
    const verified = verifySignedToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Token de sessão inválido.' });
      return;
    }

    const session = activeSessions.get(verified.tid);
    if (!session || session.userId !== verified.uid || Date.now() > session.expiresAt) {
      if (session) activeSessions.delete(verified.tid);
      res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
      return;
    }

    const user = store.users.find(u => u.id === session.userId);
    if (!user || !user.accountActive) {
      activeSessions.delete(verified.tid);
      res.status(401).json({ error: 'Conta inativa ou não encontrada.' });
      return;
    }

    if (requireFacial && !session.facialVerified) {
      res.status(403).json({ error: 'Verificação facial obrigatória pendente.' });
      return;
    }

    req.authSession = session;
    req.authUser = user;
    next();
  };
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user || (!user.isAdmin && user.role !== 'administrador')) {
    res.status(403).json({
      error: 'Acesso negado. Somente o Administrador do sistema pode alterar ou cadastrar usuários.'
    });
    return;
  }
  next();
}

function requirePresident(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user || user.role !== 'presidente') {
    res.status(403).json({
      error: 'Acesso negado. Somente o Presidente da Comissão pode autorizar ou revogar faces.'
    });
    return;
  }
  next();
}

function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function ensureAdminRecord(): StoredUser | undefined {
  return store.users.find(u => u.isAdmin || u.role === 'administrador');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'IASD Comissões' });
  });

  app.get('/api/auth/bootstrap-status', (_req, res) => {
    const envPasscode = getEnvAdminPasscode();
    const adminUser = ensureAdminRecord();
    const needsAdminSetup = !envPasscode && (!store.adminClaimed || !adminUser?.passwordHash);
    res.json({
      needsAdminSetup,
      adminUsername: adminUser?.username || 'admin'
    });
  });

  // One-time atomic bootstrap for first-run administrator password setup
  app.post('/api/auth/bootstrap-admin', (req: Request, res: Response) => {
    const envPasscode = getEnvAdminPasscode();
    const existingAdmin = ensureAdminRecord();

    if (envPasscode || (store.adminClaimed && existingAdmin?.passwordHash)) {
      res.status(409).json({ error: 'O Administrador já foi configurado neste servidor.' });
      return;
    }

    const { name, email, username, password, role } = req.body || {};
    const cleanName = typeof name === 'string' && name.trim().length >= 3 ? name.trim() : 'Administrador IASD Comissões';
    const cleanEmail = typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : 'admin@iasd.org';
    const cleanUsername =
      typeof username === 'string' && username.trim().length >= 3
        ? username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
        : 'admin';

    const allowedBootstrapRoles: UserRole[] = ['presidente', 'secretario', 'tesoureiro', 'membro', 'administrador'];
    const safeRole: UserRole = allowedBootstrapRoles.includes(role) ? role : 'membro';

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();

    const adminUser: StoredUser = {
      id: 'user-admin',
      name: cleanName,
      email: cleanEmail,
      username: cleanUsername,
      role: safeRole,
      isAdmin: true,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus: isVotingRole(safeRole) ? 'presente' : 'ausente',
      ministry: getDefaultMinistryForRole(safeRole),
      accountActive: true,
      passwordConfigured: true,
      mustChangePassword: false,
      passwordSalt: salt,
      passwordHash: hash,
      facialEnrolled: true,
      facialAuthorizationStatus: 'autorizada',
      facialAuthorizedBy: 'Sistema IASD Comissões',
      facialAuthorizedAt: now,
      lastLoginAt: now
    };

    store.users = [adminUser, ...store.users.filter(u => u.id !== 'user-admin')];
    store.adminClaimed = true;
    syncSessionParticipants(store.currentSession, store.users);
    appendServerAudit(adminUser.id, adminUser.name, 'Administrador Configurado', `Conta administrativa @${cleanUsername} ativada com senha criptografada.`);
    appendServerAccess(adminUser, 'login', 'Primeiro acesso e definição da senha do Administrador');
    saveStore(store);

    const tokenId = crypto.randomBytes(24).toString('hex');
    const session: SessionRecord = {
      tokenId,
      userId: adminUser.id,
      facialVerified: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS
    };
    activeSessions.set(tokenId, session);
    const token = signToken(tokenId, adminUser.id);

    res.status(201).json({
      token,
      user: sanitizeUser(adminUser),
      facialVerified: false,
      mustChangePassword: false
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { identifier, password } = req.body || {};
    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
      res.status(400).json({ error: 'Informe usuário/e-mail e senha.' });
      return;
    }

    const cleanId = identifier.trim().toLowerCase();
    const clientIp = req.ip || 'local';
    const attemptKey = `${clientIp}:${cleanId}`;
    const nowMs = Date.now();
    const attempt = loginAttempts.get(attemptKey);

    if (attempt && attempt.lockedUntil > nowMs) {
      const remainingSec = Math.ceil((attempt.lockedUntil - nowMs) / 1000);
      res.status(429).json({
        error: `Muitas tentativas inválidas. Aguarde ${remainingSec} segundos antes de tentar novamente.`
      });
      return;
    }

    const envPasscode = getEnvAdminPasscode();

    // If ADMIN_PASSCODE env var is configured, allow authenticating as admin even before bootstrap
    let targetUser = store.users.find(
      u => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
    );

    let passwordMatches = false;

    if (envPasscode && (cleanId === 'admin' || targetUser?.isAdmin || targetUser?.role === 'administrador')) {
      const envMatch =
        password.length === envPasscode.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(envPasscode));
      if (envMatch) {
        if (!targetUser) {
          const nowIso = new Date().toISOString();
          targetUser = {
            id: 'user-admin',
            name: 'Administrador IASD Comissões',
            email: 'admin@iasd.org',
            username: 'admin',
            role: 'administrador',
            isAdmin: true,
            avatarUrl: '',
            biometricRegistered: true,
            twoFactorEnabled: true,
            presenceStatus: 'ausente',
            ministry: 'Administração do Sistema',
            accountActive: true,
            passwordConfigured: true,
            mustChangePassword: false,
            facialEnrolled: true,
            facialAuthorizationStatus: 'autorizada',
            facialAuthorizedBy: 'Sistema IASD Comissões',
            facialAuthorizedAt: nowIso
          };
          store.users = [targetUser, ...store.users];
        }
        passwordMatches = true;
      }
    }

    if (!passwordMatches && targetUser) {
      if (!targetUser.passwordConfigured || !targetUser.passwordHash || !targetUser.passwordSalt) {
        res.status(403).json({
          error: 'Esta conta ainda não possui senha definida pelo Administrador. Solicite ao Administrador o cadastro de sua senha.'
        });
        return;
      }
      passwordMatches = verifyPassword(password, targetUser.passwordSalt, targetUser.passwordHash);
    }

    if (!targetUser || !passwordMatches) {
      const prev = attempt && nowMs - attempt.firstFailureAt < FAILURE_WINDOW_MS
        ? attempt
        : { failures: 0, firstFailureAt: nowMs, lockedUntil: 0 };
      const nextFailures = prev.failures + 1;
      const lockedUntil = nextFailures >= MAX_LOGIN_FAILURES ? nowMs + LOCKOUT_MS : 0;
      loginAttempts.set(attemptKey, {
        failures: nextFailures,
        firstFailureAt: prev.firstFailureAt,
        lockedUntil
      });

      appendServerAudit('security', cleanId, 'Tentativa de Login Inválida', `Tentativa recusada para "${cleanId}" (${nextFailures}/${MAX_LOGIN_FAILURES}).`);
      saveStore(store);

      res.status(401).json({
        error:
          lockedUntil > 0
            ? 'Limite de tentativas atingido. Conta temporariamente bloqueada por 5 minutos.'
            : 'Usuário/e-mail ou senha inválidos.'
      });
      return;
    }

    if (!targetUser.accountActive) {
      res.status(403).json({ error: 'Conta desativada pelo Administrador.' });
      return;
    }

    // Clear failed attempts on success
    loginAttempts.delete(attemptKey);

    const nowIso = new Date().toISOString();
    targetUser.lastLoginAt = nowIso;
    appendServerAccess(targetUser, 'login', `Login autenticado de @${targetUser.username} — aguardando etapa facial`, targetUser.id);
    appendServerAudit(targetUser.id, targetUser.name, 'Credenciais Validadas', `${targetUser.name} concluiu a etapa 1 (senha) e avançou para verificação facial.`);
    saveStore(store);

    const tokenId = crypto.randomBytes(24).toString('hex');
    const session: SessionRecord = {
      tokenId,
      userId: targetUser.id,
      facialVerified: false,
      createdAt: nowMs,
      expiresAt: nowMs + SESSION_TTL_MS
    };
    activeSessions.set(tokenId, session);
    const token = signToken(tokenId, targetUser.id);

    res.json({
      token,
      user: sanitizeUser(targetUser),
      facialVerified: false,
      mustChangePassword: Boolean(targetUser.mustChangePassword)
    });
  });

  app.post('/api/auth/change-password', requireAuth(false), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
      return;
    }

    if (!verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'A senha atual informada não confere.' });
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual.' });
      return;
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.passwordConfigured = true;
    user.mustChangePassword = false;

    appendServerAudit(user.id, user.name, 'Senha Atualizada', `${user.name} definiu uma nova senha pessoal.`);
    saveStore(store);

    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', requireAuth(false), (req: AuthedRequest, res: Response) => {
    if (req.authSession) {
      activeSessions.delete(req.authSession.tokenId);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth(false), (req: AuthedRequest, res: Response) => {
    res.json({
      user: sanitizeUser(req.authUser!),
      facialVerified: Boolean(req.authSession?.facialVerified),
      mustChangePassword: Boolean(req.authUser?.mustChangePassword)
    });
  });

  // Facial submission & verification
  app.post('/api/faces/submit', requireAuth(false), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const session = req.authSession!;
    const { snapshotDataUrl, method } = req.body || {};

    if (snapshotDataUrl && (typeof snapshotDataUrl !== 'string' || snapshotDataUrl.length > 600_000)) {
      res.status(400).json({ error: 'Imagem facial inválida ou muito grande.' });
      return;
    }

    const now = new Date().toISOString();
    const safeMethod =
      method === 'camera' || method === 'webauthn' || method === 'verificacao_dispositivo'
        ? method
        : 'camera';
    const hash = computeSha256(`${user.id}|enroll|${safeMethod}|${now}|${snapshotDataUrl ? snapshotDataUrl.slice(0, 128) : 'device'}`).slice(0, 24);
    const canSelfAuthorize = user.role === 'presidente' || user.isAdmin || user.role === 'administrador';

    user.facialEnrolled = true;
    user.facialSignatureHash = hash;
    user.facialVerifiedAt = now;
    if (snapshotDataUrl) user.facialSnapshotDataUrl = snapshotDataUrl;

    if (canSelfAuthorize) {
      user.facialAuthorizationStatus = 'autorizada';
      user.facialAuthorizedBy = user.name;
      user.facialAuthorizedAt = now;
      user.facialRejectionReason = undefined;
      session.facialVerified = true;
      appendServerAccess(user, 'verificacao_facial', `${user.role === 'administrador' ? 'Administrador' : 'Presidente'} autenticado com reconhecimento facial`, user.id);
      appendServerAudit(user.id, user.name, 'Acesso Facial Autorizado', `${user.name} liberado após confirmação facial.`);
      saveStore(store);
      res.json({
        success: true,
        autoAuthorized: true,
        facialVerified: true,
        hash,
        user: sanitizeUser(user)
      });
      return;
    }

    user.facialAuthorizationStatus = 'pendente_autorizacao';
    user.facialAuthorizedBy = undefined;
    user.facialAuthorizedAt = undefined;
    user.facialRejectionReason = undefined;
    session.facialVerified = false;

    appendServerAccess(user, 'verificacao_facial', 'Face capturada e enviada para autorização do Presidente', user.id);
    appendServerAudit(user.id, user.name, 'Face Pendente de Autorização', `${user.name} enviou captura facial e aguarda autorização do Presidente.`);
    saveStore(store);

    res.json({
      success: true,
      autoAuthorized: false,
      facialVerified: false,
      hash,
      user: sanitizeUser(user)
    });
  });

  app.post('/api/faces/verify', requireAuth(false), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const session = req.authSession!;
    if (user.mustChangePassword) {
      res.status(403).json({ error: 'Altere sua senha provisória antes de concluir o reconhecimento facial.' });
      return;
    }

    const isAuthorized =
      user.role === 'presidente' ||
      user.isAdmin ||
      user.role === 'administrador' ||
      user.facialAuthorizationStatus === 'autorizada';

    const { snapshotDataUrl, method } = req.body || {};
    if (snapshotDataUrl && (typeof snapshotDataUrl !== 'string' || snapshotDataUrl.length > 600_000)) {
      res.status(400).json({ error: 'Imagem facial inválida.' });
      return;
    }

    if (!isAuthorized) {
      res.status(403).json({ error: 'Sua face ainda não foi autorizada pelo Presidente.' });
      return;
    }

    const now = new Date().toISOString();
    const safeMethod =
      method === 'camera' || method === 'webauthn' || method === 'verificacao_dispositivo'
        ? method
        : 'camera';
    const hash = computeSha256(`${user.id}|${safeMethod}|${now}`).slice(0, 24);

    user.facialEnrolled = true;
    user.facialAuthorizationStatus = 'autorizada';
    user.facialSignatureHash = hash;
    user.facialVerifiedAt = now;
    if (snapshotDataUrl) user.facialSnapshotDataUrl = snapshotDataUrl;

    session.facialVerified = true;
    appendServerAccess(user, 'verificacao_facial', `Reconhecimento facial validado (${safeMethod})`, user.id);
    appendServerAudit(user.id, user.name, 'Reconhecimento Facial Aprovado', `${user.name} liberado(a) para o sistema após reconhecimento facial.`);
    saveStore(store);

    res.json({
      success: true,
      facialVerified: true,
      hash,
      user: sanitizeUser(user)
    });
  });

  app.post('/api/faces/:userId/authorize', requireAuth(true), requirePresident, (req: AuthedRequest, res: Response) => {
    const president = req.authUser!;
    const target = store.users.find(u => u.id === req.params.userId);
    if (!target) {
      res.status(404).json({ error: 'Membro não encontrado.' });
      return;
    }
    const now = new Date().toISOString();
    target.facialEnrolled = true;
    target.facialAuthorizationStatus = 'autorizada';
    target.facialAuthorizedBy = president.name;
    target.facialAuthorizedAt = now;
    target.facialRejectionReason = undefined;

    appendServerAccess(president, 'autorizacao_facial', `Face de ${target.name} autorizada pelo Presidente`, target.id);
    appendServerAudit(president.id, president.name, 'Face Autorizada pelo Presidente', `Presidente ${president.name} autorizou o acesso facial de ${target.name}.`);
    saveStore(store);
    res.json({ user: sanitizeUser(target), users: store.users.map(sanitizeUser) });
  });

  app.post('/api/faces/:userId/reject', requireAuth(true), requirePresident, (req: AuthedRequest, res: Response) => {
    const president = req.authUser!;
    const target = store.users.find(u => u.id === req.params.userId);
    if (!target) {
      res.status(404).json({ error: 'Membro não encontrado.' });
      return;
    }
    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : 'Solicitada nova captura facial pelo Presidente.';
    target.facialAuthorizationStatus = 'recusada';
    target.facialAuthorizedBy = undefined;
    target.facialAuthorizedAt = undefined;
    target.facialRejectionReason = reason;

    appendServerAccess(president, 'autorizacao_facial', `Nova captura solicitada para ${target.name}`, target.id);
    appendServerAudit(president.id, president.name, 'Face Recusada pelo Presidente', `Presidente ${president.name} solicitou nova captura facial de ${target.name}: ${reason}`);
    saveStore(store);
    res.json({ user: sanitizeUser(target), users: store.users.map(sanitizeUser) });
  });

  app.post('/api/faces/:userId/revoke', requireAuth(true), requirePresident, (req: AuthedRequest, res: Response) => {
    const president = req.authUser!;
    const target = store.users.find(u => u.id === req.params.userId);
    if (!target) {
      res.status(404).json({ error: 'Membro não encontrado.' });
      return;
    }
    if (target.role === 'presidente' || target.isAdmin) {
      res.status(400).json({ error: 'Não é possível revogar a face da Presidência ou Administração.' });
      return;
    }
    target.facialEnrolled = false;
    target.facialAuthorizationStatus = 'nao_cadastrada';
    target.facialAuthorizedBy = undefined;
    target.facialAuthorizedAt = undefined;
    target.facialRejectionReason = undefined;
    target.facialSignatureHash = undefined;

    for (const [tid, sess] of activeSessions.entries()) {
      if (sess.userId === target.id) {
        activeSessions.delete(tid);
      }
    }

    appendServerAccess(president, 'autorizacao_facial', `Autorização facial de ${target.name} revogada`, target.id);
    appendServerAudit(president.id, president.name, 'Autorização Facial Revogada', `Presidente ${president.name} revogou a autorização facial de ${target.name}.`);
    saveStore(store);
    res.json({ user: sanitizeUser(target), users: store.users.map(sanitizeUser) });
  });

  // Strict Admin-Only User Management Endpoints
  app.get('/api/users', requireAuth(true), (_req: AuthedRequest, res: Response) => {
    res.json({ users: store.users.map(sanitizeUser) });
  });

  app.post('/api/users', requireAuth(true), requireAdmin, (req: AuthedRequest, res: Response) => {
    const admin = req.authUser!;
    const {
      name,
      email,
      username,
      password,
      role,
      isAdmin: grantAdmin,
      ministry,
      phone,
      presenceStatus,
      accountActive,
      mustChangePassword
    } = req.body || {};

    if (typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Informe nome completo e e-mail válido.' });
      return;
    }

    const cleanUsername = (typeof username === 'string' && username.trim()
      ? username.trim()
      : email.split('@')[0]
    )
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');

    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres válidos.' });
      return;
    }

    if (store.users.some(u => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === email.trim().toLowerCase())) {
      res.status(409).json({ error: 'Já existe um usuário cadastrado com este login ou e-mail.' });
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }

    const allowedRoles: UserRole[] = ['presidente', 'secretario', 'tesoureiro', 'membro', 'administrador'];
    const safeRole: UserRole = allowedRoles.includes(role) ? role : 'membro';
    const isUserAdmin = Boolean(grantAdmin) || safeRole === 'administrador';
    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();

    const newUser: StoredUser = {
      id: 'user-' + crypto.randomBytes(4).toString('hex'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      username: cleanUsername,
      role: safeRole,
      isAdmin: isUserAdmin,
      avatarUrl: '',
      biometricRegistered: true,
      twoFactorEnabled: true,
      presenceStatus:
        !isVotingRole(safeRole)
          ? 'ausente'
          : presenceStatus === 'ausente' || presenceStatus === 'remoto'
          ? presenceStatus
          : 'presente',
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
      ministry: typeof ministry === 'string' && ministry.trim() ? ministry.trim() : getDefaultMinistryForRole(safeRole),
      accountActive: accountActive !== false,
      passwordConfigured: true,
      mustChangePassword: mustChangePassword !== false,
      passwordSalt: salt,
      passwordHash: hash,
      facialEnrolled: safeRole === 'presidente' || isUserAdmin,
      facialAuthorizationStatus: safeRole === 'presidente' || isUserAdmin ? 'autorizada' : 'nao_cadastrada',
      facialAuthorizedBy: safeRole === 'presidente' || isUserAdmin ? admin.name : undefined,
      facialAuthorizedAt: safeRole === 'presidente' || isUserAdmin ? now : undefined
    };

    store.users.push(newUser);
    syncSessionParticipants(store.currentSession, store.users);
    appendServerAudit(admin.id, admin.name, 'Novo Usuário Cadastrado', `Administrador ${admin.name} cadastrou ${newUser.name} (@${newUser.username}).`);
    saveStore(store);

    res.status(201).json({ user: sanitizeUser(newUser), users: store.users.map(sanitizeUser) });
  });

  app.patch('/api/users/:userId', requireAuth(true), requireAdmin, (req: AuthedRequest, res: Response) => {
    const admin = req.authUser!;
    const target = store.users.find(u => u.id === req.params.userId);
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const {
      name,
      email,
      username,
      newPassword,
      role,
      isAdmin: nextIsAdmin,
      ministry,
      phone,
      avatarUrl,
      presenceStatus,
      accountActive,
      biometricRegistered,
      twoFactorEnabled,
      mustChangePassword
    } = req.body || {};

    if (typeof name === 'string' && name.trim().length >= 2) target.name = name.trim();
    if (typeof email === 'string' && email.includes('@')) {
      const cleanEmail = email.trim().toLowerCase();
      if (store.users.some(u => u.id !== target.id && u.email.toLowerCase() === cleanEmail)) {
        res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário.' });
        return;
      }
      target.email = cleanEmail;
    }
    if (typeof username === 'string' && username.trim().length >= 3) {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (store.users.some(u => u.id !== target.id && u.username.toLowerCase() === cleanUsername)) {
        res.status(409).json({ error: 'Este nome de usuário já está em uso.' });
        return;
      }
      target.username = cleanUsername;
    }

    if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        res.status(400).json({ error: strength.message });
        return;
      }
      const { salt, hash } = hashPassword(newPassword);
      target.passwordSalt = salt;
      target.passwordHash = hash;
      target.passwordConfigured = true;
      target.mustChangePassword = mustChangePassword !== false;
    } else if (typeof mustChangePassword === 'boolean') {
      target.mustChangePassword = mustChangePassword;
    }

    // Admin can hold ANY commission role (presidente, secretario, tesoureiro, membro) or pure administrador
    const allowedRoles: UserRole[] = ['presidente', 'secretario', 'tesoureiro', 'membro', 'administrador'];
    if (allowedRoles.includes(role)) {
      target.role = role;
      if (role === 'presidente') {
        target.facialAuthorizationStatus = 'autorizada';
        target.facialEnrolled = true;
      }
      if (isVotingRole(role) && target.presenceStatus === 'ausente' && presenceStatus === undefined) {
        target.presenceStatus = 'presente';
      }
    }

    if (typeof nextIsAdmin === 'boolean') {
      if (target.id === admin.id && !nextIsAdmin) {
        res.status(400).json({ error: 'Você não pode remover o próprio privilégio de Administrador ativo.' });
        return;
      }
      target.isAdmin = nextIsAdmin;
    }

    if (typeof ministry === 'string') target.ministry = ministry.trim() || getDefaultMinistryForRole(target.role);
    if (typeof phone === 'string') target.phone = phone.trim() || undefined;
    if (typeof avatarUrl === 'string') target.avatarUrl = avatarUrl.trim();
    if (presenceStatus === 'presente' || presenceStatus === 'ausente' || presenceStatus === 'remoto') {
      target.presenceStatus = presenceStatus;
    }
    if (typeof accountActive === 'boolean' && target.id !== admin.id) {
      target.accountActive = accountActive;
      if (!accountActive) {
        for (const [tid, sess] of activeSessions.entries()) {
          if (sess.userId === target.id) activeSessions.delete(tid);
        }
      }
    }
    if (typeof biometricRegistered === 'boolean') target.biometricRegistered = biometricRegistered;
    if (typeof twoFactorEnabled === 'boolean') target.twoFactorEnabled = twoFactorEnabled;

    syncSessionParticipants(store.currentSession, store.users);

    appendServerAudit(admin.id, admin.name, 'Usuário Alterado', `Administrador ${admin.name} atualizou o cadastro de ${target.name} (@${target.username}).`);
    saveStore(store);
    res.json({ user: sanitizeUser(target), users: store.users.map(sanitizeUser), currentSession: store.currentSession });
  });

  app.delete('/api/users/:userId', requireAuth(true), requireAdmin, (req: AuthedRequest, res: Response) => {
    const admin = req.authUser!;
    if (req.params.userId === admin.id) {
      res.status(400).json({ error: 'O Administrador não pode excluir a própria conta ativa.' });
      return;
    }
    const target = store.users.find(u => u.id === req.params.userId);
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    store.users = store.users.filter(u => u.id !== target.id);
    for (const [tid, sess] of activeSessions.entries()) {
      if (sess.userId === target.id) activeSessions.delete(tid);
    }
    syncSessionParticipants(store.currentSession, store.users);
    appendServerAudit(admin.id, admin.name, 'Usuário Removido', `Administrador ${admin.name} removeu ${target.name} (@${target.username}).`);
    saveStore(store);
    res.json({ users: store.users.map(sanitizeUser), currentSession: store.currentSession });
  });

  // Strict Admin-Only Pauta Deletion
  app.delete('/api/pautas/:pautaId', requireAuth(true), requireAdmin, (req: AuthedRequest, res: Response) => {
    const admin = req.authUser!;
    const target = store.pautas.find(p => p.id === req.params.pautaId);
    if (!target) {
      res.status(404).json({ error: 'Proposta/pauta não encontrada.' });
      return;
    }
    store.pautas = store.pautas.filter(p => p.id !== req.params.pautaId);
    if (Array.isArray(store.currentSession.pautasIds)) {
      store.currentSession.pautasIds = (store.currentSession.pautasIds as string[]).filter(
        id => id !== req.params.pautaId
      );
    }
    appendServerAudit(admin.id, admin.name, 'Proposta Excluída', `Administrador ${admin.name} excluiu a proposta "${String(target.titulo || req.params.pautaId)}".`);
    saveStore(store);
    res.json({
      pautas: store.pautas,
      currentSession: store.currentSession,
      auditLogs: store.auditLogs
    });
  });

  // Digital Signature on Current Session Ata (Secretário, Presidente ou Pessoa Designada)
  app.post('/api/atas/current/sign', requireAuth(true), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    if (!canUserSignSession(user, store.currentSession)) {
      res.status(403).json({
        error: 'Apenas o(a) Secretário(a), o Presidente ou uma pessoa designada pela comissão pode assinar esta ata.'
      });
      return;
    }

    const { signatureDataUrl, cargoLabel } = req.body || {};
    if (
      typeof signatureDataUrl !== 'string' ||
      (!signatureDataUrl.startsWith('data:image/png;base64,') && !signatureDataUrl.startsWith('data:image/jpeg;base64,')) ||
      signatureDataUrl.length > 350_000
    ) {
      res.status(400).json({ error: 'Desenhe uma assinatura digital válida na tela antes de confirmar.' });
      return;
    }

    const now = new Date().toISOString();
    const isDesignated =
      user.role !== 'secretario' &&
      user.role !== 'presidente' &&
      store.currentSession.secretarioId !== user.id &&
      store.currentSession.presidenteId !== user.id;

    const resolvedCargo =
      typeof cargoLabel === 'string' && cargoLabel.trim()
        ? cargoLabel.trim().slice(0, 60)
        : user.role === 'secretario' || store.currentSession.secretarioId === user.id
        ? 'Secretário(a)'
        : user.role === 'presidente' || store.currentSession.presidenteId === user.id
        ? 'Presidente'
        : 'Membro Designado';

    const sigHash = computeSha256(
      `${store.currentSession.id}|${user.id}|${resolvedCargo}|${now}|${signatureDataUrl.slice(0, 128)}`
    );

    const newSignature = {
      id: 'sig-' + crypto.randomBytes(4).toString('hex'),
      signerId: user.id,
      nome: user.name,
      cargo: resolvedCargo,
      role: user.role,
      signatureDataUrl,
      signedAt: now,
      hash: `SHA256:${sigHash}`,
      isDesignated
    };

    const existing = Array.isArray(store.currentSession.signatures)
      ? (store.currentSession.signatures as Array<Record<string, unknown>>)
      : [];

    store.currentSession.signatures = [
      ...existing.filter(s => s.signerId !== user.id),
      newSignature
    ];

    appendServerAccess(user, 'leitura_ata', `Assinatura digital registrada na ${String(store.currentSession.numeroAta || 'Ata')}`, String(store.currentSession.id || 'current'));
    appendServerAudit(user.id, user.name, 'Ata Assinada Digitalmente', `${user.name} (${resolvedCargo}) assinou digitalmente a ata em tela.`);
    saveStore(store);

    res.json({
      signature: newSignature,
      currentSession: store.currentSession,
      auditLogs: store.auditLogs,
      accessLogs: store.accessLogs
    });
  });

  // Digital Signature on an Archived Ata (Secretário, Presidente ou Pessoa Designada)
  app.post('/api/atas/:ataId/sign', requireAuth(true), (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const ata = store.approvedAtas.find(a => a.id === req.params.ataId);
    if (!ata) {
      res.status(404).json({ error: 'Ata arquivada não encontrada.' });
      return;
    }

    if (!canUserSignSession(user, store.currentSession)) {
      res.status(403).json({
        error: 'Apenas o(a) Secretário(a), o Presidente ou uma pessoa designada pode assinar esta ata.'
      });
      return;
    }

    const { signatureDataUrl, cargoLabel } = req.body || {};
    if (
      typeof signatureDataUrl !== 'string' ||
      (!signatureDataUrl.startsWith('data:image/png;base64,') && !signatureDataUrl.startsWith('data:image/jpeg;base64,')) ||
      signatureDataUrl.length > 350_000
    ) {
      res.status(400).json({ error: 'Desenhe uma assinatura digital válida na tela antes de confirmar.' });
      return;
    }

    const now = new Date().toISOString();
    const resolvedCargo =
      typeof cargoLabel === 'string' && cargoLabel.trim()
        ? cargoLabel.trim().slice(0, 60)
        : user.role === 'secretario' || store.currentSession.secretarioId === user.id
        ? 'Secretário(a)'
        : user.role === 'presidente' || store.currentSession.presidenteId === user.id
        ? 'Presidente'
        : 'Membro Designado';

    const sigHash = computeSha256(`${String(ata.id)}|${user.id}|${resolvedCargo}|${now}|${signatureDataUrl.slice(0, 128)}`);
    const newEntry = {
      signerId: user.id,
      cargo: resolvedCargo,
      nome: user.name,
      dataHora: now,
      hash: `SHA256:${sigHash}`,
      signatureDataUrl
    };

    const currentSigs = Array.isArray(ata.assinaturasDigitais)
      ? (ata.assinaturasDigitais as Array<Record<string, unknown>>)
      : [];
    ata.assinaturasDigitais = [
      ...currentSigs.filter(s => s.signerId !== user.id && s.nome !== user.name),
      newEntry
    ];

    appendServerAccess(user, 'leitura_ata', `Assinatura digital na ata arquivada ${String(ata.numeroAta || '')}`, String(ata.id));
    appendServerAudit(user.id, user.name, 'Ata Arquivada Assinada', `${user.name} (${resolvedCargo}) assinou digitalmente a ata ${String(ata.numeroAta || '')}.`);
    saveStore(store);

    res.json({
      ata,
      approvedAtas: store.approvedAtas,
      auditLogs: store.auditLogs,
      accessLogs: store.accessLogs
    });
  });

  // Strict Admin-Only Current Ata Deletion (Blocked if signed by another commission member)
  app.delete('/api/atas/current', requireAuth(true), requireAdmin, (req: AuthedRequest, res: Response) => {
    const admin = req.authUser!;
    const currentCheck = hasSignatureFromAnotherMember(store.currentSession.signatures, admin);
    if (currentCheck.blocked) {
      res.status(409).json({
        error: `Não é possível excluir esta ata porque ela já foi assinada digitalmente por outro membro da comissão (${currentCheck.otherSigners.join(', ')}).`
      });
      return;
    }

    const matchingArchived = store.approvedAtas.find(
      a => a.hashAta && store.currentSession.hashAta && a.hashAta === store.currentSession.hashAta
    );
    if (matchingArchived) {
      const archivedCheck = hasSignatureFromAnotherMember(matchingArchived.assinaturasDigitais, admin);
      if (archivedCheck.blocked) {
        res.status(409).json({
          error: `Não é possível excluir esta ata porque a versão arquivada possui assinatura de outro membro (${archivedCheck.otherSigners.join(', ')}).`
        });
        return;
      }
      store.approvedAtas = store.approvedAtas.filter(a => a.id !== matchingArchived.id);
    }

    const deletedNum = String(store.currentSession.numeroAta || 'Ata Atual');
    store.currentSession = {
      ...store.currentSession,
      ataAprovada: false,
      dataAprovacao: undefined,
      hashAta: undefined,
      signatures: [],
      designatedSignersIds: [],
      customOpeningNotes: undefined,
      customClosingNotes: undefined
    };

    appendServerAudit(admin.id, admin.name, 'Ata Atual Excluída', `Administrador ${admin.name} excluiu/reiniciou a ata (${deletedNum}), pois não havia assinatura de outro membro.`);
    saveStore(store);

    res.json({
      currentSession: store.currentSession,
      approvedAtas: store.approvedAtas,
      auditLogs: store.auditLogs
    });
  });

  // Strict Admin-Only Archived Ata Deletion (Blocked if signed by another commission member)
  app.delete('/api/atas/:ataId', requireAuth(true), requireAdmin, (req: AuthedRequest, res: Response) => {
    const admin = req.authUser!;
    const target = store.approvedAtas.find(a => a.id === req.params.ataId);
    if (!target) {
      res.status(404).json({ error: 'Ata arquivada não encontrada.' });
      return;
    }

    const check = hasSignatureFromAnotherMember(target.assinaturasDigitais, admin);
    if (check.blocked) {
      res.status(409).json({
        error: `Não é possível excluir a ata porque ela já foi assinada por outro membro da comissão (${check.otherSigners.join(', ')}).`
      });
      return;
    }

    store.approvedAtas = store.approvedAtas.filter(a => a.id !== target.id);
    if (store.currentSession.hashAta && target.hashAta && store.currentSession.hashAta === target.hashAta) {
      store.currentSession = {
        ...store.currentSession,
        ataAprovada: false,
        dataAprovacao: undefined,
        hashAta: undefined
      };
    }

    appendServerAudit(admin.id, admin.name, 'Ata Arquivada Excluída', `Administrador ${admin.name} excluiu a ata ${String(target.numeroAta || target.id)}.`);
    saveStore(store);

    res.json({
      approvedAtas: store.approvedAtas,
      currentSession: store.currentSession,
      auditLogs: store.auditLogs
    });
  });

  // Commission state (separated from users so non-admins can vote/deliberate without ever mutating users)
  app.get('/api/commission', requireAuth(true), (_req: AuthedRequest, res: Response) => {
    res.json({
      users: store.users.map(sanitizeUser),
      currentSession: store.currentSession,
      pautas: store.pautas,
      elections: store.elections,
      approvedAtas: store.approvedAtas,
      accessLogs: store.accessLogs,
      auditLogs: store.auditLogs,
      churchSettings: store.churchSettings
    });
  });

  app.put('/api/commission', requireAuth(true), (req: AuthedRequest, res: Response) => {
    const actor = req.authUser!;
    const isAdmin = Boolean(actor.isAdmin || actor.role === 'administrador');
    const body = req.body || {};

    if (Array.isArray(body.pautas)) {
      const nextIds = new Set(body.pautas.map((p: Record<string, unknown>) => p?.id));
      const removedPautas = store.pautas.filter(p => !nextIds.has(p.id));
      if (removedPautas.length > 0 && !isAdmin) {
        res.status(403).json({ error: 'Somente o Administrador pode excluir propostas da comissão.' });
        return;
      }
      store.pautas = body.pautas;
    }

    if (Array.isArray(body.approvedAtas)) {
      const nextAtaIds = new Set(body.approvedAtas.map((a: Record<string, unknown>) => a?.id));
      const removedAtas = store.approvedAtas.filter(a => !nextAtaIds.has(a.id));
      if (removedAtas.length > 0) {
        if (!isAdmin) {
          res.status(403).json({ error: 'Somente o Administrador pode excluir atas.' });
          return;
        }
        for (const ata of removedAtas) {
          const check = hasSignatureFromAnotherMember(ata.assinaturasDigitais, actor);
          if (check.blocked) {
            res.status(409).json({
              error: `Não é possível excluir ata assinada por outro membro (${check.otherSigners.join(', ')}).`
            });
            return;
          }
        }
      }
      store.approvedAtas = body.approvedAtas;
    }

    if (body.currentSession && typeof body.currentSession === 'object') {
      const incoming = body.currentSession as Record<string, unknown>;
      // Preserve server-verified digital signatures of other members against accidental overwrite
      const existingSigs = Array.isArray(store.currentSession.signatures)
        ? (store.currentSession.signatures as Array<Record<string, unknown>>)
        : [];
      const checkOther = hasSignatureFromAnotherMember(existingSigs, actor);
      if (checkOther.blocked && Array.isArray(incoming.signatures)) {
        const incomingIds = new Set(
          incoming.signatures.map((s: Record<string, unknown>) => String(s?.signerId || ''))
        );
        const strippedOther = existingSigs.some(
          s => s.signerId && s.signerId !== actor.id && !incomingIds.has(String(s.signerId))
        );
        if (strippedOther) {
          res.status(409).json({
            error: 'Não é possível remover assinaturas digitais registradas por outros membros da comissão.'
          });
          return;
        }
      }
      store.currentSession = {
        ...incoming,
        signatures: Array.isArray(incoming.signatures) ? incoming.signatures : existingSigs
      };
    }

    if (Array.isArray(body.elections)) {
      store.elections = body.elections;
    }
    if (Array.isArray(body.accessLogs)) {
      store.accessLogs = body.accessLogs.slice(0, 300);
    }
    if (Array.isArray(body.auditLogs)) {
      store.auditLogs = body.auditLogs.slice(0, 200);
    }
    if (body.churchSettings && typeof body.churchSettings === 'object') {
      store.churchSettings = body.churchSettings;
    }
    saveStore(store);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    let viteMiddleware: express.RequestHandler | null = null;
    let viteInitError: Error | null = null;
    const viteReadyPromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    })
      .then(vite => {
        viteMiddleware = vite.middlewares;
        return vite;
      })
      .catch(err => {
        viteInitError = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to initialize Vite dev middleware:', viteInitError);
        return null;
      });

    app.use(async (req, res, next) => {
      if (!viteMiddleware && !viteInitError) {
        await viteReadyPromise;
      }
      if (viteInitError) {
        res.status(500).send('Erro ao inicializar o servidor de desenvolvimento.');
        return;
      }
      if (viteMiddleware) {
        viteMiddleware(req, res, next);
        return;
      }
      next();
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`IASD Comissões server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
