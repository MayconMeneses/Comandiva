// Script de importação do cardápio real do Comandiva (Croatá/CE).
// Lê os dados abaixo (extraídos das fotos do cardápio enviadas) e cadastra
// categorias, produtos, grupos de complemento (tamanhos/porções/adicionais)
// e promoções vinculadas. É seguro rodar mais de uma vez: itens que já
// existem (mesmo nome) são pulados, não duplicados. Categorias que existiam
// com um nome antigo (ex.: "Pizzas Tradicionais") são renomeadas para o nome
// e a ordem atuais (ex.: "Pizza Tradicional"), sem duplicar nem perder produtos.
//
// Como rodar (com os containers no ar):
//   docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/seed-cardapio-mm.ts

import { eq, and, inArray } from "drizzle-orm";
import { addonGroups, addonOptions, categories, products, promotions, restaurantSettings } from "../drizzle/schema";
import { getDb } from "../server/db";

const now = Date.now();

type AddonOptionInput = [name: string, deltaReais: number];
type AddonGroupInput = { name: string; required: boolean; min: number; max: number; options: AddonOptionInput[] };
type ProductInput = {
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  available?: boolean;
  featured?: boolean;
  onPromotion?: boolean;
  addonGroups?: AddonGroupInput[];
};
type CategoryInput = { key: string; name: string; description?: string; sortOrder: number; aliases?: string[]; products: ProductInput[] };
type PromotionInput = {
  title: string;
  description: string;
  badge: string;
  priceLabel: string;
  validDays: string;
  imageUrl: string;
  linkTo: string | null;
};

