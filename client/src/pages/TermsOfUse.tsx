import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { CURRENT_TERMS_VERSION } from "@shared/legal";

export default function TermsOfUse() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-[#fffdf8]">
        <div className="page-shell flex h-16 items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Voltar ao cardápio</button>
          <span className="font-display text-xl font-bold">MM System Creator</span>
          <span className="w-32" />
        </div>
      </header>
      <main className="page-shell max-w-3xl py-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Documento legal</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-[#3a2f25]">
          <section>
            <h2 className="font-display text-xl font-bold">1. Aceitação</h2>
            <p>Ao fazer um pedido pelo site do MM System Creator, você concorda com estes Termos de Uso e com a nossa <a href="/politica-de-privacidade" className="font-semibold text-primary underline">Política de Privacidade</a>.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">2. Pedidos e pagamento</h2>
            <p>Os preços exibidos no cardápio já incluem os valores dos itens; a taxa de entrega, quando aplicável, é somada no checkout antes da confirmação. Aceitamos as formas de pagamento indicadas na tela de finalização do pedido (Pix, dinheiro, cartão na entrega e, quando disponível, cartão online). Ao escolher pagamento com cartão online, você será redirecionado para a página segura da processadora de pagamento — o MM System Creator não tem acesso aos dados do seu cartão.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">3. Documento fiscal</h2>
            <p>Conforme a legislação tributária aplicável — incluindo, no Estado do Ceará, a Instrução Normativa SEFAZ-CE nº 87/2025, que exige a vinculação do comprovante de pagamento eletrônico ao documento fiscal (NF-e/NFC-e) — o MM System Creator emite o documento fiscal correspondente à venda sempre que exigido, associando os dados da transação (forma de pagamento, valor e identificação do estabelecimento) à nota fiscal.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">4. Cancelamento e direito de arrependimento</h2>
            <p>Por se tratar de gêneros alimentícios preparados sob encomenda e de natureza perecível, o pedido não pode ser cancelado após o início do preparo. Caso identifique um problema com o pedido recebido (item incorreto, ausente ou fora do padrão de qualidade), entre em contato imediatamente pelo WhatsApp do restaurante para que possamos resolver — nos termos do Código de Defesa do Consumidor (Lei nº 8.078/1990).</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">5. Prazos de entrega</h2>
            <p>Os prazos estimados exibidos no site são referenciais e podem variar conforme volume de pedidos, condições de trânsito e clima. Fazemos o possível para cumpri-los, mas eles não constituem garantia de horário exato.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">6. Responsabilidades</h2>
            <p>É responsabilidade do cliente informar corretamente o endereço de entrega e um telefone de contato válido. O MM System Creator não se responsabiliza por atrasos ou não-entrega decorrentes de informações incorretas fornecidas no pedido.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">7. Alterações</h2>
            <p>Estes termos podem ser atualizados a qualquer momento para refletir mudanças legais ou operacionais. A versão vigente é sempre a publicada nesta página.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">8. Contato</h2>
            <p>Dúvidas sobre estes termos podem ser enviadas pelo WhatsApp do restaurante, disponível na página inicial do site.</p>
          </section>

          <p className="text-xs text-muted-foreground">Versão destes termos: {CURRENT_TERMS_VERSION}</p>
        </div>
      </main>
    </div>
  );
}
