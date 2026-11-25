import React, { useState, useEffect, useRef } from 'react';
import { useChurch } from '../store/churchStore';
import { UserRole } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { formatUserRoleSummary, isSystemAdmin } from '../utils/roles';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  User as UserIcon,
  AlertCircle,
  ScanFace,
  Camera,
  RefreshCw,
  ArrowLeft,
  Fingerprint,
  Upload,
  Clock,
  CheckCircle2,
  UserCheck,
  Mail,
  Shield
} from 'lucide-react';

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
    };
  }
}

export const LoginModal: React.FC = () => {
  const {
    users,
    currentUser,
    isAuthenticated,
    isBiometricAuthenticated,
    needsAdminSetup,
    bootstrapStatusLoaded,
    bootstrapAdminAccount,
    loginWithCredentials,
    changeOwnPassword,
    submitFaceForPresidentApproval,
    verifyFacialRecognition,
    refreshUsersFromStorage,
    logout
  } = useChurch();

  // Step 0: Initial Admin Bootstrap Form
  const [adminName, setAdminName] = useState('Administrador IASD Comissões');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminRole, setAdminRole] = useState<UserRole>('membro');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Step 1: Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1.5: Mandatory Password Change
  const [currentPassForChange, setCurrentPassForChange] = useState('');
  const [newPersonalPass, setNewPersonalPass] = useState('');
  const [confirmPersonalPass, setConfirmPersonalPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // Step 2: Facial Recognition & Authorization State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'denied' | 'unavailable'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [scanStatus, setScanStatus] = useState('Posicione seu rosto dentro da moldura');
  const [isVerifyingFace, setIsVerifyingFace] = useState(false);
  const [resubmittingFace, setResubmittingFace] = useState(false);
  const [pendingCheckNotice, setPendingCheckNotice] = useState<string | null>(null);

  const needsPasswordChange = isAuthenticated && Boolean(currentUser?.mustChangePassword);
  const needsFacialStep =
    isAuthenticated && !needsPasswordChange && !isBiometricAuthenticated && Boolean(currentUser);

  const activeRecord = currentUser ? users.find(u => u.id === currentUser.id) || currentUser : null;
  const authStatus = activeRecord
    ? activeRecord.role === 'presidente' || isSystemAdmin(activeRecord)
      ? 'autorizada'
      : activeRecord.facialAuthorizationStatus || 'nao_cadastrada'
    : 'nao_cadastrada';

  const isWaitingPresident = needsFacialStep && authStatus === 'pendente_autorizacao' && !resubmittingFace;
  const needsEnrollment =
    needsFacialStep && (authStatus === 'nao_cadastrada' || authStatus === 'recusada' || resubmittingFace);
  const isAuthorizedForNormalLogin = needsFacialStep && authStatus === 'autorizada' && !resubmittingFace;
  const shouldRunCamera = needsFacialStep && (isAuthorizedForNormalLogin || needsEnrollment);

  useEffect(() => {
    setResubmittingFace(false);
    setPendingCheckNotice(null);
  }, [currentUser?.id]);

  // Automatic polling while waiting for President authorization
  useEffect(() => {
    if (!isWaitingPresident) return;
    const interval = setInterval(() => {
      refreshUsersFromStorage();
    }, 3000);
    return () => clearInterval(interval);
  }, [isWaitingPresident, refreshUsersFromStorage]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    setFaceConfidence(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('unavailable');
      setCameraError('Este navegador não disponibiliza acesso à câmera.');
      return;
    }

    setCameraState('starting');
    setScanStatus('Ativando câmera de verificação facial...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraState('active');
      setScanStatus('Centralize seu rosto dentro do contorno oval');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraState('denied');
        setCameraError('Permissão da câmera recusada. Autorize a câmera no navegador ou envie uma foto facial abaixo.');
      } else {
        setCameraState('unavailable');
        setCameraError('Nenhuma câmera detectada neste dispositivo. Utilize o envio de foto ou biometria abaixo.');
      }
    }
  };

  useEffect(() => {
    if (shouldRunCamera) {
      startCamera();
    } else {
      stopCamera();
      setCameraState('idle');
    }
    return () => stopCamera();
  }, [shouldRunCamera, currentUser?.id]);

  useEffect(() => {
    if (cameraState === 'active' && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraState]);

  useEffect(() => {
    if (!shouldRunCamera || cameraState !== 'active' || isVerifyingFace) return;

    let cancelled = false;
    let consecutiveFrames = 0;

    const analyzeFrame = async () => {
      if (cancelled || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < 2 || video.videoWidth === 0) return;

      canvas.width = 240;
      canvas.height = 180;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let faceFound = false;

      if (typeof window.FaceDetector === 'function') {
        try {
          const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          const faces = await detector.detect(canvas);
          if (faces && faces.length > 0) {
            faceFound = true;
          }
        } catch {
          // fallback below
        }
      }

      if (!faceFound) {
        const centerData = ctx.getImageData(60, 30, 120, 120).data;
        let sumLum = 0;
        let sumSq = 0;
        const pixels = centerData.length / 4;
        for (let i = 0; i < centerData.length; i += 4) {
          const lum = 0.299 * centerData[i] + 0.587 * centerData[i + 1] + 0.114 * centerData[i + 2];
          sumLum += lum;
          sumSq += lum * lum;
        }
        const mean = sumLum / pixels;
        const variance = sumSq / pixels - mean * mean;
        const stdDev = Math.sqrt(Math.max(0, variance));

        if (mean > 22 && mean < 245 && stdDev > 14) {
          faceFound = true;
        }
      }

      if (faceFound) {
        consecutiveFrames = Math.min(consecutiveFrames + 1, 5);
        const pct = Math.min(100, consecutiveFrames * 25);
        setFaceConfidence(pct);
        if (pct < 75) {
          setScanStatus('Rosto detectado · Mantendo leitura biométrica...');
        } else {
          setScanStatus(
            isAuthorizedForNormalLogin
              ? 'Face reconhecida! Validando entrada...'
              : 'Face alinhada! Pronta para envio ao Presidente.'
          );
        }

        if (isAuthorizedForNormalLogin && consecutiveFrames >= 4 && !cancelled) {
          await handleCaptureAction();
        }
      } else {
        consecutiveFrames = Math.max(0, consecutiveFrames - 1);
        setFaceConfidence(consecutiveFrames * 25);
        setScanStatus('Posicione seu rosto iluminado dentro do visor');
      }
    };

    const interval = setInterval(analyzeFrame, 550);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shouldRunCamera, cameraState, isVerifyingFace, isAuthorizedForNormalLogin]);

  if (isAuthenticated && isBiometricAuthenticated && !needsPasswordChange) {
    return null;
  }

  const captureVideoSnapshot = (): string | null => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 240;
      snapCanvas.height = 240;
      const ctx = snapCanvas.getContext('2d');
      if (ctx) {
        const vw = videoRef.current.videoWidth;
        const vh = videoRef.current.videoHeight;
        const minDim = Math.min(vw, vh);
        const sx = (vw - minDim) / 2;
        const sy = (vh - minDim) / 2;
        ctx.translate(240, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, sx, sy, minDim, minDim, 0, 0, 240, 240);
        return snapCanvas.toDataURL('image/jpeg', 0.8);
      }
    }
    return null;
  };

  const handleCaptureAction = async () => {
    if (isVerifyingFace) return;
    setIsVerifyingFace(true);
    setErrorMsg('');
    setScanStatus(
      isAuthorizedForNormalLogin
        ? 'Confirmando assinatura facial criptográfica...'
        : 'Capturando face e enviando para o Presidente...'
    );

    const snapshotDataUrl = captureVideoSnapshot();
    stopCamera();

    try {
      if (isAuthorizedForNormalLogin) {
        const res = await verifyFacialRecognition(snapshotDataUrl, 'camera');
        if (!res.success && res.message) setErrorMsg(res.message);
      } else {
        const res = await submitFaceForPresidentApproval(snapshotDataUrl, 'camera');
        if (!res.success && res.message) setErrorMsg(res.message);
        setResubmittingFace(false);
      }
    } finally {
      setIsVerifyingFace(false);
    }
  };

  const handleFallbackAction = async (
    method: 'webauthn' | 'verificacao_dispositivo',
    snapshot?: string | null
  ) => {
    setIsVerifyingFace(true);
    setErrorMsg('');
    stopCamera();
    try {
      if (isAuthorizedForNormalLogin) {
        const res = await verifyFacialRecognition(snapshot || null, method);
        if (!res.success && res.message) setErrorMsg(res.message);
      } else {
        const res = await submitFaceForPresidentApproval(snapshot || null, method);
        if (!res.success && res.message) setErrorMsg(res.message);
        setResubmittingFace(false);
      }
    } finally {
      setIsVerifyingFace(false);
    }
  };

  const handlePhotoUploadFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      await handleFallbackAction('verificacao_dispositivo', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleCheckAuthorizationStatus = async () => {
    await refreshUsersFromStorage();
    setPendingCheckNotice('Status atualizado. Se o Presidente já autorizou sua face, seu acesso avança automaticamente.');
    setTimeout(() => setPendingCheckNotice(null), 4000);
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (adminPassword.length < 8 || !/[a-zA-Z]/.test(adminPassword) || !/\d/.test(adminPassword)) {
      setErrorMsg('A senha do Administrador deve ter no mínimo 8 caracteres, incluindo letras e números.');
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setErrorMsg('A confirmação da senha não confere.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await bootstrapAdminAccount({
        name: adminName.trim(),
        email: adminEmail.trim(),
        username: adminUsername.trim(),
        password: adminPassword,
        role: adminRole
      });
      if (!res.success) {
        setErrorMsg(res.message || 'Erro ao configurar Administrador.');
      } else {
        setAdminPassword('');
        setAdminConfirmPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !password) {
      setErrorMsg('Informe seu nome de usuário (ou e-mail) e sua senha.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await loginWithCredentials(loginIdentifier, password);
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setCurrentPassForChange(password);
        setPassword('');
      }
    } catch {
      setErrorMsg('Erro ao validar credenciais. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPersonalPass.length < 8 || !/[a-zA-Z]/.test(newPersonalPass) || !/\d/.test(newPersonalPass)) {
      setErrorMsg('A nova senha deve conter no mínimo 8 caracteres com letras e números.');
      return;
    }
    if (newPersonalPass !== confirmPersonalPass) {
      setErrorMsg('A confirmação da nova senha não confere.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await changeOwnPassword(currentPassForChange, newPersonalPass);
      if (!res.success) {
        setErrorMsg(res.message || 'Falha ao atualizar senha.');
      } else {
        setCurrentPassForChange('');
        setNewPersonalPass('');
        setConfirmPersonalPass('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stepHeaderSubtitle = !isAuthenticated
    ? needsAdminSetup
      ? 'Configuração do Administrador'
      : 'Autenticação Segura'
    : needsPasswordChange
    ? 'Definir Senha Pessoal'
    : isWaitingPresident
    ? 'Aguardando Presidente'
    : needsEnrollment
    ? 'Cadastro Facial'
    : 'Reconhecimento Facial';

  const stepBadgeLabel = !isAuthenticated
    ? 'Etapa 1 de 2'
    : needsPasswordChange
    ? 'Troca Obrigatória'
    : 'Etapa 2 de 2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E14]/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121722] rounded-2xl shadow-2xl border border-[#E5E1D8] dark:border-[#1F2838] overflow-hidden my-auto">
        {/* Refined Header */}
        <div className="bg-[#1B365D] dark:bg-[#0F1B2E] px-7 py-6 text-white border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#D4AF63]">
                Governança Eclesiástica
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-0.5">
                IASD Comissões
              </h2>
            </div>
            <div className="text-right text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5 justify-end text-[#D4AF63] font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>{stepBadgeLabel}</span>
              </div>
              <p className="text-slate-300/80 mt-0.5">{stepHeaderSubtitle}</p>
            </div>
          </div>
        </div>

        {/* STEP 0: FIRST-RUN ADMIN SETUP */}
        {!isAuthenticated && bootstrapStatusLoaded && needsAdminSetup ? (
          <div className="p-6 sm:p-7 space-y-5">
            <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#9A7B3E]/40 dark:border-[#D4AF63]/40 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                <Shield className="w-4 h-4" />
                <span>Primeiro Acesso — Configurar Administrador</span>
              </div>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8] leading-relaxed">
                Somente o Administrador poderá cadastrar novos usuários, definir senhas e alterar permissões da comissão.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleBootstrapSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Nome do Administrador
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-[#5A616E]" />
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Usuário de Login
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-xs sm:text-sm font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    E-mail do Administrador
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#5A616E]" />
                    <input
                      type="email"
                      required
                      placeholder="admin@igreja.org"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Função na Comissão
                  </label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-xs sm:text-sm text-[#14181F] dark:text-[#F1EFEA]"
                  >
                    <option value="membro">Membro da Comissão</option>
                    <option value="presidente">Presidente</option>
                    <option value="secretario">Secretário</option>
                    <option value="tesoureiro">Tesoureiro</option>
                    <option value="administrador">Somente Administrador (sem voto)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Senha Forte (mín. 8 caract.)
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Letras e números"
                      className="w-full pl-3 pr-9 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-xs sm:text-sm font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="absolute right-2.5 top-2.5 text-[#5A616E]"
                    >
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                    Confirmar Senha
                  </label>
                  <input
                    type={showAdminPass ? 'text' : 'password'}
                    required
                    value={adminConfirmPassword}
                    onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-xs sm:text-sm font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142947] dark:bg-[#D4AF63] dark:hover:bg-[#c59d4f] disabled:opacity-50 text-white dark:text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isLoading ? 'Salvando...' : 'Ativar Administrador e Continuar'}</span>
              </button>
            </form>
          </div>
        ) : needsPasswordChange && currentUser ? (
          /* STEP 1.5: MANDATORY FIRST-LOGIN PASSWORD CHANGE */
          <div className="p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E1D8] dark:border-[#1F2838]">
              <div className="flex items-center gap-3 min-w-0">
                <MemberAvatar name={currentUser.name} src={currentUser.facialSnapshotDataUrl} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#14181F] dark:text-[#F1EFEA] truncate">{currentUser.name}</p>
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8] truncate">
                    {formatUserRoleSummary(currentUser)} · @{currentUser.username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#5A616E] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                Defina Sua Senha Pessoal
              </h3>
              <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                Por segurança, substitua a senha provisória definida pelo Administrador por uma senha pessoal (mín. 8 caracteres com letras e números).
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangeOwnPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Senha Provisória Atual
                </label>
                <input
                  type="password"
                  required
                  value={currentPassForChange}
                  onChange={(e) => setCurrentPassForChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-sm font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Nova Senha Pessoal
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPersonalPass}
                    onChange={(e) => setNewPersonalPass(e.target.value)}
                    placeholder="Mínimo 8 caracteres (letras + números)"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-sm font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-3 text-[#5A616E]"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={confirmPersonalPass}
                  onChange={(e) => setConfirmPersonalPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-sm font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142947] dark:bg-[#D4AF63] dark:hover:bg-[#c59d4f] text-white dark:text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoading ? 'Atualizando...' : 'Salvar Nova Senha e Avançar'}</span>
              </button>
            </form>
          </div>
        ) : needsFacialStep && activeRecord ? (
          /* STEP 2: PRESIDENT-AUTHORIZED FACIAL GATE */
          <div className="p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E1D8] dark:border-[#1F2838]">
              <div className="flex items-center gap-3 min-w-0">
                <MemberAvatar name={activeRecord.name} src={activeRecord.facialSnapshotDataUrl} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#14181F] dark:text-[#F1EFEA] truncate">
                    {activeRecord.name}
                  </p>
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8] truncate">
                    {formatUserRoleSummary(activeRecord)} · @{activeRecord.username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  logout();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#5A616E] dark:text-[#949BA8] hover:bg-[#F1EFE9] dark:hover:bg-[#181F2D] flex items-center gap-1 transition shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Trocar Conta</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isWaitingPresident ? (
              <div className="space-y-5 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <MemberAvatar
                      name={activeRecord.name}
                      src={activeRecord.facialSnapshotDataUrl}
                      size="xl"
                      className="ring-4 ring-amber-400/50"
                    />
                    <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" /> Pendente de Aprovação
                    </span>
                    <h3 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                      Aguardando Autorização do Presidente
                    </h3>
                    <p className="text-xs text-[#5A616E] dark:text-[#949BA8] max-w-sm mx-auto leading-relaxed">
                      Sua face foi capturada e enviada. Assim que o{' '}
                      <strong className="text-[#14181F] dark:text-[#F1EFEA]">Presidente da Comissão</strong> autorizar sua face no Painel de Controle, seu acesso será liberado.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-xs space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5A616E] dark:text-[#949BA8]">Status Biométrico:</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">Em análise pelo Presidente</span>
                  </div>
                  {activeRecord.facialVerifiedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#5A616E] dark:text-[#949BA8]">Enviada em:</span>
                      <span className="font-mono-tabular text-[#14181F] dark:text-[#F1EFEA]">
                        {new Date(activeRecord.facialVerifiedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>

                {pendingCheckNotice && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                    {pendingCheckNotice}
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleCheckAuthorizationStatus}
                    className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142947] dark:bg-[#D4AF63] dark:hover:bg-[#c59d4f] text-white dark:text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Verificar Autorização Agora</span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResubmittingFace(true)}
                      className="py-2.5 px-3 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] hover:bg-[#EFECE4] dark:hover:bg-[#20293B] text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capturar Nova Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="py-2.5 px-3 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] hover:bg-[#EFECE4] dark:hover:bg-[#20293B] text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center space-y-1.5">
                  {isAuthorizedForNormalLogin ? (
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {isSystemAdmin(activeRecord)
                          ? 'Acesso Administrativo Verificado'
                          : activeRecord.role === 'presidente'
                          ? 'Acesso da Presidência'
                          : `Face Autorizada por ${activeRecord.facialAuthorizedBy || 'Presidente'}`}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#9A7B3E] dark:text-[#D4AF63]">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Requer Autorização do Presidente</span>
                    </div>
                  )}

                  <h3 className="font-display text-xl font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                    {isAuthorizedForNormalLogin
                      ? 'Verificação Facial Obrigatória'
                      : 'Cadastro Facial para Autorização'}
                  </h3>
                  <p className="text-xs text-[#5A616E] dark:text-[#949BA8]">
                    {isAuthorizedForNormalLogin
                      ? 'Confirme sua presença facial ao vivo para liberar o acesso ao sistema.'
                      : 'Capture seu rosto para enviar ao Presidente. Após a aprovação presidencial, seu acesso será liberado.'}
                  </p>
                </div>

                {authStatus === 'recusada' && activeRecord.facialRejectionReason && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Nova captura solicitada pelo Presidente:</p>
                      <p>{activeRecord.facialRejectionReason}</p>
                    </div>
                  </div>
                )}

                <div className="relative mx-auto w-60 h-60 rounded-full overflow-hidden bg-[#0B0E14] border-2 border-[#9A7B3E]/60 shadow-inner flex items-center justify-center">
                  {cameraState === 'active' ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      <div
                        className={`absolute inset-3 rounded-full border-2 transition-colors duration-300 pointer-events-none ${
                          faceConfidence >= 75
                            ? 'border-emerald-400'
                            : faceConfidence > 0
                            ? 'border-[#D4AF63]'
                            : 'border-white/40 border-dashed'
                        }`}
                      />
                      <div className="absolute inset-x-6 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF63] to-transparent animate-scanBeam pointer-events-none" />
                    </>
                  ) : (
                    <div className="p-6 text-center text-slate-300 space-y-2">
                      <ScanFace className="w-12 h-12 mx-auto text-[#D4AF63] opacity-80" />
                      <p className="text-xs leading-relaxed">
                        {cameraState === 'starting' ? 'Conectando à câmera...' : 'Câmera indisponível no momento'}
                      </p>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-1.5">
                      <ScanFace className="w-4 h-4 text-[#9A7B3E] dark:text-[#D4AF63]" />
                      <span>{scanStatus}</span>
                    </span>
                    {cameraState === 'active' && (
                      <span className="font-mono-tabular text-[11px] font-semibold text-[#1B365D] dark:text-[#D4AF63]">
                        {faceConfidence}%
                      </span>
                    )}
                  </div>

                  {cameraState === 'active' && (
                    <div className="w-full h-1.5 bg-[#E5E1D8] dark:bg-[#1F2838] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          faceConfidence >= 75 ? 'bg-emerald-600' : 'bg-[#9A7B3E]'
                        }`}
                        style={{ width: `${faceConfidence}%` }}
                      />
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  {cameraState === 'active' ? (
                    <button
                      type="button"
                      disabled={isVerifyingFace}
                      onClick={handleCaptureAction}
                      className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142947] dark:bg-[#D4AF63] dark:hover:bg-[#c59d4f] text-white dark:text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>
                        {isVerifyingFace
                          ? 'Processando Face...'
                          : isAuthorizedForNormalLogin
                          ? 'Confirmar Reconhecimento Facial e Entrar'
                          : 'Capturar e Enviar Face para Autorização'}
                      </span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142947] text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Tentar Ativar Câmera Novamente</span>
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handlePhotoUploadFallback}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isVerifyingFace}
                          onClick={() => fileInputRef.current?.click()}
                          className="py-2.5 px-3 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] hover:bg-[#EFECE4] dark:hover:bg-[#20293B] text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isAuthorizedForNormalLogin ? 'Enviar Foto Facial' : 'Enviar Foto para Autorização'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isVerifyingFace}
                          onClick={() => handleFallbackAction('webauthn')}
                          className="py-2.5 px-3 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] hover:bg-[#EFECE4] dark:hover:bg-[#20293B] text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          <span>
                            {isAuthorizedForNormalLogin ? 'Biometria do Dispositivo' : 'Enviar Biometria'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STEP 1: HARDENED CREDENTIALS FORM (NO EXPOSED PASSWORDS, NO DEMO SHORTCUTS) */
          <div className="p-6 sm:p-7 space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA] mb-1.5">
                  Usuário ou E-mail Cadastrado
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 text-[#5A616E]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Seu usuário ou e-mail"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-[#14181F] dark:text-[#F1EFEA] text-sm focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                    Senha de Acesso
                  </label>
                  <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
                    Emitida pelo Administrador
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 text-[#5A616E]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha pessoal"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#181F2D] text-[#14181F] dark:text-[#F1EFEA] text-sm font-mono-tabular focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63] focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#5A616E] hover:text-[#14181F] dark:hover:text-white"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#1B365D] hover:bg-[#142947] dark:bg-[#D4AF63] dark:hover:bg-[#c59d4f] disabled:opacity-50 text-white dark:text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>{isLoading ? 'Verificando no servidor...' : 'Validar Credenciais e Prosseguir'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="p-3.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0B0E14] border border-[#E5E1D8] dark:border-[#1F2838] text-[11px] text-[#5A616E] dark:text-[#949BA8] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#14181F] dark:text-[#F1EFEA]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Autenticação Protegida em 2 Etapas</span>
              </div>
              <p className="leading-relaxed">
                As senhas são verificadas no servidor com proteção contra tentativas inválidas. Novos usuários e alterações cadastrais são exclusivos do Administrador.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
