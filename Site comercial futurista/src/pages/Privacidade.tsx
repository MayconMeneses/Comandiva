import { LegalPage } from "../components/LegalPage";
import { usePageMeta } from "../lib/seo";
import { companyIdentity } from "../data/company";

// Mesmo texto e mesma data de ../Site comercial/src/pages/Privacidade.tsx.
// Data fixa de propósito: mudar só quando o texto da política mudar de verdade.
const LAST_UPDATED = "21/10/2026";

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
        <h2>Para que usamos e em que base</h2>
        <p className="mt-2">
          Usamos esses dados para criar e configurar o seu sistema, falar com você sobre o cadastro e o suporte e cumprir obrigações legais. A
          base é a execução do serviço que você pediu (e os passos anteriores ao contrato, a seu pedido) e o consentimento que você dá ao marcar
          a caixa do cadastro. Não vendemos nem alugamos seus dados.
        </p>
      </section>
      <section>
        <h2>Cardápio enviado</h2>
        <p className="mt-2">
          O arquivo do cardápio (PDF, Word ou foto) é usado só para montar o seu sistema. Envie apenas o cardápio: evite documentos com dados
          pessoais seus ou de terceiros.
        </p>
      </section>
      <section>
        <h2>Com quem os dados passam</h2>
        <p className="mt-2">Para o serviço funcionar, alguns fornecedores tratam dados em nosso nome:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Telegram</strong>: recebe o aviso interno de novo cadastro e de cardápio enviado, com os dados do formulário e o arquivo,
            para a nossa equipe;
          </li>
          <li>
            <strong>Mercado Pago</strong>: processa o pagamento da assinatura;
          </li>
          <li>
            <strong>Hospedagem</strong>: os servidores em que o site e o seu sistema funcionam.
          </li>
        </ul>
        <p className="mt-2">Algum desses fornecedores pode guardar dados fora do Brasil. Só passamos o necessário para cada função.</p>
      </section>
      <section>
        <h2>Por quanto tempo guardamos</h2>
        <p className="mt-2">
          Enquanto o cadastro estiver em andamento ou você for cliente. Depois, só pelo prazo que a lei exigir ou para nos defendermos em
          algum processo. Passado isso, apagamos ou anonimizamos.
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
          O Comandiva é criado e mantido por {companyIdentity()}, que responde pelo tratamento dos dados descritos nesta página, conforme a
          Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p className="mt-2">O site comercial não usa cookies de rastreamento nem de publicidade, então não mostramos aviso de cookies. A medição de visitas descrita
          acima funciona sem cookies. O navegador guarda apenas, durante a sessão, a informação de que você já viu a animação de abertura.</p>
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
        <p className="mt-2">
          Só tratamos dados de quem se cadastra, e o contato com essas pessoas é feito diretamente por mim. Para pedir qualquer um desses
          itens, responda a esse contato e eu atendo o pedido.
        </p>
      </section>
    </LegalPage>
  );
}
