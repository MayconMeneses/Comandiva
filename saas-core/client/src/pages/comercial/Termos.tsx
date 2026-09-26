import { ComercialHeader } from "./ComercialHeader";
import { ComercialFooter } from "./ComercialFooter";

export default function Termos() {
  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold text-ink">Termos de uso</h1>
        <p className="mt-1 text-sm text-ink-soft">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
          <p>
            O <strong className="text-ink">MM System Creator</strong> é um sistema próprio, criado do zero por{" "}
            <strong className="text-ink">Maycon Meneses</strong>, oferecido como assinatura mensal pra restaurantes
            que querem cardápio digital, pedidos online e gestão de entregas com a marca do próprio negócio.
          </p>
          <div>
            <h2 className="font-semibold text-ink">Assinatura e cobrança</h2>
            <p className="mt-1">
              A taxa de implementação é cobrada uma única vez, no cadastro. A mensalidade cobre o aluguel do
              sistema e a hospedagem, e só começa a valer 7 dias depois da entrega (configuração concluída) do
              seu restaurante. Você pode trocar de plano ou cancelar quando quiser, direto no seu painel.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Seus dados</h2>
            <p className="mt-1">
              Os dados do seu restaurante (cardápio, pedidos, clientes) ficam no deployment isolado do seu
              próprio restaurante — nunca compartilhados com outros clientes da plataforma.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Propriedade e direitos</h2>
            <p className="mt-1">
              O sistema, o código, a marca e o conteúdo deste site são de propriedade de Maycon Meneses. Todos
              os direitos reservados.
            </p>
          </div>
        </div>
      </div>
      <ComercialFooter />
    </div>
  );
}
