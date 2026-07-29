import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Briefcase, Clock3, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { motion } from "motion/react";
import { apiRequest } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { PublicUserProfile, UserProfile } from "../../types";
import { getFirstNames, getInitials } from "../../utils/helpers";
import { VerifiedBadge } from "../ui/verified-badge";
import { formatJoinedDate } from "./profile-utils";

type PublicProfileFallback = Partial<PublicUserProfile> & {
  fullName: string;
};

type PublicProfileModalProps = {
  isOpen: boolean;
  userId: string | null;
  eyebrow?: string;
  fallbackProfile?: PublicProfileFallback | null;
  footer?: ReactNode;
  onClose: () => void;
};

function mapOwnUserToPublicProfile(user: UserProfile): PublicUserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    accountKind: user.accountKind,
    avatar: user.avatar,
    headline: user.headline,
    bio: user.bio,
    professions: user.professions,
    skills: user.skills,
    availabilityNote: user.availabilityNote,
    certificates: user.certificates,
    isAccountVerified: user.isAccountVerified,
    isCpfVerified: user.isCpfVerified,
    completedServicesCount: user.completedServicesCount,
    averageRating: user.averageRating,
    reviewsCount: user.reviewsCount,
    recentReviews: user.recentReviews,
    createdAt: user.createdAt,
  };
}

function buildFallbackProfile(
  userId: string,
  fallbackProfile: PublicProfileFallback | null | undefined
): PublicUserProfile | null {
  if (!fallbackProfile) {
    return null;
  }

  return {
    id: userId,
    fullName: fallbackProfile.fullName,
    accountKind: fallbackProfile.accountKind ?? null,
    avatar: fallbackProfile.avatar ?? null,
    headline: fallbackProfile.headline ?? "",
    bio: fallbackProfile.bio ?? "",
    professions: fallbackProfile.professions ?? [],
    skills: fallbackProfile.skills ?? [],
    availabilityNote: fallbackProfile.availabilityNote ?? "",
    certificates: fallbackProfile.certificates ?? [],
    isAccountVerified: Boolean(fallbackProfile.isAccountVerified),
    isCpfVerified: Boolean(fallbackProfile.isCpfVerified),
    completedServicesCount: fallbackProfile.completedServicesCount ?? 0,
    averageRating:
      typeof fallbackProfile.averageRating === "number"
        ? fallbackProfile.averageRating
        : null,
    reviewsCount: fallbackProfile.reviewsCount ?? 0,
    recentReviews: fallbackProfile.recentReviews ?? [],
    createdAt: fallbackProfile.createdAt ?? "",
  };
}

