import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  Camera,
  Clock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  availabilityDayOptions,
  buildAvailabilityNote,
  parseAvailabilitySchedule,
  type AvailabilityDayId,
  validateAvailabilitySchedule,
} from "../lib/availability";
import { loadGoogleMapsApi } from "../lib/googleMaps";
import { requestNativePhotoPermission } from "../lib/nativeMediaPermissions";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { formatCpf } from "../utils/helpers";
import { readImageAsOptimizedDataUrl } from "../utils/helpers";
import { ProfileSectionLayout } from "./profile/ProfileSectionLayout";
import {
  formatProfileDateTime,
  parseTagInput,
  stringifyTagInput,
} from "./profile/profile-utils";
import { AvatarCropDialog } from "./ui/AvatarCropDialog";

function formatBirthDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(date);
}

function buildProfileFormSnapshot(user: ReturnType<typeof useApp>["state"]["user"]) {
  return JSON.stringify({
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    birthDate: user.birthDate,
    identityLockedAt: user.identityLockedAt,
    cpf: user.cpf,
    address: user.address,
    headline: user.headline,
    availabilityNote: user.availabilityNote,
    bio: user.bio,
    professions: user.professions,
    skills: user.skills,
    pixKey: user.pixKey,
    avatar: user.avatar,
  });
}

function resolvePlaceLabel(place: any) {
  return place?.formatted_address || place?.name || "";
}

