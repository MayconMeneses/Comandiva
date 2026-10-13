import { COMMERCIAL_PAGE_META } from "@shared/commercialPageMeta";
import { usePageMeta } from "@/lib/usePageMeta";
import { ComercialHeader } from "./ComercialHeader";
import { ComercialFooter } from "./ComercialFooter";
import { Reveal } from "./Reveal";

// Data fixa de propósito: mudar só quando o texto da política mudar de verdade
// (antes usava a data de hoje, o que fazia a política "se atualizar" sozinha todo dia).
const LAST_UPDATED = "13/10/2026";

export default function Privacidade() {
  usePageMeta({ ...COMMERCIAL_PAGE_META["/comercial/privacidade"], path: "/comercial/privacidade" });
  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <main id="main-content" tabIndex={-1}>
      <Reveal className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold text-ink">Política de privacidade</h1>
        <p className="mt-1 text-sm text-ink-soft">Última atualização: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
          <p>
            Levamos a proteção das suas informações a sério. Esta página explica, de forma direta, o que
            coletamos e como usamos.
          </p>
          <div>
            <h2 className="font-semibold text-ink">O que coletamos no cadastro</h2>
            <p className="mt-1">
              Nome do restaurante, nome e e-mail do responsável e WhatsApp de contato — só o necessário pra
              configurar seu sistema e falar com você. Nunca pedimos dados de cartão diretamente: o pagamento é
              processado pelo Mercado Pago, que tem seus próprios padrões de segurança (PCI-DSS).
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Medição de visitas</h2>
            <p className="mt-1">
              Este site conta visitas e cliques de forma agregada e anônima, com um sistema próprio nosso:
              sem cookies, sem guardar seu IP e sem identificar pessoas. Nenhum serviço de terceiros recebe esses
              dados, e o sinal "Do Not Track" do seu navegador é respeitado.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Como protegemos seus dados</h2>
            <p className="mt-1">
              Conexão sempre criptografada, senhas nunca guardadas em texto puro, e cada restaurante roda num
              deployment isolado — seus dados de cardápio, pedidos e clientes nunca ficam misturados com os de
              outro restaurante.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Quem responde pelos dados</h2>
            <p className="mt-1">
              O Comandiva é criado e mantido por Maycon Meneses, que responde pelo tratamento dos dados descritos
              nesta página, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Cookies</h2>
            <p className="mt-1">
              O site comercial não usa cookies de rastreamento nem de publicidade. A medição de visitas descrita
              acima funciona sem cookies.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Seus direitos pela LGPD</h2>
            <p className="mt-1">Você pode pedir, a qualquer momento:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>confirmação de que tratamos seus dados e acesso a eles;</li>
              <li>correção de dados incompletos, errados ou desatualizados;</li>
              <li>eliminação dos dados, ou bloqueio e anonimização dos que forem desnecessários;</li>
              <li>portabilidade dos dados;</li>
              <li>informação sobre com quem os dados são compartilhados;</li>
              <li>revogação de um consentimento que você tenha dado.</li>
            </ul>
            <p className="mt-2">Para pedir qualquer um desses itens, fale diretamente com a nossa equipe.</p>
          </div>
        </div>
      </Reveal>
      </main>
      <ComercialFooter />
    </div>
  );
}
