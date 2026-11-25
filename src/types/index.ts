export type UserRole =
  | 'administrador'
  | 'presidente'
  | 'secretario'
  | 'tesoureiro'
  | 'membro'
  | 'conselheiro'
  | 'observador';

export type CommissionMode = 'diretiva' | 'nomeacoes';

export type FacialAuthorizationStatus = 'nao_cadastrada' | 'pendente_autorizacao' | 'autorizada' | 'recusada';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string; // Nome de usuário único definido pelo Administrador
  role: UserRole;
  isAdmin?: boolean;
  avatarUrl: string;
  biometricRegistered: boolean;
  twoFactorEnabled: boolean;
  presenceStatus: 'presente' | 'ausente' | 'remoto';
  phone?: string;
  ministry?: string;
  accountActive?: boolean;
  passwordConfigured?: boolean;
  mustChangePassword?: boolean;
  facialEnrolled?: boolean;
  facialSignatureHash?: string;
  facialVerifiedAt?: string;
  facialSnapshotDataUrl?: string;
  facialAuthorizationStatus?: FacialAuthorizationStatus;
  facialAuthorizedBy?: string;
  facialAuthorizedAt?: string;
  facialRejectionReason?: string;
  lastLoginAt?: string;
}

export type PautaStatus = 
  | 'pautado'       // Assunto cadastrado
  | 'em_leitura'    // Lido para observações dos membros
  | 'em_edicao'     // Ajuste de texto final pelos membros/secretaria
  | 'votacao_aberta'// Votação secreta em andamento
  | 'aprovado'      // Votado e aprovado (> 50%)
  | 'rejeitado'     // Votado e rejeitado
  | 'empate';       // Empate necessita voto de minerva ou revisão

export interface PautaObservation {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  comment: string;
  suggestedRevision?: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  sizeBytes: number; // Max 50MB (52,428,800 bytes)
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  dataUrl?: string; // base64 / blob
  checksumSha256?: string;
}

export interface VoteRecord {
  pautaId: string;
  userId: string;
  userName: string;
  choice: 'favor' | 'contra' | 'abstencao';
  timestamp: string;
  ipHash?: string;
  signature?: string;
}

export interface PautaItem {
  id: string;
  numeroResolucao?: string; // ex: Voto nº 01/2026
  titulo: string;
  categoria: 'Administrativo' | 'Financeiro' | 'Patrimônio' | 'Eclesiástico' | 'Disciplinar' | 'Evangelismo' | 'Ministérios';
  relator: string;
  propostaTexto: string;
  textoOriginal: string;
  justificativa: string;
  status: PautaStatus;
  observacoes: PautaObservation[];
  anexos: AttachmentFile[];
  votos: Record<string, VoteRecord>; // key: userId
  quorumRequerido: number;
  dataPautada: string;
  votacaoIniciadaEm?: string;
  votacaoEncerradaEm?: string;
  resultadoFinal?: {
    totalVotantes: number;
    favor: number;
    contra: number;
    abstencao: number;
    percentualFavor: number;
    aprovado: boolean;
    dataResolucao: string;
  };
  compartilhadaComMembros?: boolean; // Controlado pelo presidente/admin
}

export interface AtaSignatureRecord {
  id: string;
  signerId: string;
  nome: string;
  cargo: string;
  role: UserRole;
  signatureDataUrl: string;
  signedAt: string;
  hash: string;
  isDesignated?: boolean;
}

export interface MeetingSession {
  id: string;
  numeroAta: string; // Ex: ATA ORDINÁRIA Nº 01/2026
  titulo: string;
  commissionType?: CommissionMode;
  dataHora: string;
  local: string;
  presidenteId: string;
  presidenteNome: string;
  secretarioId: string;
  secretarioNome: string;
  presentesIds: string[];
  designatedSignersIds?: string[];
  signatures?: AtaSignatureRecord[];
  status: 'agendada' | 'em_andamento' | 'encerrada';
  pautasIds: string[];
  hashAta?: string;
  googleCalendarEventId?: string;
  igrejaNome?: string;
  customOpeningNotes?: string;
  customClosingNotes?: string;
  ataAprovada?: boolean;
  dataAprovacao?: string;
}

export interface ChurchSettings {
  churchName: string;
  churchAddress: string;
  districtConference: string;
  quorumPercentage: number; // default 50
  autoNumberResolutions: boolean;
  resolutionPrefix: string; // e.g. "Voto nº"
}

// Comissão de Nomeações / Eleições de Líderes de Ministérios
export interface Candidate {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  experiencia?: string;
  indicadoPor?: string;
  aceitouIndicacao?: 'pendente' | 'aceito' | 'recusado';
  round1Votes: number;
  round2Votes: number;
  status: 'pendente' | 'eleito' | 'segundo_turno' | 'incorporado_membro' | 'nao_eleito';
}

export interface MinistryElection {
  id: string;
  ministryName: string;
  descricao: string;
  autoIncorporateOthersAsMembers: boolean;
  allowMemberNomination?: boolean;
  status: 'configuracao' | 'votacao_turno_1' | 'apuracao_turno_1' | 'votacao_turno_2' | 'apuracao_turno_2' | 'concluido';
  round: 1 | 2;
  candidates: Candidate[];
  votersWhoCastVoteRound1: string[];
  votersWhoCastVoteRound2: string[];
  electedLeaderId?: string;
  electedLeaderName?: string;
  assignedMembers: string[];
  totalVoters: number;
  dataInicio: string;
  dataFim?: string;
  compartilhadaComMembros?: boolean;
}

export interface ApprovedAtaRecord {
  id: string;
  numeroAta: string;
  titulo: string;
  dataSessao: string;
  dataAprovacao: string;
  presidenteNome: string;
  secretarioNome: string;
  local: string;
  presentesNomes: string[];
  votosAprovados: {
    numeroResolucao: string;
    titulo: string;
    categoria: string;
    propostaTexto: string;
    resultado: {
      favor: number;
      contra: number;
      abstencao: number;
      percentualFavor: number;
    };
  }[];
  eleicoesConcluidas?: {
    ministryName: string;
    electedLeaderName: string;
    assignedMembers: string[];
  }[];
  conteudoCompleto: string;
  hashAta: string;
  assinaturasDigitais: {
    signerId?: string;
    cargo: string;
    nome: string;
    dataHora: string;
    hash: string;
    signatureDataUrl?: string;
  }[];
}

export interface AccessLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'acesso_portal_membro' | 'leitura_ata' | 'voto_registrado' | 'download_ata' | 'login' | 'verificacao_facial' | 'autorizacao_facial';
  resourceTitle?: string;
  resourceId?: string;
  deviceInfo?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  encryptedHash: string;
}
