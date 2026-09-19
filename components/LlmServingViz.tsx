'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type StageId = 'request' | 'prefill' | 'decode' | 'reuse';

interface Stage {
  id: StageId;
  label: string;
  detail: string;
  consoleLines: { kind: 'in' | 'sys' | 'out' | 'ok'; text: string }[];
}

const STAGES: Stage[] = [
  {
    id: 'request',
    label: 'Prompt arrives',
    detail: 'Chat UI posts to the model server. Weights stay warm in VRAM.',
    consoleLines: [
      { kind: 'in', text: 'POST /v1/chat/completions  stream=true' },
      { kind: 'sys', text: 'route → pod-a (vLLM)  conversation=c7f2' },
    ],
  },
  {
    id: 'prefill',
    label: 'Prefill (pause)',
    detail: 'Read the full prompt and build KV state before the first token.',
    consoleLines: [
      { kind: 'sys', text: 'prefill  tokens_in=412  building KV…' },
      { kind: 'sys', text: 'ttft waiting…' },
    ],
  },
  {
    id: 'decode',
    label: 'Decode (stream)',
    detail: 'Tokens stream out one by one while the KV scratchpad grows.',
    consoleLines: [
      { kind: 'out', text: 'KV-cache is like Redis for' },
      { kind: 'out', text: 'conversation state—' },
      { kind: 'out', text: 'reuse beats recomputing.' },
    ],
  },
  {
    id: 'reuse',
    label: 'Cache reused',
    detail: 'Follow-up sticks to the cache-hot pod; only the new turn is prefills.',
    consoleLines: [
      { kind: 'in', text: 'user: “give a WordPress analogy”' },
      { kind: 'ok', text: 'KV hit on pod-a  Δprefill=new turn only' },
      { kind: 'out', text: 'Think object cache + sticky session…' },
    ],
  },
];

const FLOW_NODES = [
  { id: 'chat', label: 'Chat request' },
  { id: 'server', label: 'Model server' },
  { id: 'prefill', label: 'Prefill' },
  { id: 'kv', label: 'KV-cache' },
  { id: 'decode', label: 'Decode' },
  { id: 'response', label: 'Response' },
] as const;

/** Map animation stage → which flow nodes should light up. */
const STAGE_FLOW_ACTIVE: Record<StageId, string[]> = {
  request: ['chat', 'server'],
  prefill: ['server', 'prefill', 'kv'],
  decode: ['kv', 'decode', 'response'],
  reuse: ['chat', 'server', 'kv', 'decode', 'response'],
};

const STAGE_MS = 2600;
const LOOP_PAUSE_MS = 900;

/**
 * Teaching visual for the LLM serving article: a static-friendly flow
 * diagram plus a compact “mini console” that steps through request →
 * prefill → decode → KV reuse. Mounted only on that article page.
 */
