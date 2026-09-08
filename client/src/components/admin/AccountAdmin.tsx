import PaymentGatewayManager from "@/components/PaymentGatewayManager";
import { trpc } from "@/lib/trpc";
import { Header, Loading } from "./shared";
import PixSettings from "./PixSettings";

export default function AccountAdmin() {
  const account = trpc.admin.getAccountSettings.useQuery();
  if (account.isLoading) return <Loading />;
  return <>
    <Header eyebrow="Conta" title="Pix e pagamento com cartão" description="Cadastre a chave Pix e as processadoras de cartão (a 'máquina') usadas no checkout." />
    <div className="space-y-8">
      <PixSettings settings={account.data} />
      <PaymentGatewayManager />
    </div>
  </>;
}
