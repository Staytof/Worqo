import { useMemo, useState } from "react";
import { AlertCircle, LayoutGrid, MapPin, MessageCircle, Search, ShieldAlert, X } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { VerifiedBadge } from "./ui/verified-badge";

export function Mural() {
  const navigate = useNavigate();
  const {
    state: { chats, posts, user },
    openChatFromPost,
    removePost,
  } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [openingPostId, setOpeningPostId] = useState<string | null>(null);
  const [removingPostId, setRemovingPostId] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState("");
  useErrorToast(postActionError);

  const isProfileComplete = user.isCpfVerified;
  const totalUnreadChats = chats.reduce((sum, chat) => sum + chat.unread, 0);
  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return posts.filter((post) => {
      if (post.type !== "offer") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${post.user} ${post.content} ${post.category}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [posts, searchQuery]);

  const handleOpenChat = async (postId: string) => {
    setPostActionError("");
    setOpeningPostId(postId);
    const result = await openChatFromPost(postId);
    setOpeningPostId(null);

    if (!result.ok) {
      setPostActionError(result.error ?? "Não conseguimos abrir a conversa agora.");
      return;
    }

    if (result.chatId) {
      navigate("/app/chat");
    }
  };

  const handleRemovePost = async (postId: string) => {
    if (removingPostId) {
      return;
    }

    const confirmed = window.confirm("Excluir esta divulgação?");

    if (!confirmed) {
      return;
    }

    setPostActionError("");
    setRemovingPostId(postId);
    const result = await removePost(postId);
    setRemovingPostId(null);

    if (!result.ok) {
      setPostActionError(result.error ?? "Não conseguimos remover essa divulgação agora.");
    }
  };

  if (!isProfileComplete) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-slate-50 p-6">
        <div className="absolute top-20 -left-20 h-64 w-64 rounded-full bg-rose-400 opacity-10 blur-3xl" />
        <div className="absolute bottom-20 -right-20 h-64 w-64 rounded-full bg-amber-400 opacity-10 blur-3xl" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-[2rem] border border-slate-100 bg-white p-8 text-center shadow-xl"
        >
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
            <div className="absolute inset-0 rounded-full bg-rose-400 opacity-20 blur-md" />
            <ShieldAlert className="relative z-10 h-10 w-10 text-rose-500" />
          </div>

          <h2 className="mb-2 text-xl font-bold text-slate-800 font-['Nunito']">
            Acesso restrito
          </h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-500">
            Para visualizar o mural de profissionais com segurança, confirme seu CPF no perfil.
          </p>

          <div className="mb-8 w-full space-y-3">
            <div className="flex items-center gap-3 text-sm">
              {user.isCpfVerified ? (
                <AlertCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-400" />
              )}
              <span className={user.isCpfVerified ? "text-slate-700" : "text-slate-400"}>
                CPF verificado
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate("/app/profile")}
            className="w-full rounded-2xl bg-blue-600 py-3.5 font-semibold text-white shadow-md shadow-blue-500/20 transition-all active:scale-95 hover:bg-blue-700"
          >
            Ir para o perfil
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden bg-slate-50">
      <div className="sticky top-0 z-20 bg-white px-4 pb-4 pt-12 shadow-sm sm:px-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-['Nunito'] text-2xl font-bold text-slate-800">Mural</h1>
            <p className="text-sm text-slate-500">
              Divulgações de profissionais próximas de você.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <LayoutGrid className="h-5 w-5" />
          </div>
        </div>

        <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => navigate("/app/mural")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white py-2 text-sm font-semibold text-blue-600 shadow-sm"
          >
            <LayoutGrid className="h-4 w-4" />
            Mural
          </button>
          <button
            onClick={() => navigate("/app/chat")}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-500 transition-all hover:text-slate-700"
          >
            <MessageCircle className="h-4 w-4" />
            Conversas
            {totalUnreadChats > 0 ? (
              <span className="absolute right-3 top-1/2 flex min-h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_10px_20px_rgba(37,99,235,0.28)]">
                {Math.min(totalUnreadChats, 9)}
              </span>
            ) : null}
          </button>
        </div>

        <div className="relative flex w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <Search className="h-5 w-5 flex-shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar profissionais..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="ml-3 w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4 pb-24">
        {postActionError ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
            {postActionError}
          </div>
        ) : null}

        {filteredPosts.length > 0 ? (
          filteredPosts.map((post, index) => {
            const postIsVerified = post.authorId === "me" ? user.isCpfVerified : post.isVerified;

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.18) }}
                className="relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                {post.authorId === "me" ? (
                  <button
                    type="button"
                    onClick={() => void handleRemovePost(post.id)}
                    disabled={removingPostId === post.id}
                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Remover divulgação"
                    title="Remover divulgação"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}

                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white shadow-inner">
                      {post.user.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">{post.user}</h3>
                        {postIsVerified ? (
                          <VerifiedBadge size="sm" title={`${post.user} verificado`} />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                        <span>{post.timeLabel}</span>
                        <span>|</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {post.distance}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="self-start rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Profissional
                  </span>
                </div>

                <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                  {post.content}
                </p>

                <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                    {post.category}
                  </span>

                  {post.authorId === "me" ? (
                    <span className="text-sm font-semibold text-slate-400">Publicado por você</span>
                  ) : (
                    <button
                      onClick={() => void handleOpenChat(post.id)}
                      disabled={openingPostId === post.id}
                      className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
                    >
                      {openingPostId === post.id
                        ? "Abrindo..."
                        : post.chatId
                          ? "Abrir conversa"
                          : "Chamar no chat"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <h2 className="text-lg font-bold text-slate-900">Nenhuma divulgação encontrada</h2>
            <p className="mt-2 text-sm text-slate-500">
              Tente outro termo para localizar um profissional.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
