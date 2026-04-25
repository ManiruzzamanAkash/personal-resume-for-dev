'use client';

import { useState } from 'react';

const buildContribGrid = (): number[] => {
  const cells: number[] = [];
  for (let i = 0; i < 53 * 7; i++) {
    const r = Math.random();
    let lvl = 0;
    if (r > 0.55) lvl = 1;
    if (r > 0.75) lvl = 2;
    if (r > 0.88) lvl = 3;
    if (r > 0.96) lvl = 4;
    const day = i % 7;
    if (day === 0 || day === 6) lvl = Math.max(0, lvl - 1);
    cells.push(lvl);
  }
  return cells;
};

export const ContribGrid = () => {
  /* Lazy init keeps the random grid stable across re-renders. */
  const [cells] = useState(buildContribGrid);

  return (
    <>
      <div className="contrib-grid">
        {cells.map((lvl, i) => (
          <div
            key={i}
            className={`contrib-cell ${lvl ? 'l' + lvl : ''}`}
            style={{ animation: `fadeIn 0.6s ${(i % 53) * 8}ms both` }}
          />
        ))}
      </div>
      <div className="contrib-legend">
        <span>Less</span>
        <div className="scale">
          <span style={{ background: 'var(--muted-2)' }} />
          <span style={{ background: 'color-mix(in srgb, var(--primary) 25%, var(--muted-2))' }} />
          <span style={{ background: 'color-mix(in srgb, var(--primary) 50%, var(--muted-2))' }} />
          <span style={{ background: 'color-mix(in srgb, var(--primary) 75%, var(--muted-2))' }} />
          <span style={{ background: 'var(--primary)' }} />
        </div>
        <span>More</span>
      </div>
    </>
  );
};
