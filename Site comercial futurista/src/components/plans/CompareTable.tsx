import { FEATURE_GROUPS, includes, type Plan, type PlanKey } from "../../data/plans";

function Mark({ on }: { on: boolean }) {
  return on ? (
    <>
      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4 text-accent-text" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">Incluído</span>
    </>
  ) : (
    <>
      <span aria-hidden="true" className="mx-auto block h-px w-3 bg-ink-soft/50" />
      <span className="sr-only">Não incluído</span>
    </>
  );
}

/**
 * Tabela completa, agrupada por categoria. 3 colunas estreitas de ícones
 * cabem até em 320 px, então não precisa arrastar para o lado. A coluna do
 * plano recomendado fica destacada.
 */
export function CompareTable({ plans, groups = FEATURE_GROUPS, recommended }: { plans: Plan[]; groups?: typeof FEATURE_GROUPS; recommended: PlanKey }) {
  const colClass = (key: PlanKey) => (key === recommended ? "bg-accent/10" : "");

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
      <div className="overflow-clip rounded-[calc(2rem-0.375rem)] bg-bg-raised">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">Comparação de recursos entre os planos Entrada, Profissional e Premium</caption>
          <colgroup>
            <col />
            {plans.map(p => (
              <col key={p.key} className="w-[4.25rem] sm:w-36" />
            ))}
          </colgroup>
          <thead className="sticky top-20 z-[1] bg-bg">
            <tr className="border-b border-line">
              <th scope="col" className="p-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-ink-soft sm:p-4">
                Recurso
              </th>
              {plans.map(p => (
                <th key={p.key} scope="col" className={`px-1 py-3 text-center font-display text-xs font-semibold sm:p-4 sm:text-base ${colClass(p.key)}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.title}>
              <tr>
                <th colSpan={plans.length + 1} scope="colgroup" className="bg-bg px-3 pb-2 pt-5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent-text sm:px-4">
                  {group.title}
                </th>
              </tr>
              {group.features.map(f => (
                <tr key={f.id} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="p-3 text-left font-normal sm:p-4">
                    <span className="block text-ink">{f.name}</span>
                    <span className="mt-0.5 hidden text-xs text-ink-soft sm:block">{f.description}</span>
                  </th>
                  {plans.map(p => (
                    <td key={p.key} className={`text-center ${colClass(p.key)}`}>
                      <Mark on={includes(p, f)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          <tbody>
            <tr>
              <th colSpan={plans.length + 1} scope="colgroup" className="bg-bg px-3 pb-2 pt-5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent-text sm:px-4">
                Limites e suporte
              </th>
            </tr>
            {[
              { label: "Usuários", value: (p: Plan) => (p.users === null ? "Sem limite" : `Até ${p.users}`) },
              { label: "Mesas", value: (p: Plan) => (p.tables === null ? "Sem limite" : p.tables === 0 ? "—" : `Até ${p.tables}`) },
              { label: "Manutenção", value: (p: Plan) => (p.key === "essencial" ? "R$ 50/vez" : "Inclusa") },
            ].map(row => (
              <tr key={row.label} className="border-b border-line/60 last:border-0">
                <th scope="row" className="p-3 text-left font-normal text-ink sm:p-4">
                  {row.label}
                </th>
                {plans.map(p => (
                  <td key={p.key} className={`px-1 text-center font-mono text-[11px] text-ink sm:text-xs ${colClass(p.key)}`}>
                    {row.value(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
