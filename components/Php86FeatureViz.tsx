'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type TabId = 'features' | 'deprecations' | 'session';

interface Tab {
  id: TabId;
  label: string;
  blurb: string;
  bullets: string[];
}

const TABS: Tab[] = [
  {
    id: 'features',
    label: 'Features',
    blurb: 'Small surface: PFA is the headline; stdlib polish fills the gaps.',
    bullets: [
      'Partial Function Application — ? and ... placeholders',
      'Works cleanly with pipe (|>) for unary stages',
      'clamp(), SortDirection, Time\\Duration',
      '#[\\Override] on constants / enum cases; grapheme_strrev; Io\\Poll',
    ],
  },
  {
    id: 'deprecations',
    label: 'Deprecations',
    blurb: '8.6 warns so PHP 9 can remove. Clean these before the major.',
    bullets: [
      'mb_ereg family (Oniguruma unmaintained → PHP 9 removal)',
      'Return values from __construct / __destruct',
      'Return from finally blocks',
      'Aliases: is_double / is_long → is_float / is_int; spl_object_hash → spl_object_id',
    ],
  },
  {
    id: 'session',
    label: 'Session defaults',
    blurb: 'Silent breakage risk for SSO and payment callbacks — nothing throws.',
    bullets: [
      'session.use_strict_mode: 0 → 1',
      'session.cookie_httponly: 0 → 1',
      'session.cookie_samesite: (empty) → Lax',
      'Cross-site POSTs may drop the session cookie unless you opt into None+Secure',
    ],
  },
];

interface Stage {
  id: string;
  label: string;
  detail: string;
  code: string;
}

const PFA_STAGES: Stage[] = [
  {
    id: 'wrapper',
    label: 'Arrow wrapper',
    detail: 'Classic array_map callback — correct, noisy, easy to mistype types.',
    code: `array_map(
  static fn (string $s): string =>
    str_replace(' ', '-', $s),
  $titles
);`,
  },
  {
    id: 'partial',
    label: 'PFA partial',
    detail: 'str_replace pre-filled; ? holds the per-item string. One placeholder, no arrow.',
    code: `array_map(
  str_replace(' ', '-', ?),
  $titles
);`,
  },
  {
    id: 'pipe',
    label: 'Pipe + PFA',
    detail: 'Slug pipeline as unary stages — trim → lower → dashes → safe chars.',
    code: `$slug = $raw
  |> trim(?)
  |> strtolower(?)
  |> str_replace(' ', '-', ?)
  |> preg_replace('/[^a-z0-9-]+/', '', ?);`,
  },
  {
    id: 'thunk',
    label: 'Eager fill note',
    detail: 'Filled args evaluate when the partial is created — unlike an arrow body.',
    code: `// getArg() runs NOW, not at call time
$partial = speak(?, getArg());
$partial('Larry');`,
  },
];

const STAGE_MS = 2800;
const LOOP_PAUSE_MS = 1000;

/**
 * Teaching visual for the PHP 8.6 article: tabs for Features /
 * Deprecations / Session defaults, plus a PFA playground stepper.
 * Mounted only on that article page.
 */
export const Php86FeatureViz = () => {
  const labelId = useId();
  const statusId = useId();
  const [tab, setTab] = useState<TabId>('features');
  const [stageIndex, setStageIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<number | null>(null);

  const stage = PFA_STAGES[stageIndex];
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

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
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion || tab !== 'features') return;
    const delay =
      stageIndex === PFA_STAGES.length - 1 ? STAGE_MS + LOOP_PAUSE_MS : STAGE_MS;
    timerRef.current = window.setTimeout(() => {
      setStageIndex((i) => (i + 1) % PFA_STAGES.length);
    }, delay);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [playing, reducedMotion, stageIndex, tab]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const togglePlay = () => {
    if (reducedMotion) {
      setStageIndex((i) => (i + 1) % PFA_STAGES.length);
      return;
    }
    setPlaying((p) => !p);
  };

  const goTo = (index: number) => {
    setStageIndex(index);
    if (!reducedMotion && tab === 'features') setPlaying(true);
  };

  const onTab = (id: TabId) => {
    setTab(id);
    if (id !== 'features') {
      setPlaying(false);
      clearTimers();
    } else if (!reducedMotion) {
      setPlaying(true);
    }
  };

  return (
    <section
      className="php86-viz"
      aria-labelledby={labelId}
      data-tab={tab}
      data-stage={stage.id}
      data-playing={playing && !reducedMotion && tab === 'features' ? 'true' : 'false'}
    >
      <header className="php86-viz-head">
        <div>
          <p className="php86-viz-eyebrow">PHP 8.6 map</p>
          <h2 id={labelId} className="php86-viz-title">
            Features, deprecations, and session defaults
          </h2>
        </div>
        <p className="php86-viz-lede">
          Small release surface — heavy prep for PHP 9. Tab the themes, then step a
          Partial Function Application refactor.
        </p>
      </header>

      <div className="php86-viz-tabs" role="tablist" aria-label="PHP 8.6 themes">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`php86-tab-${t.id}`}
            className={'php86-viz-tab' + (tab === t.id ? ' is-active' : '')}
            aria-selected={tab === t.id}
            aria-controls={`php86-panel-${t.id}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="php86-viz-panel-tab"
        role="tabpanel"
        id={`php86-panel-${activeTab.id}`}
        aria-labelledby={`php86-tab-${activeTab.id}`}
      >
        <p className="php86-viz-tab-blurb">{activeTab.blurb}</p>
        <ul className="php86-viz-bullets">
          {activeTab.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>

      {tab === 'features' && (
        <div className="php86-viz-console" aria-describedby={statusId}>
          <div className="php86-viz-console-bar">
            <span className="php86-viz-console-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="php86-viz-console-title">playground · PFA stepper</span>
            <div className="php86-viz-console-actions">
              <button
                type="button"
                className="php86-viz-btn"
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

          <ol className="php86-viz-steps" aria-label="PFA transformation stages">
            {PFA_STAGES.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={'php86-viz-step' + (i === stageIndex ? ' is-current' : '')}
                  onClick={() => goTo(i)}
                  aria-current={i === stageIndex ? 'step' : undefined}
                >
                  <span className="php86-viz-step-index">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="php86-viz-step-label">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="php86-viz-stage" aria-live="polite">
            <p id={statusId} className="php86-viz-status">
              <span className="php86-viz-status-label">{stage.label}</span>
              <span className="php86-viz-status-detail">{stage.detail}</span>
            </p>
            <pre className="php86-viz-code">
              <code>{stage.code}</code>
            </pre>
          </div>
        </div>
      )}

      {tab === 'session' && (
        <div className="php86-viz-session" role="img" aria-label="Session default flips in PHP 8.6">
          <div className="php86-viz-session-row">
            <span className="php86-viz-chip">use_strict_mode=1</span>
            <span className="php86-viz-chip">cookie_httponly=1</span>
            <span className="php86-viz-chip php86-viz-chip--warn">cookie_samesite=Lax</span>
          </div>
          <p className="php86-viz-session-note">
            Test payment return URLs and SSO POSTs on staging before GA day.
          </p>
        </div>
      )}

      <p className="php86-viz-footnote">
        GA targeted ~19 Nov 2026. Upgrade is an afternoon; deprecation cleanup is the PHP 9
        project.
      </p>
    </section>
  );
};