export function PublicProfileModal({
  isOpen,
  userId,
  eyebrow = "Perfil do(a) usuário(a)",
  fallbackProfile,
  footer,
  onClose,
}: PublicProfileModalProps) {
  const {
    state: { sessionToken, user },
  } = useApp();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);
  const fallbackProfileKey = JSON.stringify({
    fullName: fallbackProfile?.fullName ?? "",
    accountKind: fallbackProfile?.accountKind ?? null,
    avatar: fallbackProfile?.avatar ?? null,
    headline: fallbackProfile?.headline ?? "",
    bio: fallbackProfile?.bio ?? "",
    professions: fallbackProfile?.professions ?? [],
    skills: fallbackProfile?.skills ?? [],
    availabilityNote: fallbackProfile?.availabilityNote ?? "",
    certificates: fallbackProfile?.certificates ?? [],
    isAccountVerified: fallbackProfile?.isAccountVerified ?? false,
    isCpfVerified: fallbackProfile?.isCpfVerified ?? false,
    completedServicesCount: fallbackProfile?.completedServicesCount ?? 0,
    averageRating: fallbackProfile?.averageRating ?? null,
    reviewsCount: fallbackProfile?.reviewsCount ?? 0,
    recentReviews: fallbackProfile?.recentReviews ?? [],
    createdAt: fallbackProfile?.createdAt ?? "",
  });

  const fallbackSnapshot = useMemo(() => {
    if (!userId) {
      return null;
    }

    return buildFallbackProfile(userId, fallbackProfile);
  }, [fallbackProfileKey, userId]);

  const ownProfileSnapshot = useMemo(() => {
    if (!user || user.id !== userId) {
      return null;
    }

    return mapOwnUserToPublicProfile(user);
  }, [user, userId]);

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null);
      setError("");
      setIsLoading(false);
      return;
    }

    if (ownProfileSnapshot) {
      setProfile(ownProfileSnapshot);
      setError("");
      setIsLoading(false);
      return;
    }

    if (!sessionToken) {
      setError("Não foi possível carregar este perfil agora.");
      setProfile(fallbackSnapshot);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError("");
    setProfile((currentProfile) =>
      currentProfile && currentProfile.id === userId ? currentProfile : fallbackSnapshot
    );

    void apiRequest<{ profile: PublicUserProfile }>(
      `/api/users/${encodeURIComponent(userId)}/profile`,
      {
        token: sessionToken,
      }
    )
      .then((response) => {
        if (cancelled) {
          return;
        }

        setProfile(response.profile);
        setError("");
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar este perfil agora."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackSnapshot, isOpen, ownProfileSnapshot, sessionToken, userId]);

  const visibleProfile = useMemo(() => {
    if (profile) {
      return profile;
    }

    if (!userId) {
      return null;
    }

    return fallbackSnapshot;
  }, [fallbackSnapshot, profile, userId]);

  if (!isOpen || !userId) {
    return null;
  }

  const joinedLabel = visibleProfile ? formatJoinedDate(visibleProfile.createdAt) : "";
  const hasBio = Boolean(visibleProfile?.bio.trim());
  const hasProfessions = Boolean(visibleProfile && visibleProfile.professions.length > 0);
  const hasSkills = Boolean(visibleProfile && visibleProfile.skills.length > 0);
  const hasReviews = Boolean(visibleProfile && visibleProfile.recentReviews.length > 0);
  const primaryProfession = visibleProfile?.professions[0]?.trim() ?? "";
  const isClientProfile =
    visibleProfile?.accountKind === "client" ||
    eyebrow.toLocaleLowerCase("pt-BR").includes("cliente");
  const profileValidationLabel = isClientProfile ? "Cliente verificado" : "CPF verificado";
  const completedCountLabel = isClientProfile ? "Pedidos atendidos" : "Serviços";

  return (
    <div className="worqo-fullscreen-sheet z-[90]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="worqo-fullscreen-panel custom-scrollbar"
      >
        <div className="worqo-fullscreen-content [overflow-wrap:normal]">
          <div className="worqo-fullscreen-header">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                  {eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-900">
                  {visibleProfile?.fullName ?? "Carregando perfil"}
                </h2>
                {!isClientProfile && visibleProfile?.headline.trim() ? (
                  <p className="mt-1 text-sm text-slate-500">{visibleProfile.headline}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                aria-label="Fechar perfil"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="pt-6">
            {error ? (
              <section className="worqo-section">
                <div className="worqo-flat-panel worqo-flat-panel--amber px-4 py-3 text-sm text-amber-800">
                  {error}
                </div>
              </section>
            ) : null}

            {isLoading && !visibleProfile ? (
              <section className="worqo-section">
                <div className="worqo-flat-panel flex items-center gap-3 px-4 py-4 text-sm text-slate-500">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
                  Carregando perfil...
                </div>
              </section>
            ) : null}

            {visibleProfile ? (
              <>
                <section className="worqo-section">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-2xl font-bold text-white shadow-lg">
                        {visibleProfile.avatar ? (
                          <img
                            src={visibleProfile.avatar}
                            alt={visibleProfile.fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(visibleProfile.fullName)
                        )}
                      </div>
                      {visibleProfile.isCpfVerified ? (
                        <VerifiedBadge size="md" className="absolute bottom-1 right-1" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      {!isClientProfile ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex max-w-full items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                            <Briefcase className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                            <span className="min-w-0 truncate">
                              {primaryProfession || "Profissão ainda não informada"}
                            </span>
                          </span>
                        </div>
                      ) : null}

                      <div className={`${isClientProfile ? "" : "mt-3"} flex flex-wrap gap-2`}>
                        {visibleProfile.isAccountVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Conta verificada
                          </span>
                        ) : null}
                        {visibleProfile.isCpfVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {profileValidationLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="worqo-flat-panel min-w-0 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Avaliações
                      </p>
                      <div className="mt-2 flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const isFilled =
                            visibleProfile.averageRating !== null &&
                            index < Math.round(visibleProfile.averageRating);

                          return (
                            <Star
                              key={index}
                              className={`h-3.5 w-3.5 ${
                                isFilled
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] font-medium leading-snug text-slate-500">
                        {visibleProfile.averageRating !== null
                          ? `${visibleProfile.averageRating.toFixed(1).replace(".", ",")} de 5 com ${visibleProfile.reviewsCount} avaliação${visibleProfile.reviewsCount === 1 ? "" : "ões"}`
                          : "Sem avaliações ainda"}
                      </p>
                    </div>

                    <div className="worqo-flat-panel min-w-0 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {completedCountLabel}
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {visibleProfile.completedServicesCount}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {visibleProfile.availabilityNote.trim() ? (
                      <div className="col-span-2 worqo-flat-panel px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Disponibilidade
                        </p>
                        <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                            {visibleProfile.availabilityNote}
                          </span>
                        </p>
                      </div>
                    ) : null}

                    {joinedLabel ? (
                      <div className="worqo-flat-panel px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Membro desde
                        </p>
                        <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0">{joinedLabel}</span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>

                {isClientProfile ? (
                  <section className="worqo-section">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Dados do cliente
                    </p>
                    <div className="mt-3 grid gap-3">
                      <div className="worqo-flat-panel px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Nome
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {visibleProfile.fullName}
                        </p>
                      </div>
                      <div className="worqo-flat-panel px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Validação
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {visibleProfile.isCpfVerified ? "Cliente validado" : "Validação pendente"}
                        </p>
                      </div>
                      {joinedLabel ? (
                        <div className="worqo-flat-panel px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Membro desde
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {joinedLabel}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : hasBio ? (
                  <section className="worqo-section">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Apresentação
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                      {visibleProfile.bio}
                    </p>
                  </section>
                ) : null}

                {!isClientProfile ? (
                  <section className="worqo-section">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Briefcase className="h-3.5 w-3.5" />
                      Profissões
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasProfessions ? (
                        visibleProfile.professions.map((profession) => (
                          <span
                            key={profession}
                            className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                          >
                            {profession}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
                          Profissão ainda não informada
                        </span>
                      )}
                    </div>
                  </section>
                ) : null}

                {!isClientProfile && hasSkills ? (
                  <section className="worqo-section">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Habilidades
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {visibleProfile.skills.map((skill) => (
                        <div
                          key={skill}
                          className="worqo-flat-panel px-3 py-2 text-center text-xs font-semibold text-slate-600"
                        >
                          {skill}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {hasReviews ? (
                  <section className="worqo-section">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Avaliações recentes
                    </p>
                    <div className="mt-3 worqo-divider-list">
                      {visibleProfile.recentReviews.map((review) => (
                        <div key={review.id} className="worqo-list-row">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-xs font-black text-blue-600">
                                {review.reviewerAvatar ? (
                                  <img
                                    src={review.reviewerAvatar}
                                    alt={review.reviewerName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getInitials(review.reviewerName)
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {getFirstNames(review.reviewerName, 2)}
                                </p>
                                <p className="mt-0.5 truncate text-xs font-semibold text-blue-600">
                                  {review.serviceTitle || "Atendimento Worko"}
                                </p>
                                <div className="mt-2 flex items-center gap-1 text-amber-400">
                                  {Array.from({ length: 5 }).map((_, index) => (
                                    <Star
                                      key={index}
                                      className={`h-4 w-4 ${
                                        index < review.rating ? "fill-amber-400" : ""
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
                            {review.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {!isClientProfile && !hasBio && !hasSkills && !hasReviews ? (
                  <section className="worqo-section">
                    <div className="worqo-flat-panel px-4 py-4 text-sm leading-relaxed text-slate-600">
                      Este(a) usuário(a) ainda não preencheu mais detalhes no perfil.
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>

          {footer ? <div className="worqo-fullscreen-footer">{footer}</div> : null}
        </div>
      </motion.div>
    </div>
  );
}



