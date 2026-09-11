import { ComercialHeader } from "./ComercialHeader";
import { ComercialFooter } from "./ComercialFooter";

export default function Privacidade() {
  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold text-ink">Política de privacidade</h1>
        <p className="mt-1 text-sm text-ink-soft">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

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
            <h2 className="font-semibold text-ink">Como protegemos seus dados</h2>
            <p className="mt-1">
              Conexão sempre criptografada, senhas nunca guardadas em texto puro, e cada restaurante roda num
              deployment isolado — seus dados de cardápio, pedidos e clientes nunca ficam misturados com os de
              outro restaurante.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Seus direitos</h2>
            <p className="mt-1">
              Você pode pedir a correção ou exclusão dos seus dados a qualquer momento, falando diretamente com
              a nossa equipe.
            </p>
          </div>
        </div>
      </div>
      <ComercialFooter />
    </div>
  );
}
