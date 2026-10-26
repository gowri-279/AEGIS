import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";
import { BUILD_STEPS } from "@/data/buildDemo";
import {
  CONSTRAINTS, ENV_PRIORITIES, INFRA_PRIORITIES, PRIMARY_OBJECTIVES, SCENARIOS,
  designIntent, requirementsComplete, shortOf, type BuildPathKind, type DesignRequirements,
} from "@/data/buildRequirements";
import { BuildProgress, BuildShell } from "./BuildShell";
import { setBuildFlow, useBuildFlow } from "./buildFlowStore";
import { ContextList, designContextRows } from "./DesignContext";

const HEAD: Record<BuildPathKind, { kicker: string; title: string; lede: string }> = {
  new: { kicker: "New Network · 02 / Requirements", title: "Define the design objectives", lede: "Tell AEGIS what the proposed network should optimize and which constraints must be respected." },
  redesign: { kicker: "Redesign Existing · 02 / Requirements", title: "Define the redesign objectives", lede: "Tell AEGIS what should improve while preserving the constraints of the existing network." },
};

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <section className="rq-section" aria-label={title}><header><p className="bs-panel-kicker">{title}</p><p className="rq-hint">{hint}</p></header>{children}</section>;
}

export function DesignRequirementsScreen({ path }: { path: BuildPathKind }) {
  const flow = useBuildFlow();
  const r = flow.requirements;
  const [advanced, setAdvanced] = useState(false);
  const update = (patch: Partial<DesignRequirements>) => setBuildFlow((s) => ({ requirements: { ...s.requirements, ...patch } }));
  const toggle = (key: "constraints", id: string) =>
    update({ [key]: r[key].includes(id) ? r[key].filter((x) => x !== id) : [...r[key], id] });
  const ready = requirementsComplete(r);
  const h = HEAD[path];
  const back = path === "new" ? "/build/new" : "/build/redesign";

  return (
    <BuildShell>
      <main className="build-setup">
        <BuildProgress steps={BUILD_STEPS[path]} active={1} />
        <header className="build-setup-panel">
          <p className="build-setup-step">{h.kicker}</p>
          <h1 className="build-heading">{h.title}</h1>
          <p className="build-lede">{h.lede}</p>
        </header>

        <div className="rq-layout">
          <div className="rq-main">
            <Section title="Primary Objective" hint="What is the most important outcome for this design?">
              <div className="rq-grid" role="radiogroup" aria-label="Primary objective">
                {PRIMARY_OBJECTIVES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={r.primary === o.id} className={`rq-tile ${r.primary === o.id ? "is-on" : ""}`} onClick={() => update({ primary: o.id })}>
                  <strong>{o.label}</strong><small>{o.description}</small>
                </button>)}
              </div>
            </Section>

            <Section title="Design Scenario" hint="Which rainfall condition should the design be evaluated against?">
              <div className="rq-scenario">
                <div className="rq-grid is-3" role="radiogroup" aria-label="Design scenario">
                  {SCENARIOS.map((o) => <button key={o.id} type="button" role="radio" aria-checked={r.scenario === o.id} className={`rq-tile ${r.scenario === o.id ? "is-on" : ""}`} onClick={() => update({ scenario: o.id })}>
                    <strong>{o.label}</strong><small>{o.description}</small>
                  </button>)}
                </div>
                <div className="rq-meter" aria-hidden>
                  {SCENARIOS.map((o, i) => <span key={o.id} className={r.scenario === o.id ? "is-on" : ""}><i style={{ height: `${8 + i * 7}px` }} />{o.label}</span>)}
                </div>
                <p className="bs-note">Selected design scenario only — no hydraulic simulation runs at this step.</p>
              </div>
            </Section>

            <Section title="Design Constraints" hint="Identify conditions the proposed network must respect.">
              <div className="rq-grid">
                {CONSTRAINTS.map((o) => { const on = r.constraints.includes(o.id);
                  return <button key={o.id} type="button" role="checkbox" aria-checked={on} className={`rq-tile ${on ? "is-on" : ""}`} onClick={() => toggle("constraints", o.id)}>
                    <strong><span className="rq-box">{on && <Check size={11} />}</span>{o.label}</strong><small>{o.description}</small>
                  </button>; })}
              </div>
            </Section>

            <section className="rq-advanced">
              <button type="button" className="rq-adv-toggle" aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>
                <span><span className="bs-panel-kicker">Advanced Constraints</span><small>Optional engineering constraints</small></span>
                <ChevronDown size={16} className={advanced ? "is-open" : ""} />
              </button>
              {advanced && <div className="rq-adv-body">
                <label className="rq-field"><span>Maximum Construction Footprint</span>
                  <input value={r.maxFootprint} onChange={(e) => update({ maxFootprint: e.target.value })} placeholder="No limit" />
                </label>
                <label className="rq-field"><span>Existing Infrastructure Priority</span>
                  <select value={r.infraPriority} onChange={(e) => update({ infraPriority: e.target.value as DesignRequirements["infraPriority"] })}>
                    {INFRA_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <div className="rq-field"><span>Environmental Protection Priority</span>
                  <div className="rq-seg" role="radiogroup" aria-label="Environmental protection priority">
                    {ENV_PRIORITIES.map((p) => <button key={p} type="button" role="radio" aria-checked={r.envPriority === p} className={r.envPriority === p ? "is-on" : ""} onClick={() => update({ envPriority: p })}>{p}</button>)}
                  </div>
                </div>
              </div>}
            </section>

            <section className="rq-intent" aria-live="polite">
              <p className="bs-panel-kicker">AEGIS Design Intent <em>Assembled from your selections</em></p>
              <blockquote>{designIntent(r, path)}</blockquote>
            </section>
          </div>

          <aside className="rq-side">
            <div className="bs-panel">
              <p className="bs-panel-kicker">Design Context</p>
              <ContextList rows={designContextRows(path, flow)} />
            </div>
            <RequirementsSummary r={r} />
          </aside>
        </div>

        <footer className="bs-footer">
          <Link to={back} className="build-link"><ArrowLeft size={14} />Back</Link>
          {ready
            ? <Link to="/build/brief" search={{ path }} className="build-link is-primary">Create Design Brief<ArrowRight size={14} /></Link>
            : <span className="build-link is-disabled" aria-disabled="true">Create Design Brief<ArrowRight size={14} /></span>}
        </footer>
      </main>
    </BuildShell>
  );
}

export function RequirementsSummary({ r }: { r: DesignRequirements }) {
  const list = (ids: string[], src: typeof CONSTRAINTS) => ids.length ? ids.map((id) => <li key={id}>{shortOf(src, id)}</li>) : <li className="is-empty">None selected</li>;
  return (
    <div className="bs-panel rq-summary" aria-live="polite">
      <p className="bs-panel-kicker">Design Requirements</p>
      <div><dt>Primary Objective</dt><dd>{shortOf(PRIMARY_OBJECTIVES, r.primary)}</dd></div>
      <div><dt>Scenario</dt><dd>{shortOf(SCENARIOS, r.scenario)}</dd></div>
      <div><dt>Constraints</dt><ul>{list(r.constraints, CONSTRAINTS)}</ul></div>
    </div>
  );
}
