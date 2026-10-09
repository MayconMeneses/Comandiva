import { MessageCircle } from "lucide-react";

function toWhatsAppDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Monta o link wa.me para um telefone + mensagem, ou null se o telefone não for válido. */
export function whatsAppHref(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = toWhatsAppDigits(phone);
  if (digits.length < 12) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function WhatsAppButton({ phone, message = "Olá! Vim pelo site do Comandiva e gostaria de tirar uma dúvida." }: { phone: string | null | undefined; message?: string }) {
  const href = whatsAppHref(phone, message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_rgba(0,0,0,.25)] transition hover:scale-105 hover:bg-[#20bd5a]"
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" strokeWidth={0} />
    </a>
  );
}
