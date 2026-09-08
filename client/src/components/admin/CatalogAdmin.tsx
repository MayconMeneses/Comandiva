import { useAuth } from "@/_core/hooks/useAuth";
import AddonManagerFull from "@/components/AddonManagerFull";
import CatalogProductAvailability from "@/components/CatalogProductAvailability";
import CategoryManager from "@/components/CategoryManager";
import ProductCreateWithImage from "@/components/ProductCreateWithImage";
import PromotionManager from "./PromotionManager";

// Página composta de duas áreas de permissão distintas (ver
// shared/permissions.ts) — uma conta staff pode ter só uma delas liberada,
// então cada metade só renderiza (e só consulta o backend) se a permissão
// correspondente estiver presente. Admin/Modo Suporte sempre têm as duas
// (auth.me devolve a lista inteira de áreas pra eles).
export default function CatalogAdmin() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canCatalog = permissions.includes("catalog");
  const canPromotions = permissions.includes("promotions");
  return <>
    {canCatalog ? <><ProductCreateWithImage /><CategoryManager /><CatalogProductAvailability /><AddonManagerFull /></> : null}
    {canPromotions ? <PromotionManager /> : null}
  </>;
}
