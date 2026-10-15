import { LegalPage } from "../components/LegalPage";
import { usePageMeta } from "../lib/seo";

// Data fixa: muda só quando o texto mudar (o site antigo mostrava a data de hoje,
// o que fazia os termos parecerem atualizados todo dia — mesma correção já feita
// na Privacidade de lá). Texto igual ao de ../Site comercial/src/pages/Termos.tsx.
const LAST_UPDATED = "13/10/2026";

export default function Termos() {
  usePageMeta("/termos");
  return (
    <LegalPage title="Termos de uso" updated={LAST_UPDATED}>
      <p>
        O <strong>Comandiva</strong> é um sistema próprio, criado do zero por <strong>Maycon Meneses</strong>, oferecido como assinatura
        mensal pra restaurantes que querem cardápio digital, pedidos online e gestão de entregas com a marca do próprio negócio.
      </p>
      <section>
        <h2>Assinatura e cobrança</h2>
        <p className="mt-2">
          A mensalidade cobre o aluguel do sistema e a hospedagem, e só começa a valer 7 dias depois da entrega (configuração concluída) do
          seu restaurante. Você pode trocar de plano ou cancelar quando quiser, direto no seu painel.
        </p>
      </section>
      <section>
        <h2>Seus dados</h2>
        <p className="mt-2">
          Os dados do seu restaurante (cardápio, pedidos, clientes) ficam no deployment isolado do seu próprio restaurante — nunca
          compartilhados com outros clientes da plataforma.
        </p>
      </section>
      <section>
        <h2>Propriedade e direitos</h2>
        <p className="mt-2">O sistema, o código, a marca e o conteúdo deste site são de propriedade de Maycon Meneses. Todos os direitos reservados.</p>
      </section>
    </LegalPage>
  );
}
