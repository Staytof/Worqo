import {
  ACCEPTED_SERVICES_NOTICE,
  RESTRICTED_SERVICES_NOTICE,
  acceptedServiceTermsBullets,
} from "./serviceCatalog";
import { supportInfo } from "./support";

export const LEGAL_VERSION = "2026-07-31.2";
export const LEGAL_LAST_UPDATED = "31/07/2026";

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
      "O Worko é uma plataforma digital de aproximação entre Clientes que solicitam serviços locais e Prestadores(as) independentes que desejam receber pedidos, divulgar sua atuação, conversar pelo chat, gerenciar carteira, acessar SAC e usar recursos de verificação.",
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
      "O Worko é destinado exclusivamente a pessoas com 18 anos ou mais. O(a) usuário(a) deve fornecer dados verdadeiros, atualizados, completos e de sua titularidade, incluindo nome, e-mail, telefone, data de nascimento, endereço e, quando aplicável ao tipo de conta, CPF, foto de rosto, documento de identidade, profissão, disponibilidade e chave Pix.",
      "Cada conta deve corresponder a uma pessoa real. Contas falsas, automatizadas, duplicadas, compartilhadas ou mantidas em nome de terceiro podem ser bloqueadas, limitadas ou encerradas.",
    ],
    bullets: [
      "O(a) usuário(a) é responsável por manter senha, códigos de verificação, dispositivo e canal de acesso em sigilo.",
      "A criação da conta exige a confirmação do e-mail. A recuperação de senha usa um token enviado ao e-mail cadastrado e invalida as sessões anteriores após a troca.",
      "O acesso em um aparelho ainda não reconhecido exige um token enviado por e-mail. O titular também pode receber um alerta de segurança com orientação para redefinir a senha caso não reconheça a tentativa.",
      "A opção de manter login ativo pode armazenar a sessão no próprio dispositivo até logout manual, expiração, risco de segurança ou revogação interna.",
      "O Worko pode exigir nova autenticação, confirmação por e-mail, verificação de CPF, autorização de dispositivo ou outras medidas quando houver suspeita de fraude, conflito cadastral ou exigência legal.",
    ],
  },
  {
    id: "termos-verificação",
    title: "3. Verificação de conta, CPF, chave Pix e selos",
    paragraphs: [
      "Todo cadastro de Prestador(a) passa por análise administrativa antes da liberação integral do app. O prazo informado é de até 1 dia útil após o envio completo de CPF, foto do rosto, imagem do RG, telefone, e-mail, data de nascimento e demais dados solicitados.",
      "Durante a análise, os recursos profissionais permanecem limitados. A administração pode aprovar o cadastro, solicitar novo envio de documentos legíveis ou recusar a verificação; o resultado e eventuais instruções são enviados ao e-mail cadastrado.",
      "Os selos e status de verificação do Worko indicam apenas que a plataforma concluiu as checagens disponíveis naquele momento, como verificação de e-mail, análise da foto de rosto e do RG, confirmação de CPF e compatibilidade operacional da chave Pix cadastrada para saque.",
      "Esses selos não representam garantia absoluta de identidade, idoneidade, capacidade técnica, regularidade fiscal, licença profissional, antecedentes, pontualidade, resultado do serviço ou ausência de risco.",
    ],
    bullets: [
      "O(a) Prestador(a) deve reenviar os documentos quando solicitado. Imagens ilegíveis, cortadas, alteradas, divergentes ou pertencentes a terceiros podem levar à recusa ou suspensão.",
      "Divergências entre nome, CPF, data de nascimento, chave Pix ou outros dados podem impedir verificações, liberar menos recursos ou bloquear funcionalidades.",
      "O(a) usuário(a) autoriza as validações cadastrais e antifraude estritamente necessárias para conta, pagamentos, carteira, suporte e segurança da plataforma.",
      "Currículo, descrições, fotos, profissões, habilidades, disponibilidade e qualquer informação publicada no perfil são de responsabilidade do(a) próprio(a) usuário(a).",
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
      "O endereço exato do atendimento pode permanecer mascarado até a confirmação do fluxo de contratação e pagamento, conforme as regras de segurança do app.",
      "Ferramentas, equipamentos, deslocamento, rota, pontualidade e custos de trajeto são de responsabilidade do(a) Prestador(a). O Cliente não será cobrado pelo deslocamento além dos valores claramente exibidos e aceitos no app.",
    ],
  },
  {
    id: "termos-conteúdo",
    title: "6. Pedidos, divulgações, chat, SAC e conduta",
    paragraphs: [
      "O(a) usuário(a) é exclusivamente responsável por tudo o que publica, solicita, divulga, negocia, envia, armazena ou compartilha em pedidos, divulgações, perfil, chat, imagens, comprovantes, avaliações, SAC e demais áreas do aplicativo.",
      "O Worko pode aplicar filtros, registros operacionais, revisão de segurança e moderação para prevenir fraude, golpe, fuga de pagamento, assédio, spam, conteúdo proibido, abuso de plataforma e risco a usuários(as).",
    ],
    bullets: [
      "É proibido publicar conteúdo ilegal, enganoso, ofensivo, discriminatório, sexualmente explícito, violento, fraudulento, invasivo, com malware ou que viole direitos de terceiros.",
      "É proibido usar o app para golpes, lavagem de dinheiro, falsidade ideológica, assédio, phishing, spam, pirâmide, cobrança indevida ou qualquer atividade ilícita.",
      "É proibido enviar telefone, e-mail, redes sociais, links, chaves de contato ou sequências numéricas camufladas com o objetivo de tirar a negociação, o suporte ou o pagamento para fora do Worko.",
      "Clientes podem fotografar pelo próprio chat o estado atual do serviço. O chat não permite escolher imagens antigas da galeria, e as fotos capturadas também podem ser monitoradas para segurança, moderação e análise de disputas.",
      "O chat de um atendimento pago é bloqueado quando o serviço é encerrado e permanece em Arquivadas somente como histórico. Uma nova necessidade exige um novo atendimento e um novo chat; a conversa antiga não pode ser reaberta.",
      "O SAC online segue fila de atendimento por ordem de chegada, pode exibir a quantidade de pessoas à frente e pode ser encerrado pelo(a) próprio(a) usuário(a) ou pelo atendimento quando o caso for concluído.",
      "O Worko pode remover publicações, ocultar conteúdo, limitar mensagens, congelar funcionalidades, encerrar tickets e suspender contas quando identificar descumprimento destes termos, risco, fraude ou ordem legal.",
    ],
  },
  {
    id: "termos-relação",
    title: "7. Serviços, pagamentos internos, carteira e comprovantes",
    paragraphs: [
      "O valor final de um serviço deve ser de, no mínimo, R$ 50,00. Antes do pagamento, as partes devem conferir escopo, valor, data, horário e tolerância de atraso registrados no atendimento. Datas passadas não podem ser escolhidas.",
      "Orçamento, visita técnica, prazo, execução, qualidade, garantia, nota fiscal, tributos, regularidade profissional e cumprimento do combinado são assumidos diretamente pelos(as) usuários(as) envolvidos(as), sem afastar as obrigações próprias do Worko como plataforma e intermediador quando aplicáveis.",
      "Quando o pagamento é realizado dentro do Worko, a operação usa infraestrutura terceirizada do Asaas para gerar cobrança Pix, QR Code, código Pix para copiar e colar, conciliar o status, emitir notificações e processar estornos ou transferências.",
      "No fluxo atual da plataforma, o total exibido ao Cliente inclui taxa de serviço Worko de 10% sobre o valor do atendimento e taxa de intermediação Worko de R$ 2,99. O resumo com serviço, taxas e total deve ser exibido antes da confirmação do Pix.",
      "Valores liberados para o(a) profissional podem passar primeiro pela carteira do app e depender de confirmação do atendimento, status do provedor, regras antifraude, histórico do pedido, validação de conta e disponibilidade operacional do parceiro de pagamento.",
    ],
    bullets: [
      "Cada pedido deve gerar uma única cobrança válida. Se o(a) usuário(a) identificar duplicidade, valor incorreto ou cobrança não reconhecida, não deve pagar novamente e deve acionar imediatamente o SAC para cancelamento ou estorno.",
      "O comprovante ou recibo gerado em PDF, tela ou e-mail serve para registrar a transação e não substitui garantia técnica do serviço nem prova isolada de adimplemento integral de todas as obrigações entre as partes.",
      "O Worko pode recusar, cancelar, atualizar ou reprocessar cobranças internas quando houver divergência de valor, falha do provedor, fraude, contestação, duplicidade, indisponibilidade técnica ou descumprimento das regras do app.",
      "Após o pagamento, o valor do atendimento permanece protegido e não é liberado ao(à) Prestador(a) até a conclusão confirmada pelo Cliente ou a resolução de eventual disputa.",
      "Direitos obrigatórios do consumidor, inclusive informação clara, correção de erros, atendimento facilitado, cumprimento da oferta e direito de arrependimento quando legalmente aplicável, permanecem preservados.",
      "A disponibilidade de métodos de pagamento, cobrança, estorno, liberação e conciliação pode variar por versão do produto, integração ativa e regras do provedor terceirizado.",
    ],
  },
  {
    id: "termos-ressarcimento",
    title: "8. Ausência do prestador, disputas e ressarcimento",
    paragraphs: [
      "Se o(a) Prestador(a) não comparecer ao local até o fim do horário e da tolerância combinados, o Cliente pode solicitar ressarcimento pelo atendimento pago. O pagamento permanece bloqueado enquanto o caso estiver aberto.",
      "O(a) Prestador(a) recebe a solicitação e tem até 12 horas para reconhecer a ausência ou contestar, apresentando sua explicação. O Worko pode consultar o histórico do pedido, registros de chegada, mensagens, horários e evidências enviadas pelas partes.",
    ],
    bullets: [
      "Se o(a) Prestador(a) reconhecer a ausência, ou não responder no prazo sem existir registro de chegada, o sistema pode aprovar automaticamente o ressarcimento integral.",
      "Se houver contestação ou elemento conflitante, a administração analisa o caso e pode pedir informações adicionais antes de decidir.",
      "Confirmada a ausência, o Cliente recebe o valor integral efetivamente pago, incluindo o valor do serviço e todas as taxas Worko. Nenhuma taxa da plataforma é retida nesse ressarcimento.",
      "O prazo para o dinheiro aparecer na conta do Cliente depende do processamento do estorno Pix pelo Asaas e pela instituição financeira recebedora.",
      "Solicitações falsas, evidências manipuladas ou uso abusivo do mecanismo de disputa podem resultar em recusa, suspensão ou banimento, sem prejuízo das medidas legais cabíveis.",
    ],
  },
  {
    id: "termos-saques",
    title: "9. Saques Pix, saldo e liberação de valores",
    paragraphs: [
      "Saques dependem de conta autenticada, CPF validado quando exigido, chave Pix compatível com as regras operacionais do app e saldo efetivamente disponível na infraestrutura de pagamento utilizada pelo Worko.",
      "No fluxo atual, o app pode oferecer recebimento imediato com taxa de R$ 1,99 e opção de recebimento sem taxa 24 horas depois que o valor cair na carteira do(a) usuário(a). As condições, custos e prazos informados na carteira podem mudar conforme a integração disponível e devem ser conferidos no momento do saque.",
    ],
    bullets: [
      "O saldo exibido pode depender de sincronização com o provedor de pagamento e de atualização do status interno da carteira.",
      "Saques falhos, cancelados, em análise ou em processamento bancário podem ficar temporariamente indisponíveis até nova conciliação.",
      "Obrigações fiscais, declaratórias, previdenciárias e contábeis decorrentes dos valores recebidos são de responsabilidade do(a) usuário(a) beneficiário(a).",
    ],
  },
  {
    id: "termos-segurança",
    title: "10. Segurança e encontros presenciais",
    paragraphs: [
      "Encontros presenciais, visitas a domicílio, acesso a imóveis, compartilhamento de documentos, entrega de bens, uso de ferramentas e transferência de valores envolvem risco inerente e devem ser conduzidos com cautela pelas partes.",
    ],
    bullets: [
      "Não compartilhe senha, código, token, dados bancários sensíveis ou documentos além do necessário sem confirmar a identidade da outra parte.",
      "Prefira validar endereço, horário, escopo, valor, forma de acesso e detalhes do atendimento antes do deslocamento.",
      "Em caso de emergência, ameaça, acidente ou crime, acione imediatamente os serviços públicos competentes. O Worko não substitui atendimento emergencial.",
    ],
  },
  {
    id: "termos-licença",
    title: "11. Propriedade intelectual e licença de uso",
    paragraphs: [
      "O aplicativo, a marca Worko, sua identidade visual, código, banco de dados, textos de sistema, estrutura de navegação e demais ativos da plataforma pertencem ao Worko ou a seus licenciantes e são protegidos pela legislação aplicável.",
      "Ao publicar conteúdo no aplicativo, o(a) usuário(a) concede ao Worko licença não exclusiva, gratuita, revogável e limitada ao funcionamento, armazenamento, exibição, moderação, distribuição interna, segurança e melhoria do serviço, respeitados os limites legais.",
    ],
  },
  {
    id: "termos-suspensao",
    title: "12. Suspensão, encerramento e exclusão de conta",
    paragraphs: [
      "O Worko pode restringir, suspender, congelar carteira, revogar verificações, encerrar tickets, remover conteúdos ou cancelar contas quando identificar descumprimento destes termos, risco de dano, fraude, ordem legal, abuso da plataforma, inatividade relevante ou necessidade operacional.",
      "Antes de excluir a conta, o(a) usuário(a) deve concluir atendimentos, disputas, pagamentos e saques pendentes. A exclusão encerra sessões e remove ou anonimiza os dados que não precisem ser preservados por obrigação legal, segurança, prevenção a fraude, pagamentos, disputas, auditoria ou exercício regular de direitos.",
      "O e-mail vinculado a uma conta excluída pelo(a) usuário(a), suspensa ou banida permanece em lista permanente de bloqueio e não poderá ser reutilizado para criar outra conta Worko. Essa consequência é informada novamente antes da confirmação da exclusão.",
      "Funcionalidades do app podem ser alteradas, expandidas, descontinuadas ou condicionadas a verificações adicionais a qualquer momento, inclusive em fase beta, com comunicação adequada quando exigida pela legislação aplicável.",
    ],
  },
  {
    id: "termos-responsabilidade",
    title: "13. Responsabilidades e indisponibilidade",
    paragraphs: [
      "O Worko não controla a execução material do serviço nem responde automaticamente por atos, omissões, informações, condutas, deslocamentos, acidentes ou inadimplementos imputáveis exclusivamente a usuários(as) ou terceiros. A plataforma responde pelas obrigações que a legislação lhe atribuir e por falhas comprovadamente relacionadas aos serviços que ela própria fornece.",
      "Mapa, notificações, e-mail, Pix, carteira, saques e outros recursos dependem de internet, sistema operacional e provedores terceiros e podem sofrer atraso ou indisponibilidade temporária. O Worko adotará medidas razoáveis para restabelecer o serviço e corrigir registros afetados.",
      "Nada nestes termos exclui responsabilidade que não possa ser afastada pela legislação brasileira, nem limita direitos do consumidor quando houver relação de consumo sujeita à proteção legal específica.",
    ],
  },
  {
    id: "termos-foro",
    title: "14. Comunicações, alterações, lei aplicável e foro",
    paragraphs: [
      "Comunicações operacionais, de segurança, verificação, pagamento, disputa, suporte e alterações relevantes podem ser enviadas no app, por notificação push ou pelo e-mail cadastrado. O(a) usuário(a) deve manter seus canais atualizados.",
      "Quando uma alteração material exigir novo aceite, o Worko apresentará a versão atualizada antes da continuidade no recurso correspondente. A versão e a data exibidas neste documento identificam o texto vigente.",
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
      "O Worko pode tratar dados cadastrais e de identificação, dados de perfil e verificação documental, informações de pedidos e divulgações, mensagens de chat e SAC, imagens e evidências enviadas pelo(a) usuário(a), dados de pagamento e saque, além de metadados técnicos necessários ao funcionamento e à segurança do app.",
    ],
    bullets: [
      "Dados cadastrais: nome, e-mail, telefone, data de nascimento, endereço, CPF, avatar e identificadores internos da conta.",
      "Dados de perfil: foto de rosto, biografia, profissão, habilidades, disponibilidade, chave Pix e demais dados que o(a) próprio(a) usuário(a) publicar ou editar.",
      "Dados de uso e relacionamento: pedidos no mapa, divulgações, chats, imagens capturadas no atendimento, avaliações, histórico e eventos do serviço, solicitações de ressarcimento, justificativas, evidências, tickets do SAC e mensagens trocadas com o suporte.",
      "Dados de pagamento e carteira: valor do serviço, taxas, identificadores e status da cobrança Asaas, QR Code Pix, código Pix para copiar e colar, recibos, comprovantes em PDF, estornos, saldo, histórico de saque e status de conciliação. O Worko não solicita senha bancária do usuário.",
      "Dados de verificação e antifraude: confirmação de e-mail, CPF, número e imagem do RG, foto de rosto enviada para análise, data e resultado da decisão administrativa, pedidos de reenvio, compatibilidade da chave Pix, registros de autenticação, aparelhos reconhecidos, sessões ativas e sinais de risco operacional.",
      "Dados técnicos: data e hora de uso, endereço IP quando registrado pela infraestrutura, identificadores de sessão e aparelho, versão do app, plataforma, token de notificação push, rótulos de dispositivo, preferências locais, registros de erro do cliente e metadados de acesso associados à segurança da aplicação.",
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
      "Executar verificações de e-mail, novo aparelho, identidade de prestadores, CPF, documentos, chave Pix e segurança de sessão; analisar, aprovar, recusar ou solicitar novamente documentos de Prestadores(as).",
      "Exibir mapa, proximidade, área atendida e conteúdo geográfico do app.",
      "Permitir divulgações, pedidos, conversas, envio de imagens por clientes, histórico de atendimento e avaliações.",
      "Gerar, conciliar e registrar pagamentos, comprovantes, carteira interna, saques Pix, disputas e ressarcimentos integrais.",
      "Atender tickets do SAC, organizar fila de suporte, responder demandas e registrar histórico do atendimento.",
      "Enviar e-mails e notificações internas ou externas sobre segurança, novo aparelho, verificação cadastral, mensagens, pedidos, pagamentos, disputas, ressarcimentos, carteira, saque, suporte e alterações relevantes.",
      "Investigar fraude, abuso, violação dos termos, falhas técnicas, erros de cliente e incidentes de segurança.",
      "Cumprir exigências legais, regulatórias, judiciais e de cooperação com autoridades competentes.",
    ],
  },
  {
    id: "privacidade-bases",
    title: "4. Bases legais utilizadas",
    paragraphs: [
      "O Worko trata dados pessoais, conforme o caso concreto, com fundamento na execução destes Termos e de procedimentos preliminares relacionados ao uso da plataforma, no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos, na proteção da vida ou da segurança física, na prevenção a fraude e segurança dos processos de identificação, no legítimo interesse sujeito a avaliação de necessidade e impacto e, quando necessário, no consentimento.",
      "Quando a funcionalidade depender de permissão do aparelho, como geolocalização em tempo real, notificações push, câmera ou acesso seletivo à galeria de fotos, o(a) usuário(a) pode negar ou revogar a permissão, ciente de que algumas funções podem ficar limitadas.",
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
      "Asaas e prestadores correlatos de cobrança, conciliação, Pix, comprovantes, estornos e transferências, na medida necessária ao fluxo de pagamento e saque.",
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
      "Quando autorizado pelo sistema, notificações externas usam o canal e o toque padrão de notificações do aparelho. Som, vibração e exibição final também dependem das configurações do dispositivo.",
      "A permissão de localização é usada para mapa, proximidade, busca territorial, posição atual e recursos relacionados a pedidos e divulgações.",
      "A permissão de fotos é usada para escolher a foto de perfil e, no cadastro de prestadores, anexar a foto de rosto e a imagem do RG para análise. No chat, clientes podem enviar apenas uma nova foto capturada pela câmera naquele momento; a galeria não é oferecida para esse envio.",
      "A permissão de câmera pode ser solicitada para capturar documentos de verificação ou uma imagem no chat. O Worko recebe apenas a foto confirmada pelo(a) usuário(a), conforme as permissões do sistema.",
      "A revogação de permissão pode impedir parte da experiência, mas não afeta necessariamente o cadastro básico do(a) usuário(a).",
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
      "Para cumprir a regra de conta única e impedir novo cadastro após exclusão, suspensão ou banimento, o e-mail normalizado permanece em uma lista permanente de bloqueio destinada exclusivamente à segurança, prevenção a fraude e controle de reincidência.",
      "Documentos de verificação e imagens de identidade têm acesso restrito e devem ser eliminados ou anonimizados quando deixarem de ser necessários, ressalvada a conservação permitida ou exigida pela legislação para prevenção a fraude, apuração de incidentes e exercício regular de direitos.",
    ],
  },
  {
    id: "privacidade-direitos",
    title: "8. Direitos do titular",
    paragraphs: [
      "Nos termos da LGPD e quando aplicável, o titular pode solicitar confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamento e sobre a possibilidade de não fornecer consentimento, revogação do consentimento, oposição e revisão de decisões tomadas unicamente com base em tratamento automatizado, observados os limites legais, técnicos e de segredo empresarial.",
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
      "O Worko não permite cadastro de pessoas com menos de 18 anos. Se a plataforma identificar uma conta de menor, poderá limitar o acesso, solicitar validação e eliminar ou preservar os dados conforme a proteção do titular e as obrigações legais aplicáveis.",
    ],
  },
  {
    id: "privacidade-atualizacoes",
    title: "11. Atualizações deste documento",
    paragraphs: [
      "Este documento pode ser atualizado para refletir mudanças legais, regulatórias, operacionais, de segurança ou de produto. A versão vigente será publicada dentro do aplicativo e na página pública oficial do Worko.",
      `Mudanças relevantes podem ser comunicadas no próprio app, e o uso continuado da plataforma após a disponibilização de nova versão deve ser interpretado em conjunto com as regras de aceite e renovação de consentimentos aplicáveis a cada funcionalidade.`,
    ],
  },
];

