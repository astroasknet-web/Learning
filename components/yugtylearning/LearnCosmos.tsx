import type { CSSProperties } from "react";
import { LEARN_FUEL, LEARN_GOALS, LEARN_LEGS } from "@/lib/yugtylearning/content";

/**
 * "Choose your mission" (Veloralearnupdate02). A learner picks a goal and a rocket flies through the four sections of that goal,
 * powered by online courses, live classes, e-books and mock tests, up to a goal star that opens doors. public/yugtylearning/learn-cosmos.js
 * drives it; without scripts it shows the finished IELTS mission. Start and target scores are illustrative samples.
 */

const PLANETS = [
  { x: 27, y: 58, c: "#4d8bff" },
  { x: 44, y: 32, c: "#2fe3a0" },
  { x: 62, y: 54, c: "#c08bff" },
  { x: 77, y: 28, c: "#ff3d9a" },
];
const PAD = { x: 9, y: 80 };
const GOAL = { x: 91, y: 12 };
const ROCKET = [
  { x: PAD.x, y: PAD.y - 6 },
  ...PLANETS.map((p) => ({ x: p.x, y: p.y - 9 })),
  { x: GOAL.x - 1, y: GOAL.y + 8 },
];
const WARP = Array.from({ length: 14 }, (_, i) => ({ top: `${(i * 37) % 96}%`, d: `${(i % 7) * 0.09}s`, w: `${30 + ((i * 13) % 40)}%` }));

export default function LearnCosmos() {
  const g = LEARN_GOALS[0];
  const fmt = (v: number) => v.toFixed(g.decimals) + g.suffix;
  const path = `M${PAD.x} ${PAD.y} L${PLANETS.map((p) => `${p.x} ${p.y}`).join(" L")} L${GOAL.x} ${GOAL.y}`;
  return (
    <div className="lx s0 s1 s2 s3 s4 s5" data-lx data-goals={JSON.stringify(LEARN_GOALS)} data-fuel={JSON.stringify(LEARN_FUEL)} data-legs={JSON.stringify(LEARN_LEGS)} data-pos={JSON.stringify(ROCKET)} data-nodes={JSON.stringify([PAD, ...PLANETS, GOAL])} role="group" aria-label="Choose a goal and watch a rocket climb to it, powered by YugtyLearning. Illustrative.">
      <div className="lx-goals" role="group" aria-label="Choose your mission">
        <span>MISSION</span>
        {LEARN_GOALS.map((x) => (
          <button key={x.id} type="button" data-lx-goal={x.id} aria-pressed={x.id === g.id}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="lx-scene">
        <div className="lx-space" aria-hidden="true">
          <i className="n1" />
          <i className="n2" />
          <i className="stars a" />
          <i className="stars b" />
        </div>
        <svg className="lx-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={path} className="base" pathLength="100" />
          <path d={path} className="fill" pathLength="100" data-lx-trail />
        </svg>
        <div className="lx-warp" aria-hidden="true">
          {WARP.map((w, i) => (
            <i key={i} style={{ top: w.top, "--d": w.d, width: w.w } as CSSProperties} />
          ))}
        </div>

        <div className="lx-score">
          <small data-lx-metric>{g.label.toUpperCase()} {g.metric}</small>
          <p>
            <b data-lx-score>{fmt(g.end)}</b>
          </p>
          <span data-lx-range>
            from {fmt(g.start)} (sample)
          </span>
          <div className="lx-bar">
            <i data-lx-bar style={{ width: "100%" }} />
          </div>
        </div>

        <div className="lx-pad" style={{ left: `${PAD.x}%`, top: `${PAD.y}%` }} aria-hidden="true">
          <i />
          <small>START</small>
        </div>

        {PLANETS.map((p, k) => (
          <div key={k} className="lx-planet on" data-lx-planet style={{ left: `${p.x}%`, top: `${p.y}%`, "--pc": p.c } as CSSProperties}>
            <i aria-hidden="true" />
            <em aria-hidden="true" />
            <b data-lx-sec>{g.sections[k]}</b>
            <ul className="lx-uses" aria-hidden="true">
              {LEARN_LEGS[k].map((f) => (
                <li key={f}>{LEARN_FUEL[f]}</li>
              ))}
            </ul>
          </div>
        ))}

        <div className="lx-goalstar on" style={{ left: `${GOAL.x}%`, top: `${GOAL.y}%` }}>
          <i aria-hidden="true" />
          <em aria-hidden="true" />
          <b>GOAL</b>
        </div>

        <ul className="lx-doors" aria-label="Doors the goal can open">
          {g.doors.map((d) => (
            <li key={d} className="on" data-lx-door>
              <i aria-hidden="true" />
              {d}
            </li>
          ))}
        </ul>

        <div className="lx-rocket" data-lx-rocket style={{ left: `${ROCKET[5].x}%`, top: `${ROCKET[5].y}%` }} aria-hidden="true">
          <svg viewBox="0 0 40 80">
            <path className="flame" d="M14 58c2 10 4 18 6 22 2-4 4-12 6-22Z" />
            <path className="fin" d="M10 46 2 62l10-4ZM30 46l8 16-10-4Z" />
            <path className="body" d="M20 2c8 8 11 22 9 50H11C9 24 12 10 20 2Z" />
            <circle className="win" cx="20" cy="26" r="5" />
          </svg>
        </div>
        <div className="lx-count" aria-hidden="true">
          <span>3</span>
          <span>2</span>
          <span>1</span>
          <span>LIFT-OFF</span>
        </div>
        <i className="lx-burst" data-lx-burst aria-hidden="true" />
      </div>

      <ul className="lx-fuel" aria-label="What powers the flight">
        {LEARN_FUEL.map((f) => (
          <li key={f} className="on">
            {f}
          </li>
        ))}
      </ul>
      <p className="lx-now" data-lx-now aria-live="polite">
        {g.label} {g.metric.toLowerCase()} {fmt(g.end)}. {g.doors.join(", ")} come into reach.
      </p>
      <ol className="lx-steps">
        {["Launch", ...g.sections, "Goal"].map((s, i) => (
          <li key={i}>
            <button type="button" data-lx-step data-i={i} className={i === 5 ? "on" : "past"}>
              <b>{i + 1}</b>
              <span data-lx-steplabel>{s}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="lx-note">
        <span>A sample mission. Start and target scores are illustrative, not results.</span>
        <button type="button" data-lx-pause className="hq-pause" aria-pressed="false">
          Pause
        </button>
      </p>
    </div>
  );
}
