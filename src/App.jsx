/* ============================================================
   App.jsx — Root component.
   Routes: home | resume | blog | article/<slug> | contact
   ============================================================ */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#8345dd",
  "serifFont": "Instrument Serif",
  "density": "comfy",
  "heroVariant": "split",
  "monochromeMode": false
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  { label: 'Purple',  value: '#8345dd' },
  { label: 'Orange',  value: '#ff5b04' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Rose',    value: '#e11d48' },
  { label: 'Cobalt',  value: '#2563eb' },
];
const SERIF_OPTIONS = ['Instrument Serif', 'Playfair Display', 'Fraunces', 'Lora'];

/* ---------- Tweaks side effects ---------- */

const Tweaks = () => {
  const [tw, setTw] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary', tw.accent);
    document.documentElement.style.setProperty('--primary-hover', tw.accent);
    document.body.style.setProperty('--font-serif', `"${tw.serifFont}", Georgia, serif`);

    document.documentElement.style.filter = tw.monochromeMode ? 'grayscale(0.85)' : '';
    document.documentElement.style.setProperty('--maxw', tw.density === 'compact' ? '1080px' : '1240px');
  }, [tw]);

  // Lazy-load tweakable display fonts
  React.useEffect(() => {
    if (!document.querySelector(`link[data-tweakfont="${tw.serifFont}"]`)) {
      const family = tw.serifFont.replace(/ /g, '+');
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${family}:ital@0;1&display=swap`;
      l.dataset.tweakfont = tw.serifFont;
      document.head.appendChild(l);
    }
  }, [tw.serifFont]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent">
        <TweakRadio  value={tw.accent}      options={ACCENT_OPTIONS} onChange={(v) => setTw('accent', v)} />
      </TweakSection>
      <TweakSection label="Display Serif">
        <TweakSelect value={tw.serifFont}   options={SERIF_OPTIONS}  onChange={(v) => setTw('serifFont', v)} />
      </TweakSection>
      <TweakSection label="Density">
        <TweakRadio  value={tw.density}
                     options={[{ label: 'Compact', value: 'compact' }, { label: 'Comfy', value: 'comfy' }]}
                     onChange={(v) => setTw('density', v)} />
      </TweakSection>
      <TweakSection label="Effects">
        <TweakToggle label="Monochrome mode" value={tw.monochromeMode} onChange={(v) => setTw('monochromeMode', v)} />
      </TweakSection>
    </TweaksPanel>
  );
};

/* ---------- App root ---------- */

const App = () => {
  const { route, param } = useHashRoute();
  const [theme, setTheme] = useTheme();

  return (
    <>
      <Cursor />
      <div className="page-curtain" />
      <Nav route={route} theme={theme} setTheme={setTheme} />

      {route === 'home'    && <Home />}
      {route === 'resume'  && <ResumePage />}
      {route === 'blog'    && <BlogPage />}
      {route === 'article' && <ArticlePage slug={param} />}
      {route === 'contact' && <ContactPage />}

      <Tweaks />
    </>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
