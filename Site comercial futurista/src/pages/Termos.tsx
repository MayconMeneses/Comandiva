import { LegalPage } from "../components/LegalPage";
import { usePageMeta } from "../lib/seo";

// Data fixa: muda só quando o texto mudar (o site antigo mostrava a data de hoje,
// o que fazia os termos parecerem atualizados todo dia — mesma correção já feita
// na Privacidade de lá). Texto igual ao de ../Site comercial/src/pages/Termos.tsx.
const LAST_UPDATED = "21/10/2026";

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
      <section id="cancelamento-reembolso" className="scroll-mt-28">
        <h2>Cancelamento e reembolso</h2>
        <p className="mt-2">
          Você cancela a qualquer momento, direto no seu painel, sem multa e sem fidelidade. Não há reembolso dos valores já pagos. O teste
          grátis de 7 dias não exige cartão de crédito, então nada é cobrado antes de você decidir assinar.
        </p>
      </section>
      <section>
        <h2>Uso do serviço</h2>
        <p className="mt-2">
          Use o sistema só para a operação lícita do seu restaurante. Você responde pelo cardápio, preços e informações que publica, e pelas
          imagens e textos que enviar, que precisam ser seus ou ter autorização de uso.
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
      <section>
        <h2>Alterações destes termos</h2>
        <p className="mt-2">Se estes termos mudarem, a data de atualização no topo da página muda junto.</p>
      </section>
    </LegalPage>
  );
}
