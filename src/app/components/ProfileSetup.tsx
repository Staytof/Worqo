import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  CheckCircle,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import logoImg from "@/assets/logosup.png";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { loadGoogleMapsApi } from "../lib/googleMaps";
import { requestNativePhotoPermission } from "../lib/nativeMediaPermissions";
import { readImageAsOptimizedDataUrl } from "../utils/helpers";
import { AvatarCropDialog } from "./ui/AvatarCropDialog";
import type { AccountKind } from "../types";

type SetupStep = "category" | "photo" | "details";

function splitList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolvePlaceLabel(place: any) {
  return place?.formatted_address || place?.name || "";
}

export function ProfileSetup() {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const autocompleteListenerRef = useRef<any>(null);
  const {
    state: { authReady, isAuthenticated, onboardingStep, user },
    updateProfile,
  } = useApp();
  const [setupStep, setSetupStep] = useState<SetupStep>(user?.accountKind ? "photo" : "category");
  const [selectedAccountKind, setSelectedAccountKind] = useState<AccountKind | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [profession, setProfession] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [address, setAddress] = useState("");
  const [addressFocus, setAddressFocus] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useErrorToast(error);
  const accountKind = user?.accountKind ?? null;
  const isClient = accountKind === "client";

  useEffect(() => {
    if (accountKind && setupStep === "category") {
      setSetupStep("photo");
    }
  }, [accountKind, setupStep]);

  useEffect(() => {
    return () => {
      if (autocompleteListenerRef.current?.remove) {
        autocompleteListenerRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (setupStep !== "details" || !addressInputRef.current || autocompleteRef.current) {
      return;
    }

    let cancelled = false;

    void loadGoogleMapsApi()
      .then((maps) => {
        if (cancelled || !addressInputRef.current) {
          return;
        }

        const autocomplete = new maps.places.Autocomplete(addressInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          types: ["geocode"],
          componentRestrictions: { country: "br" },
        });

        autocompleteRef.current = autocomplete;
        autocompleteListenerRef.current = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const nextAddress = resolvePlaceLabel(place);

          if (nextAddress) {
            setAddress(nextAddress);
            setError("");
          }
        });

        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const center = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              const delta = 0.08;
              const bounds = new maps.LatLngBounds(
                { lat: center.lat - delta, lng: center.lng - delta },
                { lat: center.lat + delta, lng: center.lng + delta }
              );

              autocomplete.setBounds(bounds);
            },
            () => {
              // O autocomplete continua funcionando mesmo sem o viés do GPS.
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000,
            }
          );
        }
      })
      .catch(() => {
        // Mantemos o campo manual se a API do Google não carregar.
      });

    return () => {
      cancelled = true;
    };
  }, [setupStep]);

  if (authReady && !isAuthenticated && onboardingStep === "verify") {
    return <Navigate to="/verify" replace />;
  }

  if (authReady && onboardingStep === "app") {
    return <Navigate to="/app" replace />;
  }

  if (authReady && onboardingStep === "provider-verification") {
    return <Navigate to="/provider-verification" replace />;
  }

  if (authReady && onboardingStep === "provider-review") {
    return <Navigate to="/provider-review" replace />;
  }

  if (authReady && onboardingStep !== "profile-setup") {
    return <Navigate to="/register" replace />;
  }

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const image = await readImageAsOptimizedDataUrl(file, {
        maxDimension: 1280,
        quality: 0.9,
      });
      setCropSource(image);
      setError("");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Não conseguimos carregar a imagem."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleChooseAvatar = async () => {
    const allowed = await requestNativePhotoPermission();

    if (!allowed) {
      setError("Ative a permissão de fotos para escolher sua imagem de perfil.");
      return;
    }

    avatarInputRef.current?.click();
  };

  const handleConfirmAccountKind = async () => {
    if (!selectedAccountKind) {
      setError("Escolha Cliente ou Prestador(a) para continuar.");
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    const result = await updateProfile({ accountKind: selectedAccountKind });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos salvar sua categoria.");
      return;
    }

    setSetupStep("photo");
  };

  const handleCompleteClientProfile = async () => {
    if (!imagePreview) {
      setError("Envie uma foto de rosto em 3/4 para continuar.");
      return;
    }

    setIsSubmitting(true);

    const result = await updateProfile({
      avatar: imagePreview,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos concluir seu cadastro.");
      return;
    }

    navigate("/app/profile");
  };

  const handleContinue = () => {
    if (!imagePreview) {
      setError("Envie uma foto de rosto em 3/4 para continuar.");
      return;
    }

    if (isClient) {
      void handleCompleteClientProfile();
      return;
    }

    setError("");
    setSetupStep("details");
  };

  const handleSubmit = async () => {
    if (!imagePreview) {
      setError("Envie uma foto de rosto em 3/4 para continuar.");
      setSetupStep("photo");
      return;
    }

    if (!profession.trim()) {
      setError("Informe sua profissão principal.");
      return;
    }

    if (!address.trim()) {
      setError("Informe seu endereço para concluir o cadastro.");
      return;
    }

    setIsSubmitting(true);

    const result = await updateProfile({
      avatar: imagePreview,
      headline: commercialName.trim(),
      professions: splitList(profession),
      address: address.trim(),
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos concluir seu cadastro.");
      return;
    }

    navigate("/provider-verification");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-5 py-6 font-['Nunito'] sm:px-8 sm:py-8 md:p-10"
      style={{
        paddingTop: "calc(24px + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 160 }}
        className="mb-6 flex flex-col items-center text-center"
      >
        <div className="mb-4 flex h-12 items-center justify-center">
          <img src={logoImg} alt="Worko" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {setupStep === "category"
            ? "Escolha seu tipo de conta"
            : setupStep === "photo"
              ? "Envie sua foto"
              : "Complete seu perfil"}
        </h1>
      </motion.div>

      {setupStep === "category" ? (
        <div className="space-y-4">
          <p className="text-center text-sm leading-relaxed text-slate-500">
            Essa escolha define como você usa o Worko e não poderá ser alterada depois.
          </p>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedAccountKind("client");
                setError("");
              }}
              disabled={isSubmitting}
              className={`flex items-center gap-4 rounded-3xl px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                selectedAccountKind === "client"
                  ? "bg-blue-50 ring-2 ring-blue-600"
                  : "bg-slate-50 hover:bg-blue-50"
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <UserRound className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-slate-900">Cliente</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                  Solicita serviços e acompanha seus atendimentos.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAccountKind("provider");
                setError("");
              }}
              disabled={isSubmitting}
              className={`flex items-center gap-4 rounded-3xl px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                selectedAccountKind === "provider"
                  ? "bg-blue-50 ring-2 ring-blue-600"
                  : "bg-slate-50 hover:bg-blue-50"
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <BriefcaseBusiness className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-slate-900">Prestador(a)</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                  Atende serviços ao domicílio, usa mapa, conversas e carteira.
                </span>
              </span>
            </button>
          </div>

          <div className="flex items-start gap-3 rounded-3xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <span>Depois de confirmar, a categoria fica bloqueada para proteger o histórico da conta.</span>
          </div>

          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void handleConfirmAccountKind()}
              disabled={!selectedAccountKind || isSubmitting}
              className={`inline-flex h-14 w-14 items-center justify-center rounded-full transition ${
                selectedAccountKind && !isSubmitting
                  ? "bg-blue-600 text-white shadow-[0_14px_28px_rgba(37,99,235,0.24)] active:scale-95"
                  : "cursor-not-allowed bg-slate-100 text-slate-300"
              }`}
              aria-label="Confirmar tipo de conta"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : setupStep === "photo" ? (
        <>
          <div className="mb-8 flex w-full flex-col items-center">
            <div className="group relative">
              <div
                onClick={() => void handleChooseAvatar()}
                className={`relative flex h-36 w-36 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 shadow-lg transition-all duration-300 ${
                  imagePreview
                    ? "border-blue-500"
                    : "border-dashed border-slate-300 bg-slate-50 group-hover:border-blue-400 group-hover:bg-blue-50/50"
                }`}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-10 w-10 text-slate-400 transition-colors group-hover:text-blue-500" />
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImageIcon className="h-8 w-8 text-white" />
                </div>
              </div>

              {imagePreview ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-green-500 shadow-md"
                >
                  <CheckCircle className="h-5 w-5 text-white" />
                </motion.div>
              ) : null}
            </div>

            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => void handleChooseAvatar()}
              className="mt-6 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              {imagePreview ? "Trocar foto" : "Escolher da galeria"}
            </button>
            <p className="mt-4 max-w-xs text-center text-sm leading-relaxed text-slate-500">
              * Para manter a confiança entre Cliente e Prestador(a), perfis sem foto do rosto podem precisar atualizar a imagem antes de usar o app.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!imagePreview || isSubmitting}
            className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 font-semibold transition-all ${
              imagePreview && !isSubmitting
                ? "bg-blue-600 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.28)] hover:bg-blue-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            {isClient ? (isSubmitting ? "Salvando..." : "Entrar no app") : "Continuar"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Profissão principal *</span>
              <input
                value={profession}
                onChange={(event) => setProfession(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nome comercial <span className="font-normal text-slate-400">(se possuir CNPJ)</span>
              </span>
              <input
                value={commercialName}
                onChange={(event) => setCommercialName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Endereço *</span>
              <div
                className={`relative flex items-center rounded-[24px] border bg-slate-50 px-4 py-3 transition ${
                  addressFocus
                    ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <MapPin
                  className={`h-5 w-5 shrink-0 ${
                    addressFocus ? "text-blue-500" : "text-slate-400"
                  }`}
                />
                <input
                  ref={addressInputRef}
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  onFocus={() => setAddressFocus(true)}
                  onBlur={() => setAddressFocus(false)}
                  className="ml-3 w-full border-none bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>
            </label>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSetupStep("photo")}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Salvando..." : "Entrar no app"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <AvatarCropDialog
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onConfirm={(avatar) => {
          setImagePreview(avatar);
          setCropSource(null);
        }}
      />
    </motion.div>
  );
}


