import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import logoImg from "@/assets/iconworqo.png";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { formatPhone, isAdult } from "../utils/helpers";

const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS ?? "gabrielspec99@gmail.com")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(value: string) {
  const normalizedEmail = value.trim().toLowerCase();
  return Boolean(normalizedEmail && adminEmails.includes(normalizedEmail));
}

export function Register() {
  const navigate = useNavigate();
  const { register } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [nameFocus, setNameFocus] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [confirmEmailFocus, setConfirmEmailFocus] = useState(false);
  const [phoneFocus, setPhoneFocus] = useState(false);
  const [dobFocus, setDobFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useErrorToast(error);

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString()
    .split("T")[0];
  const isAdminRegistration = isAdminEmail(email);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError("Os e-mails informados precisam ser iguais.");
      return;
    }

    if (!isAdminRegistration && !isAdult(birthDate)) {
      setError("Para criar a conta, você precisa ter pelo menos 18 anos.");
      return;
    }

    setIsSubmitting(true);

    const result = await register({
      fullName: isAdminRegistration ? "Administração" : fullName.trim(),
      email: email.trim(),
      confirmEmail: confirmEmail.trim(),
      phone: isAdminRegistration ? "" : phone.trim(),
      birthDate: isAdminRegistration ? "" : birthDate,
      password,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos criar sua conta agora.");
      return;
    }

    setError("");
    navigate("/verify");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 flex w-full max-w-md flex-col items-center rounded-[2rem] border border-white/50 bg-white px-5 py-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:px-8 sm:py-8 md:p-10"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 150 }}
        className="mb-8 w-full"
      >
        <div className="mb-2 flex items-start gap-3 sm:items-center">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 blur-md" />
            <img
              src={logoImg}
              alt="Worko"
              className="relative z-10 h-8 w-8 object-contain drop-shadow-sm"
            />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-800"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            Crie sua conta
          </h1>
        </div>
      </motion.div>

      <form className="w-full space-y-4" onSubmit={handleSubmit}>
        {!isAdminRegistration ? (
        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-slate-700">Nome completo</label>
          <div
            className={`relative flex w-full items-center rounded-2xl border bg-slate-50 px-4 py-3 transition-all duration-300 ${
              nameFocus
                ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <User
              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                nameFocus ? "text-blue-500" : "text-slate-400"
              }`}
            />
            <input
              type="text"
              placeholder="João da Silva"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              onFocus={() => setNameFocus(true)}
              onBlur={() => setNameFocus(false)}
              className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>
        ) : null}

        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-slate-700">E-mail</label>
          <div
            className={`relative flex w-full items-center rounded-2xl border bg-slate-50 px-4 py-3 transition-all duration-300 ${
              emailFocus
                ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Mail
              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                emailFocus ? "text-blue-500" : "text-slate-400"
              }`}
            />
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
              className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-slate-700">Confirmar e-mail</label>
          <div
            className={`relative flex w-full items-center rounded-2xl border bg-slate-50 px-4 py-3 transition-all duration-300 ${
              confirmEmailFocus
                ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Mail
              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                confirmEmailFocus ? "text-blue-500" : "text-slate-400"
              }`}
            />
            <input
              type="email"
              placeholder="Repita seu e-mail"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              onFocus={() => setConfirmEmailFocus(true)}
              onBlur={() => setConfirmEmailFocus(false)}
              className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        {!isAdminRegistration ? (
        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-slate-700">Telefone</label>
          <div
            className={`relative flex w-full items-center rounded-2xl border bg-slate-50 px-4 py-3 transition-all duration-300 ${
              phoneFocus
                ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Phone
              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                phoneFocus ? "text-blue-500" : "text-slate-400"
              }`}
            />
            <input
              type="tel"
              placeholder="(11) 90000-0000"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              onFocus={() => setPhoneFocus(true)}
              onBlur={() => setPhoneFocus(false)}
              className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>
        ) : null}

        {!isAdminRegistration ? (
        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-slate-700">
            Data de nascimento
          </label>
          <div
            className={`relative flex w-full items-center rounded-2xl border bg-slate-50 px-4 py-3 transition-all duration-300 ${
              dobFocus
                ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Calendar
              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                dobFocus ? "text-blue-500" : "text-slate-400"
              }`}
            />
            <input
              type="date"
              max={maxDate}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              onFocus={() => setDobFocus(true)}
              onBlur={() => setDobFocus(false)}
              className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>
        ) : null}

        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-slate-700">Senha</label>
          <div
            className={`relative flex w-full items-center rounded-2xl border bg-slate-50 px-4 py-3 transition-all duration-300 ${
              passwordFocus
                ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Lock
              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                passwordFocus ? "text-blue-500" : "text-slate-400"
              }`}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Crie uma senha com pelo menos 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setPasswordFocus(true)}
              onBlur={() => setPasswordFocus(false)}
              className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <motion.button
          disabled={isSubmitting}
          whileHover={!isSubmitting ? { scale: 1.02 } : {}}
          whileTap={!isSubmitting ? { scale: 0.98 } : {}}
          className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 font-medium transition-all ${
            isSubmitting
              ? "cursor-wait bg-slate-100 text-slate-400"
              : "bg-blue-600 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.28)] hover:bg-blue-700"
          }`}
        >
          <span className="relative z-10 text-base font-semibold">
            {isSubmitting ? "Criando conta..." : "Criar conta"}
          </span>
          {!isSubmitting ? (
            <>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          ) : null}
        </motion.button>

        <p className="text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link to="/" className="font-semibold text-blue-600 hover:text-blue-700">
            Entrar
          </Link>
        </p>
      </form>
    </motion.div>
  );
}