const DATA: { categories: CategoryInput[]; promotions: PromotionInput[] } = {
  "categories": [
    {
      "key": "hamb_trad",
      "name": "Hambúrguer Tradicional",
      "description": "Os clássicos do Comandiva, pão + 120g de carne artesanal.",
      "sortOrder": 10,
      "aliases": [
        "Hambúrgueres Tradicionais"
      ],
      "products": [
        {
          "name": "X-Burguer",
          "description": "Pão, carne artesanal 120g e queijo.",
          "priceCents": 1200,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "X-Egg",
          "description": "Pão, carne artesanal 120g, queijo e ovo.",
          "priceCents": 1400,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "X-Bacon",
          "description": "Pão, carne artesanal 120g, queijo e bacon.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "X-Salada",
          "description": "Pão, carne artesanal 120g, queijo e salada.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "X-Tudo",
          "description": "Pão, carne artesanal 120g, queijo, ovo, calabresa, bacon e salada.",
          "priceCents": 2000,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "hamb_esp",
      "name": "Hambúrguer Artesanal (Especial)",
      "description": "Criações autorais da casa, pão + 120g de carne artesanal.",
      "sortOrder": 20,
      "aliases": [
        "Hambúrgueres Especiais"
      ],
      "products": [
        {
          "name": "Vamos Fugir",
          "description": "Pão, 120g de carne artesanal, cheddar, cebola caramelizada e bacon.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Uma Brasileira",
          "description": "Pão, 120g de carne artesanal, mussarela, alface crocante, tomate, cebola roxa e bacon.",
          "priceCents": 1600,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Natasha",
          "description": "Pão, 120g de carne artesanal, queijo coalho, cebola crispy e geleia de pimenta da casa.",
          "priceCents": 1600,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Romance Ideal",
          "description": "Pão, 120g de carne artesanal, queijo coalho, abacaxi caramelizado e bacon.",
          "priceCents": 1600,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Homem Primata",
          "description": "Pão, 120g de carne artesanal, mussarela, manjericão, tomate confit e bacon.",
          "priceCents": 1600,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Súplica Cearense",
          "description": "Pão, 120g de carne artesanal, alface crocante, queijo coalho, raspa de rapadura e bacon.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Double Bacon",
          "description": "Pão, 2 hambúrgueres de 120g de carne artesanal, cheddar, bacon, maionese e tomate.",
          "priceCents": 2200,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Vento Ventania",
          "description": "Pão, 120g de carne artesanal, queijo coalho, alface crocante e tomate.",
          "priceCents": 1400,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Piano Bar",
          "description": "Pão, 120g de carne artesanal, queijo coalho, calabresa e alface crocante.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Puro Êxtase",
          "description": "Pão, 120g de carne artesanal, queijo coalho, ovo, tomate, alface crocante e cebola roxa.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Como Eu Quero",
          "description": "Pão, 120g de carne artesanal, cheddar e cebola caramelizada.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Adicionais",
              "required": false,
              "min": 0,
              "max": 6,
              "options": [
                [
                  "Fritas",
                  3
                ],
                [
                  "Queijo coalho ou mussarela",
                  4
                ],
                [
                  "Calabresa",
                  4
                ],
                [
                  "Bacon",
                  5
                ],
                [
                  "Cheddar",
                  4
                ],
                [
                  "Cebola crispy ou caramelizada",
                  3
                ],
                [
                  "Ovo",
                  2
                ],
                [
                  "Geleia de pimenta",
                  4
                ],
                [
                  "120g de carne artesanal",
                  8
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "petiscos",
      "name": "Petiscos",
      "description": "Escolha meia porção ou porção inteira.",
      "sortOrder": 80,
      "aliases": [],
      "products": [
        {
          "name": "Batata Simples",
          "description": "Porção de batata frita simples.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  5.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Batata Cheddar e Bacon",
          "description": "Batata frita coberta com cheddar e bacon.",
          "priceCents": 1800,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  8.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Calabresa Acebolada",
          "description": "Calabresa fatiada na chapa com cebola.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  5.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Calabresa com Fritas",
          "description": "Calabresa fatiada acompanhada de batata frita.",
          "priceCents": 1800,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  7.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Contra Filé",
          "description": "Tiras de contra filé grelhadas.",
          "priceCents": 2500,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  15.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Contra Filé com Fritas",
          "description": "Tiras de contra filé grelhadas com batata frita.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  15.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Frango a Passarinho",
          "description": "Frango frito temperado, estilo passarinho.",
          "priceCents": 1800,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  7.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Gurjão de Frango",
          "description": "Iscas de frango empanadas.",
          "priceCents": 1800,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  7.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Gurjão de Peixe",
          "description": "Iscas de peixe empanadas.",
          "priceCents": 1800,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  10.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Camarão Alho e Óleo",
          "description": "Camarões salteados no alho e óleo.",
          "priceCents": 2500,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  15.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Picanha na Chapa",
          "description": "Picanha fatiada e grelhada na chapa.",
          "priceCents": 4500,
          "addonGroups": [
            {
              "name": "Porção",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meia porção",
                  0
                ],
                [
                  "Porção inteira",
                  35.0
                ]
              ]
            }
          ]
        },
        {
          "name": "Pastéis (Queijo, Calabresa, Frango c/ Catupiry, Misto, Pizza ou Carne Moída)",
          "description": "Pastel frito na hora.",
          "priceCents": 300,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  3
                ]
              ]
            },
            {
              "name": "Sabor",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Queijo",
                  0
                ],
                [
                  "Calabresa",
                  0
                ],
                [
                  "Frango c/ catupiry",
                  0
                ],
                [
                  "Misto",
                  0
                ],
                [
                  "Pizza",
                  0
                ],
                [
                  "Carne moída",
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Pastel de Carne Seca",
          "description": "Pastel frito na hora.",
          "priceCents": 500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  5
                ]
              ]
            }
          ]
        },
        {
          "name": "Pastel de Camarão",
          "description": "Pastel frito na hora.",
          "priceCents": 600,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  6
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "espetinhos",
      "name": "Espetinhos",
      "description": "Espetinhos grelhados na brasa.",
      "sortOrder": 60,
      "aliases": [],
      "products": [
        {
          "name": "Espetinho de Alcatra",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 900
        },
        {
          "name": "Espetinho de Filé de Frango",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 700
        },
        {
          "name": "Espetinho de Paleta Suína",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 700
        },
        {
          "name": "Espetinho de Calabresa",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 700
        },
        {
          "name": "Espetinho de Linguiça Dália",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 800
        },
        {
          "name": "Espetinho de Coração",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 800
        },
        {
          "name": "Espetinho de Tulipa",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 800
        },
        {
          "name": "Espetinho de Medalhão de Frango",
          "description": "Espetinho grelhado na brasa.",
          "priceCents": 0,
          "available": false
        }
      ]
    },
    {
      "key": "guarnicoes",
      "name": "Guarnições",
      "description": "Acompanhamentos, peça no tamanho pequeno ou grande.",
      "sortOrder": 90,
      "aliases": [],
      "products": [
        {
          "name": "Salada",
          "description": "",
          "priceCents": 300,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  3
                ]
              ]
            }
          ]
        },
        {
          "name": "Feijão",
          "description": "",
          "priceCents": 500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  5
                ]
              ]
            }
          ]
        },
        {
          "name": "Arroz",
          "description": "",
          "priceCents": 500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  5
                ]
              ]
            }
          ]
        },
        {
          "name": "Arroz à Grega",
          "description": "",
          "priceCents": 800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Arroz com Brócolis",
          "description": "",
          "priceCents": 800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Arroz à Piemontese",
          "description": "",
          "priceCents": 800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Baião sem Nata",
          "description": "",
          "priceCents": 600,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  6
                ]
              ]
            }
          ]
        },
        {
          "name": "Baião com Nata",
          "description": "",
          "priceCents": 800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  8
                ]
              ]
            }
          ]
        },
        {
          "name": "Legumes Cozidos",
          "description": "Batata inglesa, brócolis e cenoura.",
          "priceCents": 700,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Pequeno",
                  0
                ],
                [
                  "Grande",
                  3
                ]
              ]
            }
          ]
        },
        {
          "name": "Prato Feito",
          "description": "Arroz e batata.",
          "priceCents": 800
        },
        {
          "name": "Ovo",
          "description": "Unidade.",
          "priceCents": 200
        },
        {
          "name": "Batata",
          "description": "Porção de batata.",
          "priceCents": 500
        }
      ]
    },
    {
      "key": "caldos",
      "name": "Caldos",
      "description": "Peça no copo ou na tigela.",
      "sortOrder": 100,
      "aliases": [],
      "products": [
        {
          "name": "Caldo de Carne",
          "description": "",
          "priceCents": 300,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Copo 180ml",
                  0
                ],
                [
                  "Tigela 400ml",
                  5
                ]
              ]
            }
          ]
        },
        {
          "name": "Caldo de Mocotó",
          "description": "",
          "priceCents": 300,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Copo 180ml",
                  0
                ],
                [
                  "Tigela 400ml",
                  5
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "refeicoes",
      "name": "Refeições",
      "description": "Pratos individuais, servidos com arroz, feijão, fritas, salada e farofa (salvo indicação em contrário).",
      "sortOrder": 70,
      "aliases": [],
      "products": [
        {
          "name": "Bisteca",
          "description": "",
          "priceCents": 1800
        },
        {
          "name": "Bife a Cavalo",
          "description": "",
          "priceCents": 2800
        },
        {
          "name": "Calabresa",
          "description": "",
          "priceCents": 1800
        },
        {
          "name": "Contra Filé",
          "description": "",
          "priceCents": 2500
        },
        {
          "name": "Fígado",
          "description": "",
          "priceCents": 1800
        },
        {
          "name": "Filé de Frango Grelhado",
          "description": "",
          "priceCents": 1800
        },
        {
          "name": "Filé de Peixe Grelhado",
          "description": "",
          "priceCents": 2200
        },
        {
          "name": "Filé de Frango à Milanesa",
          "description": "",
          "priceCents": 2000
        },
        {
          "name": "Filé de Peixe à Milanesa",
          "description": "",
          "priceCents": 2400
        },
        {
          "name": "Linguiça Dália",
          "description": "",
          "priceCents": 1800
        },
        {
          "name": "Picanha",
          "description": "",
          "priceCents": 4500
        },
        {
          "name": "Salmão",
          "description": "Acompanha arroz com brócolis e legumes cozidos.",
          "priceCents": 4000
        },
        {
          "name": "Filé de Frango Grelhado à Moda da Casa",
          "description": "Acompanha arroz com brócolis e legumes cozidos.",
          "priceCents": 2000,
          "imageUrl": "/assets/pubx/file-frango-moda-casa.jpg"
        },
        {
          "name": "Bife ao Molho Madeira",
          "description": "Acompanha arroz à piemontese, batata frita e salada.",
          "priceCents": 2799,
          "imageUrl": "/assets/pubx/hero-bife-molho-madeira.jpg",
          "featured": true,
          "onPromotion": true
        },
        {
          "name": "Tilápia na Brasa (Individual)",
          "description": "Meia tilápia na brasa + baião + batata frita.",
          "priceCents": 2799,
          "imageUrl": "/assets/pubx/promo-tilapia-individual.jpg",
          "featured": true,
          "onPromotion": true
        }
      ]
    },
    {
      "key": "parmegianas",
      "name": "Parmegianas e Galeto",
      "description": "As parmegianas acompanham arroz, feijão, fritas, salada e farofa.",
      "sortOrder": 110,
      "aliases": [],
      "products": [
        {
          "name": "Parmegiana de Frango",
          "description": "",
          "priceCents": 2500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Individual (PF)",
                  0
                ],
                [
                  "Serve 2-3 pessoas (F)",
                  30
                ]
              ]
            }
          ]
        },
        {
          "name": "Parmegiana de Carne",
          "description": "",
          "priceCents": 2800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Individual (PF)",
                  0
                ],
                [
                  "Serve 2-3 pessoas (F)",
                  37
                ]
              ]
            }
          ]
        },
        {
          "name": "Parmegiana de Peixe",
          "description": "",
          "priceCents": 2800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Individual (PF)",
                  0
                ],
                [
                  "Serve 2-3 pessoas (F)",
                  32
                ]
              ]
            }
          ]
        },
        {
          "name": "Galeto",
          "description": "Acompanha arroz, vinagrete e farofa.",
          "priceCents": 1500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Meio galeto",
                  0
                ],
                [
                  "Galeto inteiro",
                  10
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "compartilhar",
      "name": "Para 2 a 3 Pessoas",
      "description": "Pratos para compartilhar.",
      "sortOrder": 120,
      "aliases": [],
      "products": [
        {
          "name": "Picanha Comandiva",
          "description": "500g de picanha australiana e queijo. Acompanha fritas, arroz com brócolis, arroz à piemontese ou baião com nata.",
          "priceCents": 11000
        },
        {
          "name": "Espeto Misto 1",
          "description": "200g de picanha, 200g de contra filé e 200g de filé de frango. Acompanha arroz, feijão, fritas, vinagrete e farofa.",
          "priceCents": 11000
        },
        {
          "name": "Espeto Misto 2",
          "description": "200g de contra filé, 200g de filé de frango e 200g de linguiça Dália. Acompanha arroz, feijão, fritas, vinagrete e farofa.",
          "priceCents": 8000
        },
        {
          "name": "Galeto Comandiva",
          "description": "Acompanha arroz e feijão ou baião sem nata, fritas, vinagrete e farofa.",
          "priceCents": 3500
        },
        {
          "name": "Tilápia na Brasa (sem espinha)",
          "description": "Serve de 2 a 3 pessoas. Acompanha baião sem nata, fritas e farofa.",
          "priceCents": 5000,
          "imageUrl": "/assets/pubx/tilapia-brasa.jpg"
        },
        {
          "name": "Tilápia Frita",
          "description": "Serve de 2 a 3 pessoas. Preço a confirmar.",
          "priceCents": 4500,
          "imageUrl": "/assets/pubx/tilapia-frita.jpg",
          "available": false
        }
      ]
    },
    {
      "key": "prato_dia",
      "name": "Prato do Dia",
      "description": "Pratos especiais por dia da semana.",
      "sortOrder": 130,
      "aliases": [],
      "products": [
        {
          "name": "Cupim no Bafo",
          "description": "Domingo. Serve de 2 a 3 pessoas.",
          "priceCents": 8000
        },
        {
          "name": "Costela no Bafo",
          "description": "Domingo. Serve de 2 a 3 pessoas.",
          "priceCents": 8000
        },
        {
          "name": "Galinha Cozida PF",
          "description": "Domingo.",
          "priceCents": 1800
        },
        {
          "name": "Bife a Role",
          "description": "Terça-feira.",
          "priceCents": 2200
        },
        {
          "name": "Strogonoff de Frango",
          "description": "Terça-feira.",
          "priceCents": 2000
        },
        {
          "name": "Coxa sobre Coxa",
          "description": "Quarta-feira.",
          "priceCents": 1800
        },
        {
          "name": "Costela com Mandioca",
          "description": "Quarta-feira.",
          "priceCents": 2200
        },
        {
          "name": "Lasanha à Bolonhesa",
          "description": "Quinta-feira.",
          "priceCents": 2000
        },
        {
          "name": "Picadinho de Boi",
          "description": "Quinta-feira.",
          "priceCents": 2200
        },
        {
          "name": "Peixe à Milanesa (molho de camarão)",
          "description": "Sexta-feira.",
          "priceCents": 2700
        },
        {
          "name": "Rabada",
          "description": "Sexta-feira.",
          "priceCents": 2400
        },
        {
          "name": "Feijoada 1",
          "description": "Sábado.",
          "priceCents": 3500
        },
        {
          "name": "Feijoada 2",
          "description": "Sábado.",
          "priceCents": 6000
        },
        {
          "name": "Strogonoff de Carne",
          "description": "Sábado.",
          "priceCents": 2300
        }
      ]
    },
    {
      "key": "pizzas_trad",
      "name": "Pizza Tradicional",
      "description": "Tamanhos: Médio, Grande e Família.",
      "sortOrder": 30,
      "aliases": [
        "Pizzas Tradicionais"
      ],
      "products": [
        {
          "name": "Marguerita",
          "description": "Molho de tomate, mussarela, manjericão, tomate e orégano.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Mista",
          "description": "Molho de tomate, mussarela, presunto, calabresa e orégano.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Mussarela",
          "description": "Molho de tomate, mussarela especial e azeitonas.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Portuguesa",
          "description": "Molho de tomate, mussarela, presunto, calabresa, cebola, ervilha, ovos e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Toscana",
          "description": "Molho de tomate, mussarela, calabresa, cebola, ovos, alho frito e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "4 Queijos",
          "description": "Molho de tomate, mussarela, provolone, gorgonzola e catupiry.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Atum",
          "description": "Molho de tomate, mussarela, atum, cebola e orégano.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Atum com Catupiry",
          "description": "Molho de tomate, mussarela, atum, cebola, orégano e catupiry.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Bacon",
          "description": "Molho de tomate, mussarela, bacon e cebola.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  10
                ]
              ]
            }
          ]
        },
        {
          "name": "Baiana",
          "description": "Molho de tomate, mussarela, calabresa moída, cebola, ovo cozido e pimenta.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  10
                ]
              ]
            }
          ]
        },
        {
          "name": "Caipira à Moda da Casa",
          "description": "Molho de tomate, mussarela, frango, cebola, milho verde, bacon, catupiry e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Calabresa",
          "description": "Molho de tomate, mussarela, calabresa, cebola e orégano.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Carne Seca",
          "description": "Molho de tomate, mussarela, carne seca, cebola e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Carne Seca com Catupiry",
          "description": "Molho de tomate, mussarela, carne seca, cebola, orégano e catupiry.",
          "priceCents": 3800,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Frango",
          "description": "Molho de tomate, mussarela, frango desfiado e orégano.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Frango com Catupiry",
          "description": "Molho de tomate, mussarela, frango desfiado, catupiry e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "pizzas_esp",
      "name": "Pizza Especial",
      "description": "Tamanhos: Médio, Grande e Família.",
      "sortOrder": 40,
      "aliases": [
        "Pizzas Especiais"
      ],
      "products": [
        {
          "name": "Palmito",
          "description": "Molho de tomate, mussarela, palmito e orégano.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  10
                ]
              ]
            }
          ]
        },
        {
          "name": "Comandiva",
          "description": "Molho de tomate, mussarela, bacon, calabresa, cebola e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  10
                ]
              ]
            }
          ]
        },
        {
          "name": "Peito de Peru",
          "description": "Molho de tomate, mussarela, peito de peru e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Camarão",
          "description": "Molho de tomate, mussarela, camarão e orégano.",
          "priceCents": 3500,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Camarão com Catupiry",
          "description": "Molho de tomate, mussarela, camarão, catupiry e orégano.",
          "priceCents": 4000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  20
                ]
              ]
            }
          ]
        },
        {
          "name": "Comandiva Oriental",
          "description": "Molho de tomate, muçarela, atum, cream cheese, molho tarê e cebolinha. Lançamento — preço a confirmar.",
          "priceCents": 3500,
          "imageUrl": "/assets/pubx/pizza-oriental.jpg",
          "available": false,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "pizzas_doces",
      "name": "Pizza Doce",
      "description": "Tamanhos: Médio, Grande e Família.",
      "sortOrder": 50,
      "aliases": [
        "Pizzas Doces"
      ],
      "products": [
        {
          "name": "Chocolate",
          "description": "Pizza doce.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Chocolate com Morango",
          "description": "Pizza doce.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Chocolate com Banana",
          "description": "Pizza doce.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Prestígio",
          "description": "Pizza doce.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        },
        {
          "name": "Romeu e Julieta",
          "description": "Pizza doce.",
          "priceCents": 3000,
          "addonGroups": [
            {
              "name": "Tamanho",
              "required": true,
              "min": 1,
              "max": 1,
              "options": [
                [
                  "Médio",
                  0
                ],
                [
                  "Grande",
                  5
                ],
                [
                  "Família",
                  15
                ]
              ]
            }
          ]
        }
      ]
    },
    {
      "key": "sobremesas",
      "name": "Sobremesas",
      "description": "",
      "sortOrder": 140,
      "aliases": [],
      "products": [
        {
          "name": "Pudim",
          "description": "Tradicional, doce de leite e Nutella.",
          "priceCents": 1000
        },
        {
          "name": "Brownie",
          "description": "Ninho e Nutella.",
          "priceCents": 1000
        },
        {
          "name": "Torta de Limão",
          "description": "",
          "priceCents": 1000
        }
      ]
    },
    {
      "key": "bebidas",
      "name": "Bebidas",
      "description": "",
      "sortOrder": 150,
      "aliases": [],
      "products": [
        {
          "name": "Cerveja Eisenbahn 600ml",
          "description": "",
          "priceCents": 900
        },
        {
          "name": "Caipirinha ou Caipivodka",
          "description": "Sabores: limão, abacaxi e maracujá.",
          "priceCents": 1000
        },
        {
          "name": "Drink da Casa",
          "description": "Maçã verde, tropical ou Comandiva.",
          "priceCents": 1000
        }
      ]
    },
    {
      "key": "happy_hour",
      "name": "Happy Hour",
      "description": "Terça a sexta, das 17h às 21h. Petiscos somente porção inteira.",
      "sortOrder": 160,
      "aliases": [],
      "products": [
        {
          "name": "Batata (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 1500
        },
        {
          "name": "Batata Cheddar e Bacon (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 2000
        },
        {
          "name": "Calabresa com Fritas (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 2000
        },
        {
          "name": "Contra Filé com Fritas (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 4000
        },
        {
          "name": "Gurjão de Peixe (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 2000
        },
        {
          "name": "Gurjão de Frango (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 2000
        },
        {
          "name": "Frango a Passarinho (Happy Hour)",
          "description": "Porção inteira, preço válido de terça a sexta, das 17h às 21h.",
          "priceCents": 2000
        },
        {
          "name": "Cerveja Eisenbahn 600ml (Happy Hour)",
          "description": "Terça a sexta, das 17h às 21h.",
          "priceCents": 900
        },
        {
          "name": "Caipirinha ou Caipivodka em Dobro (Happy Hour)",
          "description": "Sabores: limão, abacaxi e maracujá. Terça a sexta, das 17h às 21h.",
          "priceCents": 1000
        },
        {
          "name": "Drink da Casa (Happy Hour)",
          "description": "Maçã verde, tropical ou Comandiva. Terça a sexta, das 17h às 21h.",
          "priceCents": 1000
        }
      ]
    }
  ],
  "promotions": [
    {
      "title": "Bife ao Molho Madeira",
      "description": "Arroz à piemontese, bife ao molho madeira, batata frita e salada.",
      "badge": "NOVO",
      "priceLabel": "R$ 27,99",
      "validDays": "Todos os dias, almoço e jantar",
      "imageUrl": "/assets/pubx/promo-bife-molho-madeira.jpg",
      "linkTo": "Bife ao Molho Madeira"
    },
    {
      "title": "Tilápia na Brasa Individual",
      "description": "Meia tilápia na brasa + baião + batata frita.",
      "badge": "PROMOÇÃO",
      "priceLabel": "R$ 27,99",
      "validDays": "Sex, sáb e dom no almoço · todos os dias à noite",
      "imageUrl": "/assets/pubx/promo-tilapia-individual.jpg",
      "linkTo": "Tilápia na Brasa (Individual)"
    },
    {
      "title": "Pizzas Tradicionais Tamanho G",
      "description": "Calabresa, Portuguesa, Mussarela, Frango e Frango c/ Catupiry.",
      "badge": "OFERTA",
      "priceLabel": "R$ 28,99",
      "validDays": "Terça, quarta e quinta · delivery e salão",
      "imageUrl": "/assets/pubx/promo-pizza-tradicional.jpg",
      "linkTo": null
    },
    {
      "title": "Happy Hour do Comandiva",
      "description": "Petiscos porção inteira e bebidas com preço especial.",
      "badge": "HAPPY HOUR",
      "priceLabel": "A partir de R$ 9,00",
      "validDays": "Terça a sexta, das 17h às 21h",
      "imageUrl": "/assets/pubx/promo-happy-hour.jpg",
      "linkTo": null
    }
  ]
};

