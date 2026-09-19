'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONTENT } from '@/lib/content';

type SpeakState = 'idle' | 'speaking' | 'paused';
type RateOption = 0.75 | 1 | 1.25;

interface Props {
  /** Pre-rendered article body HTML (prose only). */
  html: string;
  /** Optional title spoken before the body for context. */
  title?: string;
}

const RATES: { value: RateOption; label: string }[] = [
  { value: 0.75, label: 'Slower' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Faster' },
];

const SKIP_SELECTOR = 'pre, code, nav, script, style, .code-block, .code-lang, .code-copy';

/**
 * Extract speakable prose from article HTML. Strips code blocks, inline
 * code, and UI chrome so the TTS voice only reads readable text.
 */
const extractSpeakableText = (html: string, title?: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll(SKIP_SELECTOR).forEach((el) => el.remove());
    const body = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    const head = title?.trim();
    if (head && body) return `${head}. ${body}`;
    return head || body;
  } catch {
    return title?.trim() ?? '';
  }
};

const pickEnglishVoice = (): SpeechSynthesisVoice | null => {
  try {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    if (!voices.length) return null;
    const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
    const pool = en.length ? en : voices;
    return (
      pool.find((v) => /en-US/i.test(v.lang) && /google|microsoft|samantha|alex|natural/i.test(v.name)) ||
      pool.find((v) => /en-US/i.test(v.lang)) ||
      pool.find((v) => /^en/i.test(v.lang)) ||
      pool[0] ||
      null
    );
  } catch {
    return null;
  }
};

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

/**
 * Browser Web Speech API "Listen" control for article pages.
 * Static-export friendly — no paid TTS backend.
 */
export const ArticleListen = ({ html, title }: Props) => {
  const labels = CONTENT.article.listen;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<SpeakState>('idle');
  const [rate, setRate] = useState<RateOption>(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const rateRef = useRef<RateOption>(1);
  const restartTimerRef = useRef<number | null>(null);

  const text = useMemo(() => extractSpeakableText(html, title), [html, title]);

  const cancelSpeech = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    utteranceRef.current = null;
    setState('idle');
  }, []);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';
    setSupported(ok);
    if (!ok) return;

    /* Warm the voice list (Chrome loads it async). */
    try {
      window.speechSynthesis.getVoices();
      const onVoices = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', onVoices);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', onVoices);
        cancelSpeech();
      };
    } catch {
      return () => cancelSpeech();
    }
  }, [cancelSpeech]);

  /* Always stop when leaving the article (unmount / route change). */
  useEffect(() => () => cancelSpeech(), [cancelSpeech]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  const start = useCallback(() => {
    if (!text || !supported) return;
    cancelSpeech();

    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rateRef.current;
      u.lang = 'en-US';
      const voice = pickEnglishVoice();
      if (voice) u.voice = voice;

      u.onstart = () => setState('speaking');
      u.onend = () => {
        utteranceRef.current = null;
        setState('idle');
      };
      u.onerror = () => {
        utteranceRef.current = null;
        setState('idle');
      };
      u.onpause = () => setState('paused');
      u.onresume = () => setState('speaking');

      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
      setState('speaking');
    } catch {
      setState('idle');
    }
  }, [text, supported, cancelSpeech]);

  const pause = useCallback(() => {
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setState('paused');
      }
    } catch {
      /* some browsers (notably older Safari) have flaky pause */
    }
  }, []);

  const resume = useCallback(() => {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setState('speaking');
      } else if (state === 'paused') {
        /* Fallback: restart if resume is a no-op */
        start();
      }
    } catch {
      start();
    }
  }, [state, start]);

  const stop = useCallback(() => {
    cancelSpeech();
  }, [cancelSpeech]);

  const onRateChange = (next: RateOption) => {
    setRate(next);
    rateRef.current = next;
    /* If currently speaking, restart at the new rate from the top —
       SpeechSynthesisUtterance.rate can't change mid-utterance reliably. */
    if (state === 'speaking' || state === 'paused') {
      cancelSpeech();
      /* Defer so cancel settles before a new speak() */
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        rateRef.current = next;
        start();
      }, 40);
    }
  };

  if (supported === null) {
    /* Avoid SSR/client flash: render nothing until we know. */
    return null;
  }

  if (!supported) {
    return (
      <div className="article-listen article-listen--unsupported" role="note">
        <span className="article-listen-note">{labels.unsupported}</span>
      </div>
    );
  }

  if (!text) return null;

  const isActive = state === 'speaking' || state === 'paused';
  const statusLabel =
    state === 'speaking' ? labels.reading : state === 'paused' ? labels.paused : '';

  return (
    <div className={`article-listen${isActive ? ' is-active' : ''}`}>
      <div className="article-listen-controls">
        {state === 'idle' && (
          <button
            type="button"
            className="article-listen-btn"
            data-cursor="hover"
            onClick={start}
            aria-label={labels.listen}
          >
            <SpeakerIcon />
            <span>{labels.listen}</span>
          </button>
        )}

        {state === 'speaking' && (
          <button
            type="button"
            className="article-listen-btn"
            data-cursor="hover"
            onClick={pause}
            aria-label={labels.pause}
            aria-pressed="true"
          >
            <PauseIcon />
            <span>{labels.pause}</span>
          </button>
        )}

        {state === 'paused' && (
          <button
            type="button"
            className="article-listen-btn"
            data-cursor="hover"
            onClick={resume}
            aria-label={labels.resume}
            aria-pressed="false"
          >
            <PlayIcon />
            <span>{labels.resume}</span>
          </button>
        )}

        {isActive && (
          <button
            type="button"
            className="article-listen-btn article-listen-btn--ghost"
            data-cursor="hover"
            onClick={stop}
            aria-label={labels.stop}
          >
            <StopIcon />
            <span>{labels.stop}</span>
          </button>
        )}

        <div className="article-listen-rates" role="group" aria-label={labels.rateGroup}>
          {RATES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`article-listen-rate${rate === opt.value ? ' is-selected' : ''}`}
              data-cursor="hover"
              onClick={() => onRateChange(opt.value)}
              aria-pressed={rate === opt.value}
              aria-label={`${labels.rateGroup}: ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <span className="article-listen-status" aria-live="polite" aria-atomic="true">
        {statusLabel}
      </span>
    </div>
  );
};
