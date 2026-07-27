import {
  ACCEPTED_SERVICES_NOTICE,
  RESTRICTED_SERVICES_NOTICE,
  acceptedServiceTermsBullets,
} from "./serviceCatalog";
import { supportInfo } from "./support";

export const LEGAL_VERSION = "2026-06-18";
export const LEGAL_LAST_UPDATED = "18/06/2026";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const PRIVACY_CONTACT_CHANNEL = supportInfo.email
  ? `pelo SAC oficial do aplicativo ou pelo e-mail ${supportInfo.email}`
  : "pelo SAC oficial do aplicativo ou por outro canal oficial divulgado pelo Worko";

export const termsOfUseSections: LegalSection[] = [
  {
    id: "termos-objeto",
    title: "1. Objeto do Worko e papel da plataforma",
    paragraphs: [
      "O Worko é uma plataforma digital de aproximação entre pessoas que procuram serviços leves e profissionais independentes que desejam divulgar sua atuação por mapa, mural, perfil, chat, carteira, SAC e recursos de verificação.",
      "O Worko não é empregador, tomador direto do serviço, seguradora, transportadora, fiador, representante legal, conselho profissional nem responsável técnico pelos serviços anunciados ou contratados entre usuários(as).",
    ],
    bullets: [
      "O app funciona como ambiente de publicação, descoberta, negociação, suporte e, quando disponível, intermediação operacional de pagamento.",
      "A execução do serviço, o comparecimento presencial, a qualidade da entrega e a regularidade profissional continuam sendo responsabilidade direta das partes envolvidas.",
    ],
  },
  {
    id: "termos-cadastro",
    title: "2. Cadastro, elegibilidade, login e sessão",
    paragraphs: [
      "O(a) usuário(a) deve fornecer dados verdadeiros, atualizados, completos e de sua titularidade, incluindo nome, e-mail, telefone, data de nascimento, endereço e, quando aplicável, CPF e chave Pix.",
      "Cada conta deve corresponder a uma pessoa real. Contas falsas, automatizadas, duplicadas, compartilhadas ou mantidas em nome de terceiro podem ser bloqueadas, limitadas ou encerradas.",
    ],
    bullets: [
      "O(a) usuário(a) é responsável por manter senha, códigos de verificação, dispositivo e canal de acesso em sigilo.",
      "A opção de manter login ativo pode armazenar a sessão no próprio dispositivo até logout manual, expiração, risco de segurança ou revogação interna.",
      "O Worko pode exigir nova autenticação, confirmação por e-mail, verificação de CPF, autorização de dispositivo ou outras medidas quando houver suspeita de fraude, conflito cadastral ou exigência legal.",
    ],
  },
  {
    id: "termos-verificação",
    title: "3. Verificação de conta, CPF, chave Pix e selos",
    paragraphs: [
      "Os selos e status de verificação do Worko indicam apenas que a plataforma concluiu as checagens disponíveis naquele momento, como verificação de e-mail, confirmação de CPF e compatibilidade operacional da chave Pix cadastrada para saque.",
      "Esses selos não representam garantia absoluta de identidade, idoneidade, capacidade técnica, regularidade fiscal, licença profissional, antecedentes, pontualidade, resultado do serviço ou ausência de risco.",
    ],
    bullets: [
      "Divergências entre nome, CPF, data de nascimento, chave Pix ou outros dados podem impedir verificações, liberar menos recursos ou bloquear funcionalidades.",
      "O(a) usuário(a) autoriza as validações cadastrais e antifraude estritamente necessárias para conta, pagamentos, carteira, suporte e segurança da plataforma.",
      "Currículo, descrições, fotos, profissões, habilidades e qualquer informação publicada no perfil são de responsabilidade do(a) próprio(a) usuário(a).",
    ],
  },
  {
    id: "termos-serviços-aceitos",
    title: "4. Catálogo de serviços aceitos e limites operacionais",
    paragraphs: [
      "O catálogo atual do Worko é voltado a serviços leves, técnicos, de instalação, organização, apoio prático, suporte digital e limpeza leve ou especializada.",
      "O catálogo funciona como referência operacional do que pode ser solicitado ou divulgado no app e pode ser alterado pelo Worko conforme segurança, cobertura do produto, capacidade técnica da plataforma e requisitos legais.",
      ACCEPTED_SERVICES_NOTICE,
    ],
    bullets: [
      ...acceptedServiceTermsBullets,
      "Serviços que exijam licença, registro em conselho, alvará, seguro ou certificação específica só podem ser divulgados por quem realmente possua a habilitação exigida e possa comprová-la quando necessário.",
      RESTRICTED_SERVICES_NOTICE,
    ],
  },
  {
    id: "termos-localização",
    title: "5. Geolocalização, mapa, endereços e área de cobertura",
    paragraphs: [
      "Os recursos de mapa, localização atual, proximidade, mascaramento de ponto e exibição territorial dependem de permissão do dispositivo, sinal, GPS, conectividade, dados fornecidos pelo(a) usuário(a) e provedores terceirizados de mapas e geolocalização.",
      "Indicações de distância, bairro, rota, pin próximo, área aproximada e endereço informado podem ser aproximadas e não substituem confirmação direta entre as partes antes do deslocamento ou da contratação.",
      "Na fase atual do produto, o Worko opera em área piloto, com destaque para Suzano e Itaquaquecetuba. Funcionalidades geográficas podem ser limitadas, ocultadas ou indisponibilizadas fora da área atendida.",
    ],
    bullets: [
      "Usuários(as) fora da área piloto podem receber avisos de indisponibilidade territorial e não terão acesso integral ao conteúdo do mapa.",
      "O Worko pode ampliar, reduzir ou redefinir a área de cobertura a qualquer momento, sem obrigação de manter cobertura permanente em localidade específica.",
      "O(a) usuário(a) deve conferir o endereço final e as condições da visita antes de sair para atendimento ou receber alguém em seu local.",
    ],
  },
  {
    id: "termos-conteúdo",
    title: "6. Publicações, mural, chat, SAC e conduta",
    paragraphs: [
      "O(a) usuário(a) é exclusivamente responsável por tudo o que publica, solicita, divulga, negocia, envia, armazena ou compartilha no mural, perfil, chat, comprovantes, avaliações, SAC e demais áreas do aplicativo.",
      "O Worko pode aplicar filtros, registros operacionais, revisão de segurança e moderação para prevenir fraude, golpe, fuga de pagamento, assédio, spam, conteúdo proibido, abuso de plataforma e risco a usuários(as).",
    ],
    bullets: [
      "É proibido publicar conteúdo ilegal, enganoso, ofensivo, discriminatório, sexualmente explícito, violento, fraudulento, invasivo, com malware ou que viole direitos de terceiros.",
      "É proibido usar o app para golpes, lavagem de dinheiro, falsidade ideológica, assédio, phishing, spam, pirâmide, cobrança indevida ou qualquer atividade ilícita.",
      "É proibido enviar telefone, e-mail, redes sociais, links, chaves de contato ou sequências numéricas camufladas com o objetivo de tirar a negociação, o suporte ou o pagamento para fora do Worko.",
      "O SAC online segue fila de atendimento por ordem de chegada, pode exibir a quantidade de pessoas à frente e pode ser encerrado pelo(a) próprio(a) usuário(a) ou pelo atendimento quando o caso for concluído.",
      "O Worko pode remover publicações, ocultar conteúdo, limitar mensagens, congelar funcionalidades, encerrar tickets e suspender contas quando identificar descumprimento destes termos, risco, fraude ou ordem legal.",
    ],
  },
  {
    id: "termos-relação",
    title: "7. Serviços, pagamentos internos, carteira, Asaas e comprovantes",
    paragraphs: [
      "Orçamento, visita técnica, deslocamento, prazo, execução do serviço, garantia, nota fiscal, tributos, reembolso, regularidade profissional e cumprimento do combinado são assumidos diretamente pelos(as) usuários(as) envolvidos(as) na relação.",
      "Quando o pagamento é realizado dentro do Worko, a operação pode usar infraestrutura terceirizada de apoio, inclusive o Asaas, com geração de cobrança Pix, QR Code, código Pix para copiar e colar, conciliação de status, notificações internas e comprovantes.",
      "No fluxo atual da plataforma, o total exibido ao contratante pode incluir taxa de serviço do Worko de 10% sobre o valor do atendimento e taxa fixa operacional do Asaas de R$ 1,99 associada ao recebimento interno, quando aplicável. Os valores efetivos devem ser exibidos na própria tela de pagamento antes da confirmação.",
      "Valores liberados para o(a) profissional podem passar primeiro pela carteira do app e depender de confirmação do atendimento, status do provedor, regras antifraude, histórico do pedido, validação de conta e disponibilidade operacional do parceiro de pagamento.",
    ],
    bullets: [
      "O comprovante ou recibo gerado em PDF, tela ou e-mail serve para registrar a transação e não substitui garantia técnica do serviço nem prova isolada de adimplemento integral de todas as obrigações entre as partes.",
      "O Worko pode recusar, cancelar, atualizar ou reprocessar cobranças internas quando houver divergência de valor, falha do provedor, fraude, contestação, duplicidade, indisponibilidade técnica ou descumprimento das regras do app.",
      "A disponibilidade de métodos de pagamento, cobrança, estorno, liberação e conciliação pode variar por versão do produto, integração ativa e regras do provedor terceirizado.",
    ],
  },
  {
    id: "termos-saques",
    title: "8. Saques Pix, saldo e liberação de valores",
    paragraphs: [
      "Saques dependem de conta autenticada, CPF validado quando exigido, chave Pix compatível com as regras operacionais do app e saldo efetivamente disponível na infraestrutura de pagamento utilizada pelo Worko.",
      "No fluxo atual, o app pode oferecer saque imediato com taxa fixa e opção de saque sem taxa 24 horas depois que o valor cair na carteira do(a) usuário(a). As condições, custos e prazos informados na carteira podem mudar conforme a integração disponível e devem ser conferidos no momento do saque.",
    ],
    bullets: [
      "O saldo exibido pode depender de sincronização com o provedor de pagamento e de atualização do status interno da carteira.",
      "Saques falhos, cancelados, em análise ou em processamento bancário podem ficar temporariamente indisponíveis até nova conciliação.",
      "Obrigações fiscais, declaratórias, previdenciárias e contábeis decorrentes dos valores recebidos são de responsabilidade do(a) usuário(a) beneficiário(a).",
    ],
  },
  {
    id: "termos-segurança",
    title: "9. Segurança e encontros presenciais",
    paragraphs: [
      "Encontros presenciais, visitas a domicílio, acesso a imóveis, compartilhamento de documentos, entrega de bens, uso de ferramentas e transferência de valores envolvem risco inerente e devem ser conduzidos com cautela pelas partes.",
    ],
    bullets: [
      "Não compartilhe senha, código, token, dados bancários sensíveis ou documentos além do necessário sem confirmar a identidade da outra parte.",
      "Prefira validar endereço, horário, escopo, valor, forma de acesso e detalhes do atendimento antes do deslocamento.",
      "Em caso de emergência, ameaça, acidente ou crime, acione imediatamente os serviços públicos competentes. O Worko não substitui atendimento emergêncial.",
    ],
  },
  {
    id: "termos-licença",
    title: "10. Propriedade intelectual e licença de uso",
    paragraphs: [
      "O aplicativo, a marca Worko, sua identidade visual, código, banco de dados, textos de sistema, estrutura de navegação e demais ativos da plataforma pertencem ao Worko ou a seus licenciantes e são protegidos pela legislação aplicável.",
      "Ao publicar conteúdo no aplicativo, o(a) usuário(a) concede ao Worko licença não exclusiva, gratuita, revogável e limitada ao funcionamento, armazenamento, exibição, moderação, distribuição interna, segurança e melhoria do serviço, respeitados os limites legais.",
    ],
  },
  {
    id: "termos-suspensao",
    title: "11. Suspensão, encerramento e alterações",
    paragraphs: [
      "O Worko pode restringir, suspender, congelar carteira, revogar verificações, encerrar tickets, remover conteúdos ou cancelar contas quando identificar descumprimento destes termos, risco de dano, fraude, ordem legal, abuso da plataforma, inatividade relevante ou necessidade operacional.",
      "Funcionalidades do app podem ser alteradas, expandidas, descontinuadas ou condicionadas a verificações adicionais a qualquer momento, inclusive em fase beta, com comunicação adequada quando exigida pela legislação aplicável.",
    ],
  },
  {
    id: "termos-responsabilidade",
    title: "12. Limitação de responsabilidade",
    paragraphs: [
      "Na máxima extensão permitida por lei, o Worko não responde por atos, omissões, informações, condutas, serviços, deslocamentos, acidentes, pagamentos, inadimplementos, danos indiretos, lucros cessantes, perda de oportunidade, prejuízos reputacionais ou conflitos entre usuários(as) ou terceiros.",
      "Nada nestes termos exclui responsabilidade que não possa ser afastada pela legislação brasileira, nem limita direitos do consumidor quando houver relação de consumo sujeita à proteção legal específica.",
    ],
  },
  {
    id: "termos-foro",
    title: "13. Lei aplicável e foro",
    paragraphs: [
      "Estes termos são regidos pela legislação brasileira. Sempre que houver relação de consumo, ficam preservados os direitos e o foro assegurados ao consumidor pela legislação aplicável.",
      "Na ausência de regra obrigatória em sentido diverso, as controvérsias devem ser tratadas prioritariamente pelos canais oficiais do Worko e, não sendo possível a solução amigável, pelo foro brasileiro competente.",
    ],
  },
];