// Cardápio de demonstração criado automaticamente na primeira instalação
// (scripts/seed.ts). Removemos aqui para não ficar misturado com o cardápio
// real importado abaixo.
const DEMO_DATA: Array<{ categoryName: string; productNames: string[]; deleteCategoryIfEmpty: boolean }> = [
  { categoryName: "Hambúrgueres", productNames: ["PX Bacon", "Bacon da Casa", "Duplo da Casa", "Veggie Brasa"], deleteCategoryIfEmpty: true },
  { categoryName: "Pizzas", productNames: ["Marguerita", "Calabresa Artesanal"], deleteCategoryIfEmpty: true },
  { categoryName: "Porções", productNames: ["Fritas da Casa", "Croquetes de Costela"], deleteCategoryIfEmpty: true },
  { categoryName: "Bebidas", productNames: ["Coca-Cola 350ml", "Guaraná Zero 350ml"], deleteCategoryIfEmpty: false },
  { categoryName: "Sobremesas", productNames: ["Brownie Intenso"], deleteCategoryIfEmpty: false },
];

async function cleanupDemoData() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  console.log("== Limpando cardápio de demonstração ==");
  for (const entry of DEMO_DATA) {
    const [category] = await db.select().from(categories).where(eq(categories.name, entry.categoryName)).limit(1);
    if (!category) continue;
    for (const productName of entry.productNames) {
      const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.categoryId, category.id), eq(products.name, productName))).limit(1);
      if (!product) continue;
      const groups = await db.select({ id: addonGroups.id }).from(addonGroups).where(eq(addonGroups.productId, product.id));
      for (const group of groups) {
        await db.delete(addonOptions).where(eq(addonOptions.groupId, group.id));
      }
      await db.delete(addonGroups).where(eq(addonGroups.productId, product.id));
      await db.delete(products).where(eq(products.id, product.id));
      console.log(`  - produto de demonstração removido: ${productName}`);
    }
    if (entry.deleteCategoryIfEmpty) {
      const [remaining] = await db.select({ id: products.id }).from(products).where(eq(products.categoryId, category.id)).limit(1);
      if (!remaining) {
        await db.delete(categories).where(eq(categories.id, category.id));
        console.log(`  - categoria de demonstração removida: ${entry.categoryName}`);
      }
    }
  }
}

