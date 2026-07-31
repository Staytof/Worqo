import {
  BellRing,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Headset,
  LockKeyhole,
  MapPinned,
  MessageCircleMore,
  ShieldCheck,
  Star,
  UserRoundCheck,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ProfileSectionLayout } from "./profile/ProfileSectionLayout";

type ManualSection = {
  title: string;
  summary: string;
  icon: LucideIcon;
  steps: string[];
};

const clientSections: ManualSection[] = [
  {
    title: "1. Conta, acesso e segurança",
    summary: "Como entrar, proteger e administrar sua conta.",
    icon: LockKeyhole,
    steps: [
      "Cadastre nome, e-mail, telefone, CPF e data de nascimento verdadeiros. Confirme o token enviado por e-mail e conclua os dados solicitados pelo app.",
      "Ao entrar em outro celular, o Worko pode exigir um novo token por e-mail e avisar a conta sobre o acesso. Se não reconhecer a tentativa, troque a senha imediatamente pela opção “Esqueci minha senha”.",
      "Nunca informe senha ou token a clientes, prestadores ou supostos atendentes. O suporte não pede sua senha.",
      "Em Meus Dados você pode revisar o perfil e solicitar a exclusão. E-mails de contas excluídas, banidas ou suspensas ficam bloqueados e não podem criar outra conta Worko.",
    ],
  },
  {
    title: "2. Tela inicial, mapa e navegação",
    summary: "Onde encontrar pedidos, conversas, avisos e histórico.",
    icon: MapPinned,
    steps: [
      "A tela inicial é o ponto de partida para publicar um pedido. Use a barra inferior para acessar conversas, pedidos, notificações e perfil.",
      "Permita a localização somente quando se sentir confortável. O endereço exato do atendimento é protegido durante a busca e só é liberado no fluxo confirmado.",
      "Consulte Notificações para acompanhar interesses, mensagens, pagamento e mudanças importantes. Ative as permissões do celular para receber alertas externos com o som padrão do dispositivo.",
    ],
  },
  {
    title: "3. Criando um pedido",
    summary: "Do que você precisa informar até a publicação no mapa.",
    icon: BriefcaseBusiness,
    steps: [
      "Escolha a categoria correta, explique claramente o que precisa e publique o pedido. Não inclua telefone, e-mail, links ou outros contatos externos na descrição.",
      "Revise o local indicado. Enquanto o pedido estiver aberto, prestadores próximos e aptos poderão demonstrar interesse.",
      "Mantenha apenas o pedido que realmente pretende contratar. Você pode acompanhar ou cancelar a solicitação pelo cartão de pedido ativo enquanto o fluxo permitir.",
    ],
  },
  {
    title: "4. Escolhendo um prestador verificado",
    summary: "Como avaliar quem pediu para conversar.",
    icon: UserRoundCheck,
    steps: [
      "Os prestadores passam por análise administrativa de identidade e documentos antes da liberação completa do perfil. O selo e o status ajudam na identificação, mas não substituem sua avaliação do profissional e do serviço.",
      "Ao receber um interesse, abra o perfil, confira apresentação, profissões, habilidades, avaliações e histórico disponível. Aceite para conversar ou recuse para continuar procurando.",
      "A solicitação de conversa some depois de aceita ou recusada e só volta se o prestador fizer uma nova solicitação válida.",
      "A verificação confirma os dados analisados; ela não é garantia de qualidade, licença profissional ou resultado. Em atividades regulamentadas, peça os comprovantes adequados pelo fluxo seguro do app.",
    ],
  },
  {
    title: "5. Chat e negociação segura",
    summary: "Como alinhar o serviço sem sair da proteção do Worko.",
    icon: MessageCircleMore,
    steps: [
      "Use o chat para explicar o problema, enviar as informações permitidas e combinar escopo, materiais, prazo e condições antes de fechar.",
      "Não envie telefone, e-mail, redes sociais, links de pagamento ou dados bancários. Não pague por fora do Worko: isso elimina a proteção e o registro da plataforma.",
      "Se houver abuso, fraude, pressão para contato externo ou conduta inadequada, interrompa a conversa, guarde os registros e acione o SAC.",
      "Após a conclusão do serviço, o chat é bloqueado. Cliente ou prestador pode usar “Entrar em contato novamente” para reabrir uma nova conversa quando necessário.",
    ],
  },
  {
    title: "6. Fechamento, valor e agendamento",
    summary: "O acordo que será confirmado antes do Pix.",
    icon: CalendarClock,
    steps: [
      "Quando estiver segura, preencha os detalhes finais: título, valor do serviço, data, horário, tolerância de atraso e endereço. Datas anteriores não podem ser escolhidas.",
      "O valor mínimo aceito para um serviço é R$ 50,00. Confira tudo antes de enviar; o prestador deve revisar e confirmar os detalhes no próprio app.",
      "Materiais e outras condições do serviço devem ser esclarecidos antes do fechamento. O deslocamento do prestador até você nunca pode ser cobrado do cliente.",
      "Ferramentas necessárias para executar o trabalho são obrigação do prestador. Se o serviço exigir materiais específicos, deixe por escrito quem os fornecerá antes da confirmação.",
    ],
  },
  {
    title: "7. Pagamento Pix protegido",
    summary: "Como pagar, conferir as taxas e evitar golpes.",
    icon: CircleDollarSign,
    steps: [
      "Depois da confirmação do prestador, o app libera a tela de pagamento com QR Code e Pix copia e cola. Pague somente a cobrança exibida dentro do Worko.",
      "O total mostra o valor do serviço, a taxa do app de 10% e a taxa de intermediação Worko de R$ 2,99. Revise o resumo antes de pagar.",
      "O Pix pode ser pago em segundos, mas a confirmação depende da compensação e da comunicação do banco com o intermediador. Aguarde a tela confirmar; não gere ou pague outra cobrança para o mesmo pedido.",
      "Após a confirmação, o valor fica protegido no fluxo do Worko até a conclusão. Guarde o comprovante e nunca faça um segundo pagamento porque alguém pediu pelo chat.",
    ],
  },
  {
    title: "8. Atendimento, conclusão e avaliação",
    summary: "O que fazer no dia do serviço e quando ele terminar.",
    icon: Wrench,
    steps: [
      "Acompanhe data, horário, endereço e tolerância combinados. O prestador é responsável pelo próprio trajeto e pelas próprias ferramentas; você não paga o deslocamento dele.",
      "Antes de concluir, confira se o serviço acordado foi realmente executado. Só libere o pagamento quando estiver de acordo com a entrega.",
      "Se o prestador não aparecer, aguarde o horário combinado e toda a tolerância. Depois use “Prestador não compareceu”, explique o ocorrido e, se quiser, anexe uma foto. O valor fica bloqueado imediatamente.",
      "O prestador terá 12 horas para responder. Se confirmar a ausência ou não responder no prazo sem registro de chegada, o ressarcimento integral é iniciado automaticamente; se contestar, a administração analisa chat, horário, chegada e evidências.",
      "Quando o ressarcimento for aprovado, você recebe tudo o que pagou: valor do serviço, taxa do app de 10% e taxa de intermediação Worko de R$ 2,99. O Worko não retém taxas quando o serviço não aconteceu.",
      "Avalie o prestador com honestidade. A avaliação ajuda outros clientes e deve tratar apenas da experiência real no atendimento.",
      "Se houver desacordo, falha grave ou serviço não entregue, não conclua por pressão. Registre o problema e use o suporte ou a disputa disponível no pedido.",
    ],
  },
  {
    title: "9. Pedidos, notificações e suporte",
    summary: "Onde consultar o que aconteceu e pedir ajuda.",
    icon: Headset,
    steps: [
      "Em Pedidos, acompanhe o atendimento ativo e o histórico. Em Notificações, veja interesses, mensagens, pagamento e demais eventos da conta.",
      "Em Perfil, atualize seus dados, consulte este manual, os termos e o SAC. Use o suporte oficial para dúvidas de conta, segurança, pagamento ou comportamento de outro usuário.",
      "O Worko não é serviço de emergência. Em risco imediato, acidente, ameaça ou crime, procure os serviços públicos responsáveis da sua região.",
    ],
  },
];

