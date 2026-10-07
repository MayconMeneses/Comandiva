import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { CURRENT_TERMS_VERSION, DATA_RETENTION_YEARS } from "@shared/legal";
import { trpc } from "@/lib/trpc";
import { applyColorTheme } from "@/lib/applyColorTheme";
import { isMarcaBackground, MARCA_GRADIENT } from "@shared/colorThemes";
import { whatsAppHref } from "@/components/WhatsAppButton";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  const settings = trpc.catalog.settings.useQuery();
  const marca = isMarcaBackground(settings.data?.customBackgroundColor);
  useEffect(() => { applyColorTheme(settings.data?.colorTheme, settings.data?.customBackgroundColor); }, [settings.data?.colorTheme, settings.data?.customBackgroundColor]);
  const dataRequestHref = whatsAppHref(settings.data?.phone, "Olá! Quero solicitar acesso, correção ou exclusão dos meus dados pessoais no MM System Creator, conforme a LGPD.");
  return (
    <div className="min-h-screen bg-background" style={marca ? { background: MARCA_GRADIENT } : undefined}>
      <header className="border-b bg-[#fffdf8] text-[#231d18]">
        <div className="page-shell flex h-16 items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Voltar ao cardápio</button>
          <span className="font-display text-xl font-bold">MM System Creator</span>
          <span className="w-32" />
        </div>
      </header>
      <main className="page-shell max-w-3xl py-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Documento legal</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className={`prose prose-sm mt-8 max-w-none space-y-6 ${marca ? "text-[#e4e9f5]" : "text-[#3a2f25]"}`}>
          <section>
            <h2 className="font-display text-xl font-bold">1. Quem somos</h2>
            <p>Esta política se aplica ao site de pedidos do <strong>MM System Creator</strong>, estabelecido em Croatá/CE, e descreve como tratamos os dados pessoais fornecidos por quem faz pedidos pelo site, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">2. Quais dados coletamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nome completo</li>
              <li>Número de telefone (usado para identificar e acompanhar seus pedidos)</li>
              <li>Endereço de entrega, quando aplicável (rua, número, bairro, cidade, referência)</li>
              <li>Itens do pedido, observações e forma de pagamento escolhida</li>
              <li>Quando o pagamento é feito com cartão online, os dados do cartão são digitados diretamente na página segura da processadora de pagamento (ex.: Mercado Pago) — nosso site <strong>nunca recebe nem armazena</strong> o número do seu cartão</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">3. Para que usamos esses dados</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Processar, preparar e entregar o seu pedido</li>
              <li>Entrar em contato sobre o andamento do pedido</li>
              <li>Cumprir obrigações legais e fiscais</li>
              <li>Melhorar o cardápio e o atendimento com base no histórico de pedidos</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">4. Com quem compartilhamos</h2>
            <p>Compartilhamos dados apenas com quem é estritamente necessário para a operação: a equipe do próprio restaurante (para preparar e entregar seu pedido), a processadora de pagamento escolhida (quando você paga com cartão online) e, quando exigido por lei, autoridades competentes. Não vendemos nem alugamos seus dados a terceiros para fins de publicidade.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">5. Por quanto tempo guardamos seus dados</h2>
            <p>Guardamos os dados do seu pedido por até {DATA_RETENTION_YEARS} anos após a última interação sua com o MM System Creator, prazo adotado para cumprir as obrigações legais de guarda de registros comerciais e tributários. Depois desse prazo, se você não fizer novos pedidos, seus dados de identificação (nome, telefone, endereço) são anonimizados — o registro do pedido em si (itens e valores) pode ser mantido sem identificar você, para fins de auditoria e controle.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">6. Seus direitos</h2>
            <p>Nos termos da LGPD, você pode solicitar a qualquer momento: confirmação de que tratamos seus dados, acesso aos dados, correção de dados incompletos ou desatualizados, e eliminação dos dados tratados com seu consentimento, dentro dos limites do que a lei exige que guardemos (como registros fiscais). Você pode fazer isso sozinho, confirmando seu telefone por código de verificação, ou falar direto com a gente pelo WhatsApp informado no rodapé do site.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a href="/meus-dados" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover no-underline">
                Ver, baixar ou apagar meus dados
              </a>
              {dataRequestHref && (
                <a href={dataRequestHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20bd5a] no-underline">
                  Falar pelo WhatsApp
                </a>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">7. Segurança</h2>
            <p>Adotamos medidas técnicas razoáveis para proteger seus dados, incluindo conexão criptografada e controle de acesso ao painel administrativo. Nenhum sistema é 100% livre de riscos, e trabalhamos continuamente para reduzi-los.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">8. Contato</h2>
            <p>Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas pelo WhatsApp do restaurante, disponível na página inicial do site.</p>
          </section>

          <p className="text-xs text-muted-foreground">Versão desta política: {CURRENT_TERMS_VERSION}</p>
        </div>
      </main>
    </div>
  );
}
