const ICON_BASE = "/assets/pubx/categories";

const KEYWORD_ICON_MAP: Array<[string[], string]> = [
  [["promoç", "happy hour"], "fire.svg"],
  [["hambúrguer", "hamburguer", "burger"], "burger.svg"],
  [["pizza"], "pizza.svg"],
  [["espetinho"], "skewer.svg"],
  [["caldo"], "soup.svg"],
  [["2 a 3", "compartilh"], "sharing.svg"],
  [["sobremesa", "doce"], "dessert.svg"],
  [["bebida", "drink"], "drink.svg"],
  [["petisco", "guarniç", "guarnic"], "snack.svg"],
];

/** Ícone padrão para uma categoria com base no nome, usado até o admin subir uma imagem própria. */
export function defaultCategoryIcon(categoryName: string): string {
  const normalized = categoryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const [keywords, file] of KEYWORD_ICON_MAP) {
    if (keywords.some(keyword => normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
      return `${ICON_BASE}/${file}`;
    }
  }
  return `${ICON_BASE}/plate.svg`;
}
