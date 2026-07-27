import type { PinType } from "../types";

export type AcceptedServiceCatalogEntry = {
  label: string;
  summary: string;
  examples: string[];
};

export const ACCEPTED_SERVICE_CATALOG_ORDER: PinType[] = ["Conserto", "Limpeza", "Freelas"];

export const ACCEPTED_SERVICES_NOTICE =
  "O Worko aceita apenas serviços leves, técnicos e de apoio, com execução local e baixo risco operacional.";

export const RESTRICTED_SERVICES_NOTICE =
  "Não publique obras brutas ou de alto risco, como demolição, terraplanagem, carga pesada, manutenção industrial, podas em altura, remoções complexas ou atividades que exijam equipe pesada.";

export const acceptedServiceCatalog: Record<PinType, AcceptedServiceCatalogEntry> = {
  Conserto: {
    label: "Conserto, instalação e suporte técnico",
    summary:
      "Categoria voltada a reparos leves, instalações residenciais simples, manutenção técnica e apoio em equipamentos.",
    examples: [
      "Montagem de móveis",
      "Desmontagem de móveis",
      "Instalação de prateleiras leves",
      "Instalação de suporte de TV",
      "Troca de tomadas e interruptores",
      "Instalação de luminárias",
      "Reparo de fiação leve",
      "Troca de torneira ou sifão",
      "Formatação de computador",
      "Upgrade de SSD ou memória",
      "Configuração de impressora",
      "Configuração de roteador e smart TV",
    ],
  },
  Limpeza: {
    label: "Limpeza leve, higienização e organização",
    summary:
      "Categoria para limpeza residencial ou comercial leve, higienização de itens e organização de ambientes.",
    examples: [
      "Limpeza básica de apartamento",
      "Limpeza de cozinha e banheiro",
      "Limpeza de vidros e espelhos",
      "Limpeza de sofá e estofados",
      "Limpeza de colchão e tapete",
      "Higienização de geladeira",
      "Limpeza pré ou pós-mudança leve",
      "Limpeza de escritório",
      "Organização de cozinha e closet",
      "Organização de home office",
      "Passadoria de roupas",
      "Limpeza de varanda e área gourmet",
    ],
  },
  Freelas: {
    label: "Apoio leve, tecnologia e organização",
    summary:
      "Categoria para suporte local de baixa complexidade, organização, configuração de dispositivos e apoio prático ao dia a dia.",
    examples: [
      "Configuração de celular",
      "Transferência de dados",
      "Instalação de aplicativos",
      "Configuração de WhatsApp e e-mail",
      "Suporte para notebook e periféricos",
      "Configuração de câmera Wi-Fi",
      "Configuração de Alexa e smart devices",
      "Digitalização de documentos",
      "Organização de escritório",
      "Montagem de home office",
      "Aulas básicas de informática",
      "Suporte para idosos com tecnologia",
    ],
  },
};

export const acceptedServiceTermsBullets = [
  "Conserto: montagem e desmontagem de móveis, instalação de prateleiras e suportes, troca de tomadas e interruptores, instalação de luminárias, reparos leves de fiação, troca de torneira e sifão, manutenção técnica de computador, configuração de roteador, impressora e smart TV.",
  "Limpeza: limpeza básica residencial e comercial leve, cozinha e banheiro, vidros, estofados, higienização de geladeira, limpeza pré ou pós-mudança leve, organização de ambientes e passadoria.",
  "Freelas: configuração de celular, transferência de dados, instalação de aplicativos, suporte a notebook e smart devices, digitalização de documentos, organização de home office e apoio tecnológico leve.",
];
