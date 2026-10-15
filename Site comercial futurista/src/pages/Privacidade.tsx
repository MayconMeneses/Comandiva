import { LegalPage } from "../components/LegalPage";
import { usePageMeta } from "../lib/seo";

// Mesmo texto e mesma data de ../Site comercial/src/pages/Privacidade.tsx.
// Data fixa de propósito: mudar só quando o texto da política mudar de verdade.
const LAST_UPDATED = "13/10/2026";

export default function Privacidade() {
  usePageMeta("/privacidade");
  return (
    <LegalPage title="Política de privacidade" updated={LAST_UPDATED}>
      <p>Levamos a proteção das suas informações a sério. Esta página explica, de forma direta, o que coletamos e como usamos.</p>
      <section>
        <h2>O que coletamos no cadastro</h2>
        <p className="mt-2">
          Nome do restaurante, nome e e-mail do responsável e WhatsApp de contato — só o necessário pra configurar seu sistema e falar com
          você. Nunca pedimos dados de cartão diretamente: o pagamento é processado pelo Mercado Pago, que tem seus próprios padrões de
          segurança (PCI-DSS).
        </p>
      </section>
      <section>
        <h2>Medição de visitas</h2>
        <p className="mt-2">
          Este site conta visitas e cliques de forma agregada e anônima, com um sistema próprio nosso: sem cookies, sem guardar seu IP e sem
          identificar pessoas. Nenhum serviço de terceiros recebe esses dados, e o sinal "Do Not Track" do seu navegador é respeitado.
        </p>
      </section>
      <section>
        <h2>Como protegemos seus dados</h2>
        <p className="mt-2">
          Conexão sempre criptografada, senhas nunca guardadas em texto puro, e cada restaurante roda num deployment isolado — seus dados de
          cardápio, pedidos e clientes nunca ficam misturados com os de outro restaurante.
        </p>
      </section>
      <section>
        <h2>Quem responde pelos dados</h2>
        <p className="mt-2">
          O Comandiva é criado e mantido por Maycon Meneses, que responde pelo tratamento dos dados descritos nesta página, conforme a Lei
          Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p className="mt-2">O site comercial não usa cookies de rastreamento nem de publicidade. A medição de visitas descrita acima funciona sem cookies.</p>
      </section>
      <section>
        <h2>Seus direitos pela LGPD</h2>
        <p className="mt-2">Você pode pedir, a qualquer momento:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, errados ou desatualizados;</li>
          <li>eliminação dos dados, ou bloqueio e anonimização dos que forem desnecessários;</li>
          <li>portabilidade dos dados;</li>
          <li>informação sobre com quem os dados são compartilhados;</li>
          <li>revogação de um consentimento que você tenha dado.</li>
        </ul>
        <p className="mt-2">Para pedir qualquer um desses itens, fale diretamente com a nossa equipe.</p>
      </section>
    </LegalPage>
  );
}