export function ProfileAccount() {
  const navigate = useNavigate();
  const addressInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const autocompleteListenerRef = useRef<any>(null);
  const {
    state: { user },
    logout,
    deleteAccount,
    updateProfile,
    verifyCpf,
  } = useApp();
  const [cpf, setCpf] = useState(user.cpf);
  const [avatar, setAvatar] = useState(user.avatar);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone.startsWith("google:") ? "" : user.phone);
  const [birthDate, setBirthDate] = useState(user.birthDate);
  const [address, setAddress] = useState(user.address);
  const [headline, setHeadline] = useState(user.headline);
  const [availabilityDays, setAvailabilityDays] = useState(
    () => parseAvailabilitySchedule(user.availabilityNote).days
  );
  const [availabilityStartTime, setAvailabilityStartTime] = useState(
    () => parseAvailabilitySchedule(user.availabilityNote).startTime
  );
  const [availabilityEndTime, setAvailabilityEndTime] = useState(
    () => parseAvailabilitySchedule(user.availabilityNote).endTime
  );
  const [bio, setBio] = useState(user.bio);
  const [pixKey, setPixKey] = useState(
    user.pixKeyType === "CPF" ? formatCpf(user.pixKey) : user.pixKey
  );
  const [professionsInput, setProfessionsInput] = useState(
    stringifyTagInput(user.professions)
  );
  const [skillsInput, setSkillsInput] = useState(stringifyTagInput(user.skills));
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingCpf, setIsVerifyingCpf] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  useErrorToast(statusTone === "error" ? statusMessage : "");
  const profileFormSnapshot = buildProfileFormSnapshot(user);
  const isIdentityLocked = Boolean(user.identityLockedAt);
  const isClientAccount = user.accountKind === "client";

  useEffect(() => {
    return () => {
      if (autocompleteListenerRef.current?.remove) {
        autocompleteListenerRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!addressInputRef.current || autocompleteRef.current) {
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
              // O campo continua funcionando mesmo sem o viés do GPS.
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
        // Mantemos a edição manual se o Google Maps não carregar.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFullName(user.fullName);
    setPhone(user.phone.startsWith("google:") ? "" : user.phone);
    setBirthDate(user.birthDate);
    setCpf(user.cpf);
    setAvatar(user.avatar);
    setAddress(user.address);
    setHeadline(user.headline);
    const nextAvailabilitySchedule = parseAvailabilitySchedule(user.availabilityNote);
    setAvailabilityDays(nextAvailabilitySchedule.days);
    setAvailabilityStartTime(nextAvailabilitySchedule.startTime);
    setAvailabilityEndTime(nextAvailabilitySchedule.endTime);
    setBio(user.bio);
    setPixKey(user.pixKeyType === "CPF" ? formatCpf(user.pixKey) : user.pixKey);
    setProfessionsInput(stringifyTagInput(user.professions));
    setSkillsInput(stringifyTagInput(user.skills));
  }, [user.id, profileFormSnapshot]);

  const handleSaveData = async () => {
    const availabilityError = validateAvailabilitySchedule({
      days: availabilityDays,
      startTime: availabilityStartTime,
      endTime: availabilityEndTime,
    });

    if (!isClientAccount && availabilityError) {
      setStatusTone("error");
      setStatusMessage(availabilityError);
      return;
    }

    setIsSaving(true);
    const nextAvailabilityNote = buildAvailabilityNote(
      availabilityDays,
      availabilityStartTime,
      availabilityEndTime
    );

    const result = await updateProfile({
      ...(isIdentityLocked
        ? {}
        : {
            fullName: fullName.trim(),
            phone: phone.trim(),
            birthDate,
          }),
      cpf,
      avatar,
      address: address.trim(),
      ...(isClientAccount
        ? {}
        : {
            headline,
            availabilityNote: nextAvailabilityNote,
            bio,
            pixKeyType: pixKey.trim() ? "CPF" : null,
            pixKey: pixKey.trim() || null,
            professions: parseTagInput(professionsInput).slice(0, 5),
            skills: parseTagInput(skillsInput).slice(0, 10),
          }),
    });

    setIsSaving(false);

    if (!result.ok) {
      setStatusTone("error");
      setStatusMessage(result.error ?? "Não conseguimos salvar seus dados agora.");
      return;
    }

    setStatusTone("success");
    setStatusMessage("Meus dados foram atualizados com sucesso.");
    navigate(-1);
  };

  const toggleAvailabilityDay = (dayId: AvailabilityDayId) => {
    setAvailabilityDays((currentDays) =>
      currentDays.includes(dayId)
        ? currentDays.filter((currentDay) => currentDay !== dayId)
        : [...currentDays, dayId]
    );
  };

  const handleVerifyCpf = async () => {
    setIsVerifyingCpf(true);

    const result = await verifyCpf(cpf);

    setIsVerifyingCpf(false);

    if (!result.ok) {
      setStatusTone("error");
      setStatusMessage(result.error ?? "Não conseguimos validar o CPF agora.");
      return;
    }

    setStatusTone("success");
    setStatusMessage(result.message ?? "CPF verificado com sucesso.");
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setStatusMessage("");
    } catch (uploadError) {
      setStatusTone("error");
      setStatusMessage(
        uploadError instanceof Error ? uploadError.message : "Não conseguimos carregar a imagem."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleChooseAvatar = async () => {
    const allowed = await requestNativePhotoPermission();

    if (!allowed) {
      setStatusTone("error");
      setStatusMessage("Ative a permissão de fotos para escolher sua imagem de perfil.");
      return;
    }

    avatarInputRef.current?.click();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== "EXCLUIR") {
      setStatusTone("error");
      setStatusMessage("Digite EXCLUIR para confirmar a exclusão da conta.");
      return;
    }

    setIsDeleteConfirmationOpen(true);
  };

  const confirmDeleteAccount = async () => {
    setIsDeleteConfirmationOpen(false);

    setIsDeletingAccount(true);
    const result = await deleteAccount();
    setIsDeletingAccount(false);

    if (!result.ok) {
      setStatusTone("error");
      setStatusMessage(result.error ?? "Não conseguimos excluir sua conta agora.");
      return;
    }

    navigate("/", { replace: true });
  };

  const verificationDateLabel = formatProfileDateTime(user.cpfVerifiedAt);

  return (
    <ProfileSectionLayout
      eyebrow="Meus dados"
      title={isClientAccount ? "Conta e identidade" : "Conta, identidade e perfil profissional"}
    >
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-[28px] p-4 text-sm ${
            statusTone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {statusMessage}
        </motion.div>
      )}

      <div className={isClientAccount ? "grid gap-4" : "grid gap-4 lg:grid-cols-[0.92fr_1.08fr]"}>
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <h2 className="font-bold text-slate-900">Identidade da conta</h2>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                {avatar ? (
                  <img src={avatar} alt="Foto do perfil" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Foto do perfil</p>
                <button
                  type="button"
                  onClick={() => void handleChooseAvatar()}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  <Camera className="h-4 w-4" />
                  {avatar ? "Trocar foto" : "Adicionar foto"}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="ml-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={isIdentityLocked}
                  placeholder="Seu nome completo real"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white disabled:text-slate-500"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    E-mail
                  </p>
                  <p className="mt-1 break-all text-sm font-medium text-slate-700">
                    {user.email}
                  </p>
                </div>

                <div>
                  <label className="ml-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={isIdentityLocked}
                    placeholder="(11) 99999-9999"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white disabled:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="ml-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Data de nascimento
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  disabled={isIdentityLocked}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white disabled:text-slate-500"
                />
              </div>

              <p className="px-1 text-xs leading-relaxed text-slate-500">
                Esses dados serão usados na validação do CPF. Depois de salvar, não poderão ser alterados pelo app.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              <h2 className="font-bold text-slate-900">Validação e localização</h2>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">
                  CPF para validação oficial
                </label>
                <div className="relative mt-1 flex items-center">
                  <input
                    type="text"
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    placeholder="000.000.000-00"
                    className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white ${
                      user.isCpfVerified
                        ? "border-emerald-200 text-emerald-800"
                        : "border-slate-200"
                    }`}
                  />
                  {user.isCpfVerified && (
                    <ShieldCheck className="absolute right-3 h-5 w-5 text-emerald-500" />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {!user.isCpfVerified && (
                    <button
                      onClick={handleVerifyCpf}
                      disabled={isVerifyingCpf}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                        isVerifyingCpf
                          ? "cursor-wait bg-slate-200 text-slate-500"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {isVerifyingCpf ? "Validando..." : "Confirmar CPF"}
                    </button>
                  )}

                  <span
                    className={`text-xs font-medium ${
                      user.isCpfVerified ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {user.isCpfVerified
                      ? `CPF confirmado${verificationDateLabel ? ` em ${verificationDateLabel}` : ""}`
                      : "CPF ainda não validado"}
                  </span>
                </div>
              </div>

              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">
                  Endereço principal ou bairro
                </label>
                <div className="relative mt-1 flex items-center">
                  <MapPin className="absolute left-3 h-5 w-5 text-slate-400" />
                  <input
                    ref={addressInputRef}
                    type="text"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Digite seu endereço"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {!isClientAccount ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              <h2 className="font-bold text-slate-900">Apresentação profissional</h2>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">
                  Chamada do perfil
                </label>
                <input
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value.slice(0, 80))}
                  placeholder="Ex.: Eletricista residencial e comercial"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-800">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">Disponibilidade</p>
                      <p className="text-[11px] font-medium text-slate-500">
                        Selecione seus dias e horários
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-blue-700 shadow-sm">
                    {availabilityDays.length} {availabilityDays.length === 1 ? "dia" : "dias"}
                  </span>
                </div>

                <div className="mt-4 rounded-[22px] bg-white/80 p-3 shadow-sm ring-1 ring-inset ring-slate-100">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Dias de atendimento
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {availabilityDayOptions.map((day) => {
                      const isSelected = availabilityDays.includes(day.id);

                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleAvailabilityDay(day.id)}
                          title={day.label}
                          aria-pressed={isSelected}
                          aria-label={`${day.label}: ${
                            isSelected ? "selecionado" : "não selecionado"
                          }`}
                          className={`flex aspect-square w-full items-center justify-center rounded-full text-xs font-black transition active:scale-95 ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                              : "bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200"
                          }`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>

                  <div className="my-4 h-px bg-slate-100" />

                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold">Horário de atendimento</span>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <label className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200 focus-within:ring-blue-400">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Das
                      </span>
                      <input
                        type="time"
                        value={availabilityStartTime}
                        onChange={(event) => setAvailabilityStartTime(event.target.value)}
                        aria-label="Horário inicial"
                        className="mt-0.5 w-full min-w-0 bg-transparent text-sm font-black text-slate-800 outline-none"
                      />
                    </label>
                    <span className="text-xs font-bold text-slate-300">até</span>
                    <label className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200 focus-within:ring-blue-400">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Às
                      </span>
                      <input
                        type="time"
                        value={availabilityEndTime}
                        onChange={(event) => setAvailabilityEndTime(event.target.value)}
                        aria-label="Horário final"
                        className="mt-0.5 w-full min-w-0 bg-transparent text-sm font-black text-slate-800 outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">Bio</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value.slice(0, 800))}
                  placeholder="Conte um pouco sobre sua experiência, seu jeito de trabalhar e o que faz você se destacar."
                  rows={6}
                  className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">
                  Profissões
                </label>
                <input
                  value={professionsInput}
                  onChange={(event) => setProfessionsInput(event.target.value)}
                  placeholder="Separe por vírgulas. Ex.: Eletricista, Instalador, Montador"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">
                  Habilidades
                </label>
                <input
                  value={skillsInput}
                  onChange={(event) => setSkillsInput(event.target.value)}
                  placeholder="Separe por vírgulas. Ex.: Instalação, Manutenção, Diagnóstico"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="ml-1 text-xs font-semibold text-slate-500">
                  Chave Pix em CPF
                </label>
                <input
                  value={pixKey}
                  onChange={(event) => setPixKey(formatCpf(event.target.value))}
                  placeholder="Use o mesmo CPF validado na conta"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveData}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-[22px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          </div>

          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-rose-700">
              <Trash2 className="h-5 w-5" />
              <h2 className="font-bold">Excluir conta e dados pessoais</h2>
            </div>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-rose-700">
              <p>
                Você pode solicitar a exclusão da conta pelo próprio app. Ao confirmar, sua sessão
                é encerrada, seus dados de identificação são removidos ou anonimizados e dados que
                precisem permanecer por obrigação legal, antifraude, pagamento ou segurança ficam
                retidos apenas pelo prazo necessário informado no Aviso de Privacidade.
              </p>
              <p>
                Para proteger a conta, digite <strong>EXCLUIR</strong> abaixo e toque no botão.
              </p>
              {isClientAccount ? (
                <p>
                  A exclusão só fica disponível quando não houver atendimento ativo ou pendência de
                  segurança na conta.
                </p>
              ) : (
                <p>
                  A exclusão só fica disponível quando a carteira estiver zerada e não houver saque em
                  processamento.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="Digite EXCLUIR"
                className="min-w-0 flex-1 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-900 outline-none transition focus:border-rose-400"
              />
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:bg-rose-300"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingAccount ? "Excluindo..." : "Excluir minha conta"}
              </button>
            </div>
          </div>

        </div>
      </div>
      <AvatarCropDialog
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onConfirm={(nextAvatar) => {
          setAvatar(nextAvatar);
          setCropSource(null);
        }}
      />
      {isDeleteConfirmationOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_28px_80px_rgba(2,6,23,0.32)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-confirmation-title"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
              Ação irreversível
            </p>
            <h2 id="delete-account-confirmation-title" className="mt-2 text-xl font-bold text-slate-900">
              Deseja excluir sua conta?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Seus dados pessoais serão removidos ou anonimizados conforme o Aviso de Privacidade.
              Depois de confirmar, esta ação não poderá ser desfeita.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmationOpen(false)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteAccount()}
                className="h-12 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Sim, excluir
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </ProfileSectionLayout>
  );
}

