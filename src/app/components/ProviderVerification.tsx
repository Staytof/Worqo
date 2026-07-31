import { Camera, FileCheck2, IdCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import logoImg from "@/assets/logosup.png";
import { useApp } from "../context/AppContext";
import { requestNativeCameraPermission } from "../lib/nativeMediaPermissions";
import { formatCpf, isValidCpf, readImageAsOptimizedDataUrl } from "../utils/helpers";

type ImageKind = "face" | "rg";

export function ProviderVerification() {
  const navigate = useNavigate();
  const faceInputRef = useRef<HTMLInputElement>(null);
  const rgInputRef = useRef<HTMLInputElement>(null);
  const {
    state: { authReady, isAuthenticated, onboardingStep, user },
    submitProviderVerification,
    logout,
  } = useApp();
  const [cpf, setCpf] = useState(user?.cpf ?? "");
  const [rgNumber, setRgNumber] = useState("");
  const [faceImage, setFaceImage] = useState(
    user?.avatar?.startsWith("data:image/") ? user.avatar : ""
  );
  const [rgDocumentImage, setRgDocumentImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (authReady && (!isAuthenticated || !user)) {
    return <Navigate to="/" replace />;
  }

  if (authReady && onboardingStep === "provider-review") {
    return <Navigate to="/provider-review" replace />;
  }

  if (authReady && onboardingStep === "app") {
    return <Navigate to={user?.isAdmin ? "/admin" : "/app"} replace />;
  }

  async function chooseImage(kind: ImageKind) {
    const allowed = await requestNativeCameraPermission();

    if (!allowed) {
      setError("Ative a permissão da câmera para fotografar o documento.");
      return;
    }

    (kind === "face" ? faceInputRef : rgInputRef).current?.click();
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>, kind: ImageKind) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const image = await readImageAsOptimizedDataUrl(file, {
        maxDimension: 1280,
        quality: 0.86,
      });
      kind === "face" ? setFaceImage(image) : setRgDocumentImage(image);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não conseguimos ler a imagem.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!isValidCpf(cpf)) {
      setError("Confira o CPF antes de enviar.");
      return;
    }

    if (rgNumber.trim().length < 4) {
      setError("Informe o número do RG.");
      return;
    }

    if (!faceImage || !rgDocumentImage) {
      setError("Envie a foto do rosto e a imagem do RG.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    const result = await submitProviderVerification({
      cpf,
      rgNumber,
      faceImage,
      rgDocumentImage,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos enviar seus documentos.");
      return;
    }

    navigate("/provider-review", { replace: true });
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-xl rounded-[32px] bg-white p-5 shadow-xl sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <img src={logoImg} alt="Worko" className="h-9 w-auto" />
        <button type="button" onClick={() => void logout()} className="text-sm font-semibold text-slate-500">
          Sair
        </button>
      </div>

      <div className="mb-6 rounded-3xl bg-blue-600 p-5 text-white">
        <ShieldCheck className="mb-3 h-8 w-8" />
        <h1 className="text-2xl font-black">Verificação de prestador</h1>
        <p className="mt-2 text-sm leading-6 text-blue-100">
          Seus dados serão analisados pela equipe Worko em até 1 dia útil. O acesso ao app será liberado após a aprovação.
        </p>
      </div>

      {user?.providerVerificationStatus === "changes_requested" ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Precisamos que você envie novamente:</strong>
          <p className="mt-1">{user.providerVerificationRequestedReason}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">CPF</span>
          <input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Número do RG</span>
          <input value={rgNumber} onChange={(event) => setRgNumber(event.target.value.slice(0, 30))} placeholder="Número e dígito" className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500" />
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <DocumentButton icon={Camera} title="Foto do rosto" subtitle={faceImage ? "Imagem adicionada" : "Adicione uma foto nítida"} image={faceImage} onClick={() => void chooseImage("face")} />
        <DocumentButton icon={IdCard} title="Foto do RG" subtitle={rgDocumentImage ? "Documento adicionado" : "Frente do documento legível"} image={rgDocumentImage} onClick={() => void chooseImage("rg")} />
      </div>

      <input ref={faceInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(event) => void handleImage(event, "face")} />
      <input ref={rgInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(event) => void handleImage(event, "rg")} />

      <div className="mt-5 flex gap-3 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        Os documentos são usados somente para validar sua identidade e ficam acessíveis à equipe autorizada.
      </div>

      {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

      <button type="button" disabled={isSubmitting} onClick={() => void handleSubmit()} className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 font-bold text-white shadow-lg shadow-blue-200 disabled:opacity-60">
        {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
        Enviar para análise
      </button>
    </main>
  );
}

function DocumentButton({ icon: Icon, title, subtitle, image, onClick }: { icon: typeof Camera; title: string; subtitle: string; image: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-left transition active:scale-[0.98]">
      {image ? <img src={image} alt="" className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-blue-50"><Icon className="h-9 w-9 text-blue-600" /></div>}
      <div className="p-4"><strong className="block text-sm text-slate-900">{title}</strong><span className="mt-1 block text-xs text-slate-500">{subtitle}</span></div>
    </button>
  );
}
