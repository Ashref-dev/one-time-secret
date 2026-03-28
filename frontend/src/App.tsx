import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import './styles.css';

import CreateSecret from './pages/CreateSecret';
import NotFound from './pages/NotFound';
import ViewSecret from './pages/ViewSecret';

function App() {
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'system' | 'light' | 'dark') || 'system';
  });
  const [iconAnimating, setIconAnimating] = useState(false);

  const THEME_ICONS: Record<string, string> = { system: '◐', light: '☀', dark: '●' };
  const THEME_LABELS: Record<string, string> = { system: 'System', light: 'Light', dark: 'Dark' };
  const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];

  const getActiveTheme = (mode: 'system' | 'light' | 'dark'): 'light' | 'dark' => {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  };

  const toggleTheme = () => {
    setIconAnimating(true);
    setTimeout(() => {
      const idx = THEME_CYCLE.indexOf(themeMode);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      setThemeMode(next);
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', getActiveTheme(next));
      setIconAnimating(false);
    }, 150);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', getActiveTheme(themeMode));
  }, [themeMode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (themeMode === 'system') {
        document.documentElement.setAttribute('data-theme', media.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [themeMode]);

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <div className="backdrop-orb orb-1" />
        <div className="backdrop-orb orb-2" />
        <div className="backdrop-grid" />
      </div>

      <a href="#main" className="skip-link">Skip to content</a>

      <header className="header">
        <div className="shell">
          <div className="header-surface reveal delay-1">
            <a href="/" className="brand" aria-label="ots.ashref.tn home">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-text">ots.ashref.tn</span>
            </a>

            <div className="header-controls">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
              >
                <span className={`theme-toggle-icon${iconAnimating ? ' animating' : ''}`} aria-hidden="true">
                  {THEME_ICONS[themeMode]}
                </span>
                <span className="theme-toggle-label">{THEME_LABELS[themeMode]}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="main">
        <div className="shell">
          <Routes>
            <Route path="/" element={<CreateSecret />} />
            <Route path="/s/:id" element={<ViewSecret />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <footer className="site-footer">
        <div className="shell">
          <p>Made by <a href="https://ashref.tn" target="_blank" rel="noopener">ashref.tn</a></p>
        </div>
      </footer>
    </div>
  );
}

export default App;
