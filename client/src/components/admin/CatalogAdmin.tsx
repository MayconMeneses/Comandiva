import { useAuth } from "@/_core/hooks/useAuth";
import AddonManagerFull from "@/components/AddonManagerFull";
import CatalogProductAvailability from "@/components/CatalogProductAvailability";
import CategoryManager from "@/components/CategoryManager";
import ProductCreateWithImage from "@/components/ProductCreateWithImage";
import { LockedFeatureCard } from "@/components/admin/LockedFeature";
import { trpc } from "@/lib/trpc";
import PromotionManager from "./PromotionManager";

// Página composta de duas áreas de permissão distintas (ver
// shared/permissions.ts) — uma conta staff pode ter só uma delas liberada,
// então cada metade só renderiza (e só consulta o backend) se a permissão
// correspondente estiver presente. Admin/Modo Suporte sempre têm as duas
// (auth.me devolve a lista inteira de áreas pra eles). Promoções também é
// um recurso de PLANO (ver server/_core/license.ts::FEATURE_IDS) — os dois
// eixos são independentes, precisa passar nos dois pra ver o gerenciador.
export default function CatalogAdmin() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canCatalog = permissions.includes("catalog");
  const canPromotions = permissions.includes("promotions");
  const snapshot = trpc.admin.mySnapshot.useQuery(undefined, { enabled: canPromotions });
  const promotionsLocked = snapshot.data?.lockedFeatures.promotions;
  return <>
    {canCatalog ? <><ProductCreateWithImage /><CategoryManager /><CatalogProductAvailability /><AddonManagerFull /></> : null}
    {canPromotions ? (promotionsLocked ? <LockedFeatureCard title="Promoções e combos" requiredPlanName={promotionsLocked.requiredPlanName} featureId="promotions" /> : <PromotionManager />) : null}
  </>;
}
