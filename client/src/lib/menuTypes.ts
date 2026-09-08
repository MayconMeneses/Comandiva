export type MenuProduct = { id: number; name: string; description: string | null; imageUrl: string | null; priceCents: number; available: boolean; onPromotion?: boolean; addonGroups: Array<{ id: number; name: string; minSelections: number; maxSelections: number; options: Array<{ id: number; name: string; priceCents: number; available: boolean }> }> };

export type MenuCategory = { id: number; name: string; description: string | null; imageUrl?: string | null; products: MenuProduct[] };