const providerSections: ManualSection[] = [
  {
    title: "1. Cadastro e verificação obrigatória",
    summary: "Como sua conta é analisada antes de trabalhar.",
    icon: UserRoundCheck,
    steps: [
      "Preencha nome, CPF, data de nascimento, telefone e e-mail verdadeiros e envie foto do rosto e documento de identidade legíveis, sem cortes, reflexos ou alterações.",
      "Depois do cadastro, a administração analisa o perfil em até 1 dia útil. Até a aprovação, os recursos profissionais permanecem limitados.",
      "O resultado é enviado ao e-mail cadastrado. Se a administração solicitar novos documentos, entre na etapa de verificação e envie novamente exatamente o que foi pedido.",
      "Uma recusa impede a atuação como prestador. Documento falso, conta de terceiro, fraude ou tentativa de burlar a análise pode causar bloqueio definitivo.",
    ],
  },
  {
    title: "2. Perfil profissional e disponibilidade",
    summary: "Como apresentar seu trabalho de forma confiável.",
    icon: BriefcaseBusiness,
    steps: [
      "Complete foto, apresentação, profissões, habilidades, certificados e disponibilidade semanal. Mantenha dias e horários atualizados para não aceitar serviços que não poderá atender.",
      "Descreva somente atividades que sabe executar. Para profissões regulamentadas, mantenha licenças e qualificações válidas.",
      "Seu perfil, avaliações e serviços concluídos ajudam o cliente a decidir. Informações enganosas podem gerar denúncia, suspensão ou banimento.",
    ],
  },
  {
    title: "3. Mapa, pedidos e divulgações",
    summary: "Como encontrar clientes e assumir uma oportunidade.",
    icon: MapPinned,
    steps: [
      "No mapa, veja solicitações disponíveis na área atendida e filtre por categoria. Abra o pedido, leia a descrição e consulte o perfil disponível antes de demonstrar interesse.",
      "Assuma apenas um atendimento que realmente possa executar. Ao pedir para conversar, aguarde o cliente aceitar; ele também pode recusar e continuar procurando.",
      "Você pode criar uma divulgação profissional pelos recursos do mapa quando disponível. Não publique contato externo, promessa falsa, serviço proibido ou conteúdo fora das regras.",
      "O endereço exato do cliente permanece protegido e só aparece quando o pagamento e o atendimento estiverem confirmados.",
    ],
  },
  {
    title: "4. Chat, proposta e confirmação",
    summary: "Como negociar e fechar o serviço corretamente.",
    icon: MessageCircleMore,
    steps: [
      "Use o chat para entender o pedido e alinhar escopo, materiais, prazo e condições. Não solicite telefone, redes sociais, e-mail, pagamento externo ou chave Pix.",
      "O cliente envia os detalhes finais com título, valor, data, horário, tolerância e local. Leia tudo e confirme somente se puder cumprir.",
      "O valor mínimo de um serviço é R$ 50,00. O valor acordado do serviço é o valor líquido previsto para o prestador; as taxas do cliente aparecem separadas no pagamento.",
      "Depois da conclusão, o chat fica bloqueado. Use “Entrar em contato novamente” quando houver necessidade legítima de uma nova conversa.",
    ],
  },
  {
    title: "5. Pagamento e confirmação do atendimento",
    summary: "Quando o serviço passa a estar realmente confirmado.",
    icon: CircleDollarSign,
    steps: [
      "Depois que você confirma os detalhes, o cliente paga o Pix pelo Worko. Não inicie o serviço com base apenas em mensagem ou comprovante enviado pelo cliente.",
      "Aguarde o status de pagamento confirmado no app. O valor fica protegido no intermediador e só entra na carteira após a conclusão e a liberação do atendimento.",
      "Nunca gere cobrança paralela, peça sinal por fora ou solicite um segundo pagamento. Em caso de divergência, procure o SAC antes de executar o serviço.",
    ],
  },
  {
    title: "6. Atendimento atual, rota e obrigações",
    summary: "Tudo o que é de sua responsabilidade no deslocamento e execução.",
    icon: Wrench,
    steps: [
      "Com o Pix confirmado, o mapa mostra o botão Atendimento com o resumo completo e o botão Ver rota para abrir o endereço no Google Maps ou Waze.",
      "O trajeto, o meio de transporte, o combustível, pedágios, estacionamento e qualquer custo para chegar ao cliente são responsabilidade exclusiva do prestador. O cliente jamais pode ser cobrado pelo seu trajeto.",
      "Leve todas as ferramentas necessárias para o trabalho. Ferramentas são obrigação do prestador, não do cliente. Materiais específicos só podem seguir o que foi combinado de forma clara antes do fechamento.",
      "Compareça na data e no horário, respeite a tolerância definida e avise pelo chat se surgir um imprevisto. Não use o endereço do cliente para nenhuma finalidade fora daquele atendimento.",
      "Se o cliente informar sua ausência depois do horário e da tolerância, o pagamento será bloqueado e você terá 12 horas para responder pelo atendimento. Confirme honestamente se não compareceu ou apresente sua versão com clareza.",
      "Ao confirmar que não compareceu, ou se deixar o prazo terminar sem resposta e não houver chegada registrada, o Worko poderá iniciar automaticamente o ressarcimento integral ao cliente.",
    ],
  },
  {
    title: "7. Execução, conclusão e problemas",
    summary: "Como encerrar corretamente ou pedir suporte.",
    icon: ShieldCheck,
    steps: [
      "Execute somente o escopo combinado, cuide do local e explique ao cliente o que foi feito. Não pressione o cliente a liberar o valor antes da entrega.",
      "Quando o atendimento for concluído, o cliente confirma e libera o pagamento. Depois, faça uma avaliação honesta do cliente quando o app solicitar.",
      "Se não conseguir executar, houver risco, mudança indevida de escopo ou desacordo, registre tudo no chat e use a disputa ou o SAC. Não resolva com ameaça ou cobrança externa.",
      "Ausências confirmadas ficam registradas. Reincidência, tentativa de simular chegada ou informação falsa durante uma análise pode causar suspensão ou banimento da conta.",
    ],
  },
  {
    title: "8. Carteira e recebimento",
    summary: "Como o dinheiro chega e quais opções existem.",
    icon: WalletCards,
    steps: [
      "Depois da liberação, o valor do serviço entra na carteira. Cadastre uma chave Pix aceita pelo app e compatível com a titularidade e os dados validados da conta.",
      "A opção ⚡ Receber agora cobra taxa de R$ 1,99. A opção 🟢 Receber gratuitamente fica disponível exatamente 24 horas depois do momento em que o valor caiu na carteira.",
      "Confira valor, chave e status antes de confirmar. Processamento bancário, análise antifraude ou indisponibilidade do parceiro pode alterar o tempo de chegada.",
      "Impostos, emissão de nota fiscal, garantias legais e obrigações profissionais sobre sua renda e seu serviço são responsabilidade do prestador.",
    ],
  },
  {
    title: "9. Notificações, histórico e suporte",
    summary: "Como não perder eventos e manter a conta segura.",
    icon: BellRing,
    steps: [
      "Ative notificações e som nas configurações do aparelho para receber interesses, mensagens, confirmação de Pix, liberação da carteira e avisos de segurança.",
      "Use as telas de conversas, atendimento ativo, notificações, carteira e perfil para acompanhar cada etapa. Não confie apenas em e-mails ou capturas de tela.",
      "Em Perfil, atualize seus dados, disponibilidade e Pix, consulte termos e abra o SAC. Nunca entregue senha, token ou documento a outro usuário pelo chat.",
    ],
  },
  {
    title: "10. Avaliações e conduta profissional",
    summary: "Como construir reputação e permanecer na plataforma.",
    icon: Star,
    steps: [
      "Seja pontual, respeitoso e transparente. Cumpra o combinado, preserve a privacidade do cliente e mantenha comunicação profissional.",
      "Avaliações devem refletir somente atendimentos reais. Não ofereça desconto, dinheiro ou vantagem em troca de nota e não tente manipular reputação.",
      "Denúncias, fraude, assédio, serviço proibido, cobrança externa ou descumprimento reiterado podem levar a suspensão ou banimento, e o e-mail bloqueado não poderá criar outra conta.",
    ],
  },
];

