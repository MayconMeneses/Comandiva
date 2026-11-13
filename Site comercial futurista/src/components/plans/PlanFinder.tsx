import { motion } from "motion/react";
import type { FinderAnswers } from "../../data/planFinder";

type Option<T> = { value: T; label: string };

function Segmented<T extends string | boolean>({
  id,
  question,
  options,
  value,
  onChange,
}: {
  id: string;
  question: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{question}</legend>
      <div className="mt-2.5 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-bg p-1">
        {options.map(opt => {
          const active = opt.value === value;
          return (
            <label key={String(opt.value)} className="relative cursor-pointer">
              <input
                type="radio"
                name={id}
                className="peer sr-only"
                checked={active}
                onChange={() => onChange(opt.value)}
              />
              {active && (
                <motion.span
                  layoutId={`seg-${id}`}
                  className="absolute inset-0 rounded-xl bg-accent"
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                />
              )}
              <span
                className={`relative block rounded-xl px-4 py-2 text-sm font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text ${
                  active ? "text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {opt.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * "Descubra seu plano": 3 perguntas sobre a operação e o plano indicado
 * acende na hora nos cartões abaixo (referência: "Plan Finder Pricing
 * Comparison Table", 21st.dev).
 */
export function PlanFinder({ answers, onChange }: { answers: FinderAnswers; onChange: (a: FinderAnswers) => void }) {
  return (
    <div className="rounded-3xl border border-line bg-bg-raised">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-3">
        <Segmented
          id="mesas"
          question="Seu restaurante atende em mesas?"
          value={answers.tables}
          onChange={tables => onChange({ ...answers, tables })}
          options={[
            { value: false, label: "Só delivery" },
            { value: true, label: "Tenho salão" },
          ]}
        />
        <Segmented
          id="equipe"
          question="Quantas pessoas vão usar o sistema?"
          value={answers.team}
          onChange={team => onChange({ ...answers, team })}
          options={[
            { value: "small", label: "Até 3" },
            { value: "medium", label: "4 a 8" },
            { value: "large", label: "Mais de 8" },
          ]}
        />
        <Segmented
          id="gestao"
          question="Precisa de auditoria e relatórios avançados?"
          value={answers.advanced}
          onChange={advanced => onChange({ ...answers, advanced })}
          options={[
            { value: false, label: "Não" },
            { value: true, label: "Sim" },
          ]}
        />
      </div>
    </div>
  );
}
