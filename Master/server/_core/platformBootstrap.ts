import { countPlatformAdmins, createPlatformAdmin } from "../db/platformAdmins";

export type BootstrapResult = "created" | "admin-already-exists" | "not-configured";

/**
 * Cria o PRIMEIRO Super Admin a partir das variáveis BOOTSTRAP_SUPERADMIN_*.
 *
 * Regra de segurança: só cria quando NÃO existe nenhuma conta em
 * platform_admins. Se já existe qualquer uma, não cria e não altera NADA (nem
 * a senha) — a senha do .env vale só como senha inicial, uma vez. Antes, o
 * script checava só "existe conta com ESTE e-mail", então mudar o e-mail no
 * .env criaria um segundo owner a cada boot. Se a variável de senha continuar
 * preenchida depois de a conta existir, só avisa no log (sem imprimir o valor).
 */
export async function bootstrapFirstPlatformAdmin(input: { name: string; email: string; password: string }): Promise<BootstrapResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if ((await countPlatformAdmins()) > 0) {
    if (input.password) {
      console.warn(
        "[bootstrap-platform-admin] AVISO: BOOTSTRAP_SUPERADMIN_PASSWORD ainda está definida no .env, mas já existe Super Admin. " +
          "Ela NÃO é usada nem altera nada — remova essa linha do .env pra não deixar uma senha esquecida no servidor.",
      );
    }
    return "admin-already-exists";
  }
  if (!name || !email || !input.password) return "not-configured";

  await createPlatformAdmin({ name, email, password: input.password });
  return "created";
}