export function ProfileManual() {
  const {
    state: { user },
  } = useApp();
  const isClient = user.accountKind === "client";
  const sections = isClient ? clientSections : providerSections;
  const manualTitle = isClient ? "Manual do cliente" : "Manual do prestador";

  return (
    <ProfileSectionLayout
      eyebrow="Central de orientação"
      title={manualTitle}
      description="Leia cada etapa antes de contratar ou atender. Este guia reúne o funcionamento completo e as principais regras de segurança do Worko."
    >
      <section className="overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-blue-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
              Guia oficial Worko
            </p>
            <h2 className="mt-1 text-xl font-black">Do acesso ao encerramento</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Abra as etapas abaixo na ordem. Em caso de dúvida, não avance com pagamento,
              conclusão ou saque antes de falar com o SAC.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3">
        {sections.map(({ title, summary, icon: Icon, steps }, index) => (
          <details
            key={title}
            open={index === 0}
            className="group rounded-[24px] border border-slate-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-slate-900 sm:text-base">{title}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
                  {summary}
                </p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
              <ol className="grid gap-3">
                {steps.map((step, stepIndex) => (
                  <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>

      <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-black text-amber-950">Regra de ouro</h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              Negocie, confirme e pague somente dentro do Worko. Nunca compartilhe senha,
              token, contato externo ou dados bancários no chat. Se algo parecer errado,
              interrompa o fluxo e procure o SAC no perfil.
            </p>
          </div>
        </div>
      </section>
    </ProfileSectionLayout>
  );
}
