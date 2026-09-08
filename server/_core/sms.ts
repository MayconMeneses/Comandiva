import { ENV } from "./env";

/**
 * Envio de SMS — usado hoje só pelo código de verificação do autoatendimento
 * LGPD (server/routers/dataRights.ts), pra provar que quem está pedindo
 * acesso/exclusão de dados é o dono real do número de telefone.
 *
 * Sem SMS_PROVIDER configurado (padrão "none"), o código só é registrado no
 * log do servidor — o recurso continua funcional pra testar o fluxo inteiro
 * sem depender de nenhum provedor pago, mas o SMS de verdade só sai quando
 * "twilio" for configurado com as três variáveis TWILIO_*.
 */
export async function sendSms(phone: string, message: string): Promise<{ sent: boolean; reason?: string }> {
  if (ENV.smsProvider === "twilio") {
    if (!ENV.twilioAccountSid || !ENV.twilioAuthToken || !ENV.twilioFromNumber) {
      console.warn("[sms] SMS_PROVIDER=twilio mas TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER não estão todos preenchidos — SMS não enviado.");
      return { sent: false, reason: "twilio_misconfigured" };
    }
    const body = new URLSearchParams({ To: phone, From: ENV.twilioFromNumber, Body: message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      console.warn(`[sms] Twilio respondeu ${response.status} ao tentar enviar SMS.`);
      return { sent: false, reason: `twilio_${response.status}` };
    }
    return { sent: true };
  }

  console.warn(`[sms] SMS_PROVIDER não configurado — código não enviado de verdade. Telefone: ${phone}. Mensagem: ${message}`);
  return { sent: false, reason: "not_configured" };
}
