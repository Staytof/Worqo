import {
  Award,
  Briefcase,
  ChevronRight,
  Headset,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { getFirstNames, getInitials } from "../utils/helpers";
import { formatJoinedDate } from "./profile/profile-utils";
import { VerifiedBadge } from "./ui/verified-badge";

export function Profile() {
  const navigate = useNavigate();
  const {
    state: { user },
    logout,
  } = useApp();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isClientAccount = user.accountKind === "client";

  const profileHeadline = isClientAccount
    ? ""
    : user.headline.trim() || user.professions.slice(0, 2).join(" | ");
  const hasBio = !isClientAccount && Boolean(user.bio.trim());
  const profileCompletionSteps = [
    { complete: Boolean(user.avatar), label: "Adicionar foto de perfil" },
    { complete: user.isAccountVerified, label: "Confirmar conta" },
    { complete: user.isCpfVerified, label: "Validar CPF" },
    ...(!isClientAccount
      ? [
          { complete: Boolean(user.bio.trim()), label: "Escrever sobre você" },
          { complete: user.professions.length > 0, label: "Adicionar profissão" },
          { complete: user.skills.length > 0, label: "Adicionar habilidades" },
        ]
      : []),
  ];
  const completedSteps = profileCompletionSteps.filter((step) => step.complete).length;
  const totalProfileSteps = profileCompletionSteps.length;
  const shouldShowProfileStepsCard = completedSteps < totalProfileSteps;
  const pendingProfileSteps = profileCompletionSteps.filter((step) => !step.complete);
  const nextProfileStep = pendingProfileSteps[0] ?? null;
  const profileCompletionPercent =
    totalProfileSteps > 0 ? Math.round((completedSteps / totalProfileSteps) * 100) : 100;
  const joinedAtLabel = formatJoinedDate(user.createdAt);
  const nextProfileStepPath = (() => {
    if (!nextProfileStep) {
      return "/app/profile/data";
    }

    if (nextProfileStep.label.includes("foto")) {
      return "/profile-setup";
    }

    return "/app/profile/data";
  })();

  const managementLinks = [
    ...(user.isAdmin
      ? [
          {
            to: "/admin",
            icon: LayoutDashboard,
            title: "Painel administrativo",
          },
        ]
      : []),
    {
      to: "/app/profile/data",
      icon: User,
      title: "Meus Dados",
    },
    {
      to: "/app/profile/legal",
      icon: ShieldCheck,
      title: "Termos do app",
    },
    {
      to: "/app/profile/support",
      icon: Headset,
      title: "SAC e suporte",
    },
  ];

  const statusCards = [
    {
      title: "Conta",
      value: user.isAccountVerified ? "Ativa" : "Pendente",
      tone: user.isAccountVerified
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600",
      icon: ShieldCheck,
    },
    {
      title: isClientAccount ? "Cliente" : "Prestador(a)",
      value: user.isCpfVerified ? "Validado" : "Pendente",
      tone: user.isCpfVerified
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-600",
      icon: ShieldCheck,
    },
    ...(!isClientAccount
      ? [
          {
            title: "Pix",
            value: user.canReceivePixTransfers ? "Pronto" : "Configurar",
            tone: user.canReceivePixTransfers
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
            icon: Wallet,
          },
        ]
      : []),
    {
      title: "Membro desde",
      value: joinedAtLabel || "Agora",
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      icon: Sparkles,
    },
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-full worqo-page pb-[calc(10rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-4 pt-4 sm:px-6">
        <section className="relative pb-6 pt-1.5 text-center">
          <div
            className={`pointer-events-none absolute -left-4 -right-4 -top-4 h-[132px] overflow-hidden rounded-b-[28px] sm:-left-6 sm:-right-6 ${
              isClientAccount ? "bg-blue-600" : "bg-sky-700"
            }`}
          >
            <div className="absolute inset-0 opacity-15">
              {Array.from({ length: 36 }).map((_, index) => (
                <span
                  key={index}
                  style={{
                    left: `${(index % 9) * 12}%`,
                    top: `${Math.floor(index / 9) * 34}%`,
                  }}
                  className="absolute select-none text-lg font-black text-white"
                >
                  {["@", "#", "&", "W"][index % 4]}
                </span>
              ))}
            </div>
            <span className="absolute bottom-4 right-5 text-sm font-black tracking-wide text-white/80">
              Worko
            </span>
          </div>
          <div className="relative z-10 pb-2">
            <div className="flex items-start justify-center gap-4">
              <div className="flex w-full min-w-0 flex-col items-center gap-4 pt-[72px]">
                <div className="relative shrink-0">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 text-slate-900 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold">{getInitials(user.fullName)}</span>
                    )}
                  </div>
                  {user.isCpfVerified ? (
                    <VerifiedBadge
                      size="md"
                      title="Perfil verificado"
                      className="absolute bottom-1 right-1"
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 max-w-full flex-1 flex-col items-center">
                  <h1 className="max-w-full break-words text-center text-2xl font-bold leading-tight text-slate-900 font-['Nunito']">
                    {user.fullName}
                  </h1>
                  {profileHeadline ? (
                    <p className="mt-2 max-w-[280px] break-words text-center text-sm leading-relaxed text-slate-600">
                      {profileHeadline}
                    </p>
                  ) : null}

                  <div className="mt-4 flex max-w-full flex-wrap justify-center gap-2">
                    {user.isAccountVerified ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Conta ativa
                      </span>
                    ) : null}
                    {user.isCpfVerified ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {isClientAccount ? "Cliente validado" : "Prestador(a) validado(a)"}
                      </span>
                    ) : null}
                    {joinedAtLabel ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                        Desde {joinedAtLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {shouldShowProfileStepsCard ? (
              <div className="profile-progress-card mt-6 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      Perfil
                    </p>
                    <p className="mt-1 text-2xl font-bold leading-none text-neutral-950">
                      {completedSteps}/{totalProfileSteps}
                    </p>
                  </div>

                  <div className="min-w-0 text-right">
                    <p className="text-[11px] font-semibold text-neutral-400">
                      Falta concluir:
                    </p>
                    <Link
                      to={nextProfileStepPath}
                      className="mt-1 inline-flex max-w-full items-center justify-end gap-1 text-[12px] font-semibold text-blue-600"
                    >
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {nextProfileStep?.label ?? "Revisar dados"}
                      </span>
                    </Link>
                  </div>
                </div>

                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100"
                  role="progressbar"
                  aria-label="Conclusão do perfil"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={profileCompletionPercent}
                >
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${profileCompletionPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {user.isAdmin ? (
          <div className="worqo-flat-panel worqo-flat-panel--blue px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Área do dono
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Painel administrativo liberado
                </h2>
              </div>

              <Link
                to="/admin"
                className="rounded-[22px] bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Abrir painel do dono
              </Link>
            </div>
          </div>
        ) : null}

        <div className={isClientAccount ? "space-y-0" : "grid gap-8 lg:grid-cols-[1.08fr_0.92fr]"}>
          {!isClientAccount ? (
          <div className="space-y-0">
            {hasBio ? (
              <section className="worqo-section">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                  <h2 className="font-bold text-slate-900">Sobre o(a) profissional</h2>
                </div>
                <p className="mt-4 break-words text-sm leading-7 text-slate-600">{user.bio}</p>
              </section>
            ) : null}

            <section className="worqo-section">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    <h2 className="font-bold text-slate-900">Profissões</h2>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {user.professions.length > 0 ? (
                      user.professions.map((profession) => (
                        <span
                          key={profession}
                          className="max-w-full rounded-full border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 break-words"
                        >
                          {profession}
                        </span>
                      ))
                    ) : (
                      <div className="worqo-flat-panel px-4 py-3 text-sm text-slate-500">
                        Nenhuma profissão cadastrada ainda.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h2 className="font-bold text-slate-900">Habilidades</h2>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {user.skills.length > 0 ? (
                      user.skills.map((skill) => (
                        <span
                          key={skill}
                          className="max-w-full rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 break-words"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <div className="worqo-flat-panel px-4 py-3 text-sm text-slate-500">
                        Nenhuma habilidade destacada ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="worqo-section">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <h2 className="font-bold text-slate-900">Avaliações</h2>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[190px_1fr]">
                <div className="worqo-flat-panel px-5 py-5 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Nota média
                  </p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                    {user.averageRating !== null
                      ? user.averageRating.toFixed(1).replace(".", ",")
                      : "--"}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${
                          user.averageRating !== null &&
                          index < Math.round(user.averageRating)
                            ? "fill-amber-400"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {user.reviewsCount} {user.reviewsCount === 1 ? "avaliação" : "avaliações"}
                  </p>
                </div>

                <div className="worqo-flat-panel min-w-0 px-5 py-5">
                  <p className="text-sm font-semibold text-slate-700">
                    {user.averageRating !== null
                      ? `${user.averageRating.toFixed(1).replace(".", ",")} de 5 com ${user.reviewsCount} ${
                          user.reviewsCount === 1 ? "avaliação" : "avaliações"
                        }`
                      : "Suas avaliações vão aparecer aqui"}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-500">
                        Serviços
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {user.completedServicesCount}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Avaliações
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {user.reviewsCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {user.recentReviews.length > 0 ? (
                <div className="mt-5 worqo-divider-list">
                  {user.recentReviews.map((review) => (
                    <div key={review.id} className="worqo-list-row">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {getFirstNames(review.reviewerName, 2)}
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
                      <p className="mt-3 break-words text-sm leading-relaxed text-slate-600">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              </section>
          </div>
          ) : null}

          <div className="space-y-0">
            {isClientAccount ? (
              <section className="worqo-section">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  <h2 className="font-bold text-slate-900">Avaliações</h2>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="worqo-flat-panel px-5 py-5 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Nota média
                    </p>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                      {user.averageRating !== null
                        ? user.averageRating.toFixed(1).replace(".", ",")
                        : "--"}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={`h-4 w-4 ${
                            user.averageRating !== null &&
                            index < Math.round(user.averageRating)
                              ? "fill-amber-400"
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {user.reviewsCount} {user.reviewsCount === 1 ? "avaliação" : "avaliações"}
                    </p>
                  </div>

                  <div className="worqo-flat-panel min-w-0 px-5 py-5">
                    <p className="text-sm font-semibold text-slate-700">
                      {user.averageRating !== null
                        ? `${user.averageRating.toFixed(1).replace(".", ",")} de 5 com ${user.reviewsCount} ${
                            user.reviewsCount === 1 ? "avaliação" : "avaliações"
                          }`
                        : "Suas avaliações vão aparecer aqui"}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-500">
                          Atendimentos
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {user.completedServicesCount}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Avaliações
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {user.reviewsCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {user.recentReviews.length > 0 ? (
                  <div className="mt-5 worqo-divider-list">
                    {user.recentReviews.map((review) => (
                      <div key={review.id} className="worqo-list-row">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {getFirstNames(review.reviewerName, 2)}
                          </p>
                          <div className="mt-2 flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                className={`h-4 w-4 ${index < review.rating ? "fill-amber-400" : ""}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 break-words text-sm leading-relaxed text-slate-600">
                          {review.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="worqo-section">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-500" />
                <h2 className="font-bold text-slate-900">Visão rápida</h2>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {statusCards.map(({ icon: Icon, title, tone, value }) => (
                  <div
                    key={title}
                    className={`profile-soft-card worqo-flat-panel min-w-0 rounded-2xl border border-neutral-200 px-4 py-4 ${tone}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <p className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80 sm:text-[11px] sm:tracking-[0.18em]">
                        {title}
                      </p>
                    </div>
                    <p className="mt-3 break-words text-lg font-bold leading-tight">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="worqo-section">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                <h2 className="font-bold text-slate-900">Gerenciar perfil</h2>
              </div>

              <div className="mt-4 worqo-divider-list">
                {managementLinks.map(({ icon: Icon, title, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className="worqo-list-row group flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-blue-100 bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex min-w-0 items-center">
                        <p className="break-words text-sm font-semibold text-slate-900">{title}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={`worqo-list-row flex w-full items-center gap-4 text-left transition-colors ${
                    isLoggingOut ? "cursor-wait text-rose-400" : "text-rose-700"
                  }`}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] border border-rose-200 bg-rose-50 text-rose-600">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center">
                    <p className="break-words text-sm font-semibold">
                      {isLoggingOut ? "Saindo..." : "Sair da conta"}
                    </p>
                  </div>
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="px-2 pb-2 pt-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Raaberts
            <sup className="ml-0.5 text-[7px] font-semibold align-super">&reg;</sup>{" "}
            Softwares 
          </p>
        </div>
      </div>
    </div>
  );
}