export const privacySections: LegalSection[] = [
  {
    id: "privacidade-escopo",
    title: "1. Escopo deste aviso e canal de contato",
    paragraphs: [
      "Este aviso descreve como o Worko pode coletar, usar, armazenar, compartilhar e proteger dados pessoais tratados nas funcionalidades do aplicativo. No contexto dos dados tratados diretamente pela plataforma, o Worko atua como controlador, sem prejuízo do papel desempenhado por operadores e provedores terceiros independentes.",
      `Solicitações relacionadas a privacidade, dados pessoais, segurança, remoção de conteúdo, conta, pagamentos ou exercício de direitos podem ser enviadas ${PRIVACY_CONTACT_CHANNEL}.`,
    ],
  },
  {
    id: "privacidade-dados",
    title: "2. Dados pessoais e dados técnicos tratados",
    paragraphs: [
      "O Worko pode tratar dados cadastrais e de identificação, dados de perfil e verificação, informações de pedidos e divulgações, mensagens de chat e SAC, dados de pagamento e saque, além de metadados técnicos necessários ao funcionamento e à segurança do app.",
    ],
    bullets: [
      "Dados cadastrais: nome, e-mail, telefone, data de nascimento, endereço, CPF, avatar e identificadores internos da conta.",
      "Dados de perfil: biografia, profissão, habilidades, disponibilidade, chave Pix e demais dados que o(a) próprio(a) usuário(a) publicar ou editar.",
      "Dados de uso e relacionamento: pedidos no mapa, divulgações, chats, avaliações, histórico de atendimento, tickets do SAC, fila de atendimento e mensagens trocadas com o suporte.",
      "Dados de pagamento e carteira: valor do serviço, taxa, status de cobrança, QR Code Pix, código Pix para copiar e colar, recibos, comprovantes em PDF, histórico de saque e status de conciliação.",
      "Dados de verificação e antifraude: confirmação de e-mail, validação de CPF, compatibilidade da chave Pix, registros de autenticação, sessões ativas e sinais de risco operacional.",
      "Dados técnicos: data e hora de uso, identificadores de sessão, versão do app, plataforma, token de notificação push, rótulos de dispositivo, preferências locais, registros de erro do cliente e, quando aplicável, metadados de infraestrutura e acesso associados a segurança da aplicação.",
      "Dados de localização: permissão de GPS, localização atual autorizada, endereço informado pelo(a) usuário(a), coordenadas aproximadas, máscara territorial do pedido e informações de proximidade exibidas no mapa.",
    ],
  },
  {
    id: "privacidade-finalidades",
    title: "3. Finalidades do tratamento",
    paragraphs: [
      "Os dados são tratados para operar o aplicativo, viabilizar as funcionalidades contratadas, autenticar usuários(as), publicar perfis e pedidos, aproximar pessoas por localização, permitir pagamentos internos, oferecer suporte, prevenir fraude e cumprir obrigações legais e regulatórias.",
    ],
    bullets: [
      "Criar, manter, autenticar, recuperar e proteger contas de usuários(as).",
      "Executar verificações de e-mail, CPF, chave Pix e segurança de sessão.",
      "Exibir mapa, proximidade, área atendida e conteúdo geográfico do app.",
      "Permitir mural, divulgação, pedidos, conversas, histórico de atendimento e avaliações.",
      "Gerar, conciliar e registrar pagamentos, comprovantes, carteira interna e saques Pix.",
      "Atender tickets do SAC, organizar fila de suporte, responder demandas e registrar histórico do atendimento.",
      "Enviar notificações operacionais, alertas de pagamento, liberação de saque, mensagens de chat e avisos relevantes do produto.",
      "Investigar fraude, abuso, violação dos termos, falhas técnicas, erros de cliente e incidentes de segurança.",
      "Cumprir exigências legais, regulatórias, judiciais e de cooperação com autoridades competentes.",
    ],
  },
  {
    id: "privacidade-bases",
    title: "4. Bases legais utilizadas",
    paragraphs: [
      "O Worko trata dados pessoais, conforme o caso concreto, com fundamento na execução dos termos e de procedimentos preliminares relacionados ao uso da plataforma, no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos, na prevenção a fraude, na segurança do titular e de terceiros e, quando necessário, em consentimento ou permissão específica do dispositivo.",
      "Quando a funcionalidade depender de permissão do aparelho, como geolocalização em tempo real ou notificações push, o(a) usuário(a) pode negar ou revogar a permissão, ciente de que algumas funções podem ficar limitadas.",
    ],
  },
  {
    id: "privacidade-compartilhamento",
    title: "5. Compartilhamento com terceiros e operadores",
    paragraphs: [
      "Os dados podem ser compartilhados com operadores, prestadores e infraestrutura essencial ao funcionamento do app, sempre na medida necessária para a finalidade correspondente e dentro dos limites legais.",
    ],
    bullets: [
      "Provedores de mapas e geolocalização, como serviços da Google Maps Platform.",
      "Prestadores(as) de cobrança, conciliação, carteira operacional, Pix, comprovantes e saques, incluindo o Asaas e serviços correlatos necessários ao fluxo de pagamento.",
      "Prestadores(as) de e-mail, autenticação, envio de mensagens, recuperação de conta e comunicações transacionais.",
      "Prestadores(as) de verificação cadastral e de CPF, conforme a configuração ativa do app e as fontes oficiais ou bases consultadas pelo provedor contratado.",
      "Prestadores(as) de notificação push e infraestrutura correlata, como Firebase Cloud Messaging e serviços Google associados ao envio de alertas para o dispositivo.",
      "Prestadores(as) de hospedagem, monitoramento, armazenamento, observabilidade, segurança, atendimento e suporte técnico.",
      "Autoridades administrativas, policiais, reguladoras ou judiciais, quando houver base legal, ordem competente ou necessidade de resguardar direitos, prevenir fraude ou colaborar com investigações.",
    ],
  },
  {
    id: "privacidade-dispositivo",
    title: "6. Permissões do dispositivo, armazenamento local e notificações",
    paragraphs: [
      "O app pode utilizar armazenamento local ou de sessão do próprio dispositivo para manter login ativo, salvar preferência de tema, lembrar estado temporário da interface, registrar token push e preservar elementos operacionais necessários ao uso contínuo do aplicativo.",
      "Quando o(a) usuário(a) ativa a opção de manter-se conectado, a sessão pode permanecer salva no aparelho até logout manual, expiração, troca de credenciais, revogação por segurança ou encerramento da conta.",
      "As notificações push dependem de permissão do sistema operacional e do token do dispositivo. O(a) usuário(a) pode desativar o recebimento nas configurações do aparelho, ciente de que isso pode reduzir alertas sobre chat, pagamento, saque, suporte e eventos relevantes.",
    ],
    bullets: [
      "O Worko pode armazenar localmente preferências de tema, estado da sessão, token push, identificadores de notificações entregues e dados temporários de uso do app.",
      "A permissão de localização é usada para mapa, proximidade, busca territorial, posição atual e recursos relacionados a pedidos e divulgações.",
      "A revogação de permissão pode impedir parte da experiência, mas não afeta necessáriamente o cadastro básico do(a) usuário(a).",
    ],
  },
  {
    id: "privacidade-retencao",
    title: "7. Retenção, eliminação e guarda de registros",
    paragraphs: [
      "Os dados são mantidos pelo tempo necessário para cumprir as finalidades informadas, operar a conta, prevenir fraude, atender suporte, resolver disputas, concluir pagamentos, processar saques, cumprir exigências legais e exercer direitos em processos administrativos, arbitrais ou judiciais.",
      "Registros de acesso, autenticação, segurança, suporte, pagamentos, saques, comprovantes, eventos de webhook, mensagens e logs técnicos podem ser mantidos pelo prazo mínimo exigido pela legislação aplicável e por períodos adicionais quando houver base legal para tanto.",
      "Quando aplicável, registros de acesso a aplicações de internet podem ser preservados pelo prazo mínimo previsto no Marco Civil da Internet, sem prejuízo de guardas adicionais exigidas por lei, ordem judicial, investigação, auditoria ou prevenção a fraude.",
      "O(a) usuário(a) autenticado(a) pode iniciar a exclusão da conta em Perfil > Meus dados > Excluir conta e dados pessoais. Também é possível solicitar a exclusão fora do app pela página pública /account-deletion.html ou pelos canais oficiais de suporte informados neste aviso.",
      "Após a confirmação, o Worko encerra sessões, remove ou anonimiza dados cadastrais e de perfil, tokens de notificação, publicações, tickets de suporte e dados associados que não precisem permanecer por obrigação legal, prevenção a fraude, segurança, pagamentos, disputa, auditoria ou exercício regular de direitos.",
    ],
  },
  {
    id: "privacidade-direitos",
    title: "8. Direitos do titular",
    paragraphs: [
      "Nos termos da LGPD e quando aplicável, o titular pode solicitar confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas, observados os limites legais, técnicos e de segredo empresarial.",
      "O exercício de direitos pode exigir validação de identidade para proteger a própria conta e os dados de terceiros. Algumas solicitações podem ser total ou parcialmente recusadas quando houver obrigação legal de guarda, risco de fraude, inviabilidade técnica ou fundamento legítimo para manutenção do dado.",
    ],
  },
  {
    id: "privacidade-segurança",
    title: "9. Segurança da informação e resposta a incidentes",
    paragraphs: [
      "O Worko adota medidas técnicas e administrativas razoáveis para proteger dados pessoais contra acesso não autorizado, perda, alteração, vazamento, divulgação ou destruição indevida, inclusive controles de autenticação, segregação de acesso, registros de evento e mecanismos de monitoramento.",
      "Nenhum sistema é totalmente inviolável. Por isso, o(a) usuário(a) também deve manter senha forte, aparelho atualizado, cuidado com links suspeitos, sigilo de códigos e atenção a tentativas de engenharia social.",
      "Quando necessário, o Worko pode registrar erros do cliente, eventos operacionais, tentativas de uso indevido, falhas de integração e incidentes de segurança para diagnóstico, estabilização do produto, auditoria e adoção de medidas de contenção.",
    ],
  },
  {
    id: "privacidade-menores",
    title: "10. Crianças e adolescentes",
    paragraphs: [
      "O Worko não é destinado ao cadastro autônomo de crianças. Caso haja tratamento de dados de adolescentes ou de menores em situações permitidas, isso deve observar a legislação aplicável e, quando exigido, a participação ou autorização do responsável legal.",
    ],
  },
  {
    id: "privacidade-atualizacoes",
    title: "11. Atualizações deste documento",
    paragraphs: [
      "Este documento pode ser atualizado para refletir mudanças legais, regulatórias, operacionais, de segurança ou de produto. A versão vigente será a publicada dentro do aplicativo.",
      `Mudanças relevantes podem ser comunicadas no próprio app, e o uso continuado da plataforma após a disponibilização de nova versão deve ser interpretado em conjunto com as regras de aceite e renovação de consentimentos aplicáveis a cada funcionalidade.`,
    ],
  },
];