export const LlmServingViz = () => {
  const labelId = useId();
  const statusId = useId();
  const [stageIndex, setStageIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [typedOut, setTypedOut] = useState('');
  const timerRef = useRef<number | null>(null);
  const typeRef = useRef<number | null>(null);

  const stage = STAGES[stageIndex];
  const activeNodes = STAGE_FLOW_ACTIVE[stage.id];

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const reduce = mq.matches;
      setReducedMotion(reduce);
      if (reduce) setPlaying(false);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typeRef.current != null) {
      window.clearInterval(typeRef.current);
      typeRef.current = null;
    }
  }, []);

  /* Typewriter for decode/out lines — skipped under reduced motion. */
  useEffect(() => {
    clearTimers();
    const outLines = stage.consoleLines.filter((l) => l.kind === 'out');
    const full = outLines.map((l) => l.text).join(' ');

    if (!full || reducedMotion || !playing) {
      setTypedOut(full);
      return;
    }

    setTypedOut('');
    let i = 0;
    typeRef.current = window.setInterval(() => {
      i += 1;
      setTypedOut(full.slice(0, i));
      if (i >= full.length && typeRef.current != null) {
        window.clearInterval(typeRef.current);
        typeRef.current = null;
      }
    }, 28);

    return clearTimers;
  }, [stage, playing, reducedMotion, clearTimers]);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const delay = stageIndex === STAGES.length - 1 ? STAGE_MS + LOOP_PAUSE_MS : STAGE_MS;
    timerRef.current = window.setTimeout(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, delay);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [playing, reducedMotion, stageIndex]);

  const togglePlay = () => {
    if (reducedMotion) {
      setStageIndex((i) => (i + 1) % STAGES.length);
      return;
    }
    setPlaying((p) => !p);
  };

  const goTo = (index: number) => {
    setStageIndex(index);
    if (!reducedMotion) setPlaying(true);
  };

  return (
    <section
      className="llm-viz"
      aria-labelledby={labelId}
      data-stage={stage.id}
      data-playing={playing && !reducedMotion ? 'true' : 'false'}
    >
      <header className="llm-viz-head">
        <div>
          <p className="llm-viz-eyebrow">Request path</p>
          <h2 id={labelId} className="llm-viz-title">
            From Send to streamed tokens
          </h2>
        </div>
        <p className="llm-viz-lede">
          One conversation turn on a warm model server — then why the next turn
          should hit the same cache-hot pod.
        </p>
      </header>

      {/* ---- Flow diagram ---- */}
      <div className="llm-viz-flow" role="img" aria-label="Flow: Chat request to model server, prefill, KV-cache, decode stream, response. Parallel lane: batching and smart routing back to a cache-hot pod.">
        <ol className="llm-viz-lane llm-viz-lane--main">
          {FLOW_NODES.map((node, i) => (
            <li
              key={node.id}
              className={
                'llm-viz-node' +
                (activeNodes.includes(node.id) ? ' is-active' : '') +
                (node.id === 'kv' ? ' llm-viz-node--cache' : '')
              }
            >
              <span className="llm-viz-node-label">{node.label}</span>
              {i < FLOW_NODES.length - 1 && (
                <span className="llm-viz-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="llm-viz-lane llm-viz-lane--side" aria-hidden="true">
          <span className="llm-viz-side-label">Also on the GPU</span>
          <div className="llm-viz-side-row">
            <span className="llm-viz-chip">Multi-user batching</span>
            <span className="llm-viz-arrow">→</span>
            <span className="llm-viz-chip llm-viz-chip--accent">Smart routing</span>
            <span className="llm-viz-arrow">→</span>
            <span className={'llm-viz-chip llm-viz-chip--hot' + (stage.id === 'reuse' ? ' is-active' : '')}>
              Cache-hot pod
            </span>
          </div>
        </div>
      </div>

      {/* ---- Mini console ---- */}
      <div className="llm-viz-console" aria-describedby={statusId}>
        <div className="llm-viz-console-bar">
          <span className="llm-viz-console-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="llm-viz-console-title">mini console · serving path</span>
          <div className="llm-viz-console-actions">
            <button
              type="button"
              className="llm-viz-btn"
              onClick={togglePlay}
              aria-pressed={playing && !reducedMotion}
              aria-label={
                reducedMotion
                  ? 'Show next stage'
                  : playing
                    ? 'Pause animation'
                    : 'Play animation'
              }
            >
              {reducedMotion ? 'Next' : playing ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>

        <ol className="llm-viz-steps" aria-label="Serving stages">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={'llm-viz-step' + (i === stageIndex ? ' is-current' : '')}
                onClick={() => goTo(i)}
                aria-current={i === stageIndex ? 'step' : undefined}
              >
                <span className="llm-viz-step-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="llm-viz-step-label">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="llm-viz-panel" aria-live="polite">
          <p id={statusId} className="llm-viz-status">
            <span className="llm-viz-status-label">{stage.label}</span>
            <span className="llm-viz-status-detail">{stage.detail}</span>
          </p>

          <div className="llm-viz-term" role="log" aria-label="Console output for current stage">
            {stage.consoleLines.map((line, idx) => {
              if (line.kind === 'out') return null;
              return (
                <div key={idx} className={`llm-viz-line llm-viz-line--${line.kind}`}>
                  <span className="llm-viz-line-tag">
                    {line.kind === 'in' ? '›' : line.kind === 'ok' ? '✓' : '·'}
                  </span>
                  <span>{line.text}</span>
                </div>
              );
            })}
            {(typedOut || stage.consoleLines.some((l) => l.kind === 'out')) && (
              <div className="llm-viz-line llm-viz-line--out">
                <span className="llm-viz-line-tag">◀</span>
                <span>
                  {typedOut}
                  {playing && !reducedMotion && typedOut.length > 0 && typedOut.length < stage.consoleLines.filter((l) => l.kind === 'out').map((l) => l.text).join(' ').length && (
                    <span className="llm-viz-caret" aria-hidden="true" />
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="llm-viz-footnote">
        Prefill builds the scratchpad; decode streams tokens; sticky routing keeps the next turn on the pod that already holds that KV-cache.
      </p>
    </section>
  );
};
