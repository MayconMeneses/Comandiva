import { FEATURE_GROUPS, includes, maintenanceShort, type Plan, type PlanKey } from "../../data/plans";

function Mark({ on }: { on: boolean }) {
  return on ? (
    <>
      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4 text-band-ink" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">Incluído</span>
    </>
  ) : (
    <>
      <span aria-hidden="true" className="mx-auto block h-px w-3 bg-band-soft/60" />
      <span className="sr-only">Não incluído</span>
    </>
  );
}

const GROUP_TH = "bg-band px-3 pb-2 pt-6 text-left font-mono text-xs font-medium uppercase tracking-wider text-band-soft sm:px-4";
const ROW = "border-b border-band-line/60 transition-colors duration-150 odd:bg-band-raised/40 last:border-0 hover:bg-band-line/70 focus-within:bg-band-line/70";

/**
 * Tabela completa, agrupada por categoria, na zona escura. A linha sob o
 * mouse acende para o olho não se perder entre as 3 colunas, que cabem até
 * em 320 px. A coluna do plano recomendado fica tingida de azul.
 */
export function CompareTable({ plans, groups = FEATURE_GROUPS, recommended }: { plans: Plan[]; groups?: typeof FEATURE_GROUPS; recommended: PlanKey }) {
  const colClass = (key: PlanKey) => (key === recommended ? "bg-accent/20" : "");

  return (
    <div className="rounded-3xl border border-band-line bg-band">
      <div className="overflow-clip rounded-3xl">
        <table className="w-full table-fixed border-collapse text-sm text-band-ink">
          <caption className="sr-only">Comparação de recursos entre os planos Entrada, Profissional e Premium</caption>
          <colgroup>
            <col />
            {plans.map(p => (
              <col key={p.key} className="w-[4.25rem] sm:w-36" />
            ))}
          </colgroup>
          <thead className="sticky top-20 z-[1] bg-band-raised">
            <tr className="border-b border-band-line">
              <th scope="col" className="p-3 text-left font-mono text-xs font-medium text-band-soft sm:p-4">
                Recurso
              </th>
              {plans.map(p => (
                <th key={p.key} scope="col" className={"px-1 py-3 text-center font-display text-xs font-semibold sm:p-4 sm:text-base " + colClass(p.key)}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.title}>
              <tr>
                <th colSpan={plans.length + 1} scope="colgroup" className={GROUP_TH}>
                  {group.title}
                </th>
              </tr>
              {group.features.map(f => (
                <tr key={f.id} className={ROW}>
                  <th scope="row" className="p-3 text-left font-normal sm:p-4">
                    <span className="block text-band-ink">{f.name}</span>
                    <span className="mt-0.5 hidden text-xs text-band-soft sm:block">{f.description}</span>
                  </th>
                  {plans.map(p => (
                    <td key={p.key} className={"text-center " + colClass(p.key)}>
                      <Mark on={includes(p, f)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          <tbody>
            <tr>
              <th colSpan={plans.length + 1} scope="colgroup" className={GROUP_TH}>
                Limites e suporte
              </th>
            </tr>
            {[
              { label: "Usuários", value: (p: Plan) => (p.users === null ? "Sem limite" : "Até " + p.users) },
              { label: "Mesas", value: (p: Plan) => (p.tables === null ? "Sem limite" : p.tables === 0 ? "Não incluso" : "Até " + p.tables) },
              { label: "Manutenção", value: maintenanceShort },
            ].map(row => (
              <tr key={row.label} className={ROW}>
                <th scope="row" className="p-3 text-left font-normal text-band-ink sm:p-4">
                  {row.label}
                </th>
                {plans.map(p => (
                  <td key={p.key} className={"px-1 text-center font-mono text-xs text-band-ink [font-variant-numeric:tabular-nums] " + colClass(p.key)}>
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