async function upsertCategory(input: CategoryInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const namesToCheck = [input.name, ...(input.aliases ?? [])];
  const [existing] = await db.select().from(categories).where(inArray(categories.name, namesToCheck)).limit(1);

  if (existing) {
    if (existing.name !== input.name || existing.sortOrder !== input.sortOrder) {
      await db.update(categories).set({ name: input.name, description: input.description ?? existing.description, sortOrder: input.sortOrder, updatedAt: now }).where(eq(categories.id, existing.id));
      console.log(`  categoria renomeada: "${existing.name}" → "${input.name}"`);
    } else {
      console.log(`  categoria já existe, mantendo: ${input.name}`);
    }
    return existing.id;
  }

  const result = await db.insert(categories).values({
    name: input.name,
    description: input.description ?? null,
    sortOrder: input.sortOrder,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  const id = Number(result[0].insertId);
  console.log(`  + categoria criada: ${input.name} (#${id})`);
  return id;
}

async function upsertProduct(categoryId: number, input: ProductInput): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [existing] = await db.select({ id: products.id }).from(products).where(and(eq(products.categoryId, categoryId), eq(products.name, input.name))).limit(1);
  if (existing) {
    console.log(`    produto já existe, mantendo: ${input.name}`);
    if (input.onPromotion) {
      await db.update(products).set({ onPromotion: true, updatedAt: now }).where(eq(products.id, existing.id));
      console.log(`      marcado como "em promoção"`);
    }
    return { id: existing.id, created: false };
  }
  const result = await db.insert(products).values({
    categoryId,
    name: input.name,
    description: input.description ?? "",
    imageUrl: input.imageUrl ?? null,
    priceCents: input.priceCents,
    available: input.available ?? true,
    featured: input.featured ?? false,
    onPromotion: input.onPromotion ?? false,
    preparationMinutes: 20,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  });
  const id = Number(result[0].insertId);
  console.log(`    + produto criado: ${input.name} (#${id})`);
  return { id, created: true };
}

async function createAddonGroup(productId: number, group: AddonGroupInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(addonGroups).values({
    productId,
    name: group.name,
    required: group.required,
    minSelections: group.min,
    maxSelections: group.max,
    sortOrder: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  const groupId = Number(result[0].insertId);
  for (const [optionName, deltaReais] of group.options) {
    await db.insert(addonOptions).values({
      groupId,
      name: optionName,
      priceCents: Math.round(deltaReais * 100),
      available: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function run() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  await cleanupDemoData();

  console.log("== Categorias e produtos ==");
  const productIdByName = new Map<string, number>();

  for (const categoryInput of DATA.categories) {
    console.log(`\n${categoryInput.name}`);
    const categoryId = await upsertCategory(categoryInput);
    for (const productInput of categoryInput.products) {
      const { id, created } = await upsertProduct(categoryId, productInput);
      productIdByName.set(productInput.name, id);
      if (created && productInput.addonGroups?.length) {
        for (const group of productInput.addonGroups) {
          await createAddonGroup(id, group);
        }
      }
    }
  }

  console.log("\n== Promoções ==");
  for (const promotionInput of DATA.promotions) {
    const [existing] = await db.select({ id: promotions.id }).from(promotions).where(eq(promotions.title, promotionInput.title)).limit(1);
    if (existing) {
      console.log(`  promoção já existe, mantendo: ${promotionInput.title}`);
      continue;
    }
    const linkedProductId = promotionInput.linkTo ? productIdByName.get(promotionInput.linkTo) ?? null : null;
    if (promotionInput.linkTo && !linkedProductId) {
      console.warn(`  aviso: produto vinculado "${promotionInput.linkTo}" não encontrado para a promoção "${promotionInput.title}"`);
    }
    await db.insert(promotions).values({
      title: promotionInput.title,
      description: promotionInput.description,
      badge: promotionInput.badge,
      priceLabel: promotionInput.priceLabel,
      validDays: promotionInput.validDays,
      imageUrl: promotionInput.imageUrl,
      linkedProductId,
      active: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  + promoção criada: ${promotionInput.title}${linkedProductId ? ` (vinculada a #${linkedProductId})` : ""}`);
  }

  console.log("\n== Logotipo ==");
  const [settings] = await db.select().from(restaurantSettings).limit(1);
  if (settings && !settings.logoUrl) {
    await db.update(restaurantSettings).set({ logoUrl: "/comandiva-icon.png", updatedAt: now }).where(eq(restaurantSettings.id, settings.id));
    console.log("  logotipo padrão definido para /comandiva-icon.png");
  } else {
    console.log("  logotipo já estava configurado, não alterei.");
  }

  console.log("\nConcluído.");
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
