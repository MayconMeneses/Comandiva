import FaqManager from "@/components/FaqManager";
import { trpc } from "@/lib/trpc";
import { Header, Loading } from "./shared";
import SiteInfoSettings from "./SiteInfoSettings";

export default function SiteConfig() {
  const dashboard = trpc.admin.dashboard.useQuery();
  if (dashboard.isLoading) return <Loading />;
  return <>
    <Header eyebrow="Configuração" title="Site público" description="Dados usados nas páginas Sobre, Perguntas frequentes e no botão de WhatsApp do site de pedidos." />
    <div className="space-y-8">
      <SiteInfoSettings settings={dashboard.data?.settings} />
      <FaqManager />
    </div>
  </>;
}
