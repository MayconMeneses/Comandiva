import { useEffect } from "react";

const SCRIPT_ID = "mercadopago-security-script";

/**
 * Injeta o script antifraude oficial do Mercado Pago (`security.js`) — sem
 * ele, o SDK deles não consegue coletar o fingerprint do dispositivo, e o
 * motor de risco às vezes nunca libera o botão de pagar no Checkout Pro
 * (fica preso em "carregando", sem erro nenhum) — reproduzido no Safari do
 * iPhone (bloqueio padrão de rastreamento entre sites), tanto no Pix quanto
 * no cartão, logado ou como visitante. Carregado aqui, na página que leva o
 * cliente pro checkout, e não globalmente, porque só faz sentido perto de um
 * pagamento (não em todo o Painel Master).
 */
export function useMercadoPagoSecurity() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://www.mercadopago.com/v2/security.js";
    script.setAttribute("view", "checkout");
    document.head.appendChild(script);
  }, []);
}
