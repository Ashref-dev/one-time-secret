import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import './styles.css';

import CreateSecret from './pages/CreateSecret';
import NotFound from './pages/NotFound';
import ViewSecret from './pages/ViewSecret';

type Theme = 'light' | 'dark';
const THEME_KEY = 'theme';

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const htmlTheme = document.documentElement.getAttribute('data-theme');
  if (htmlTheme === 'light' || htmlTheme === 'dark') {
    return htmlTheme;
  }

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.75V5.25M12 18.75V21.25M2.75 12H5.25M18.75 12H21.25M5.45 5.45L7.2 7.2M16.8 16.8L18.55 18.55M16.8 7.2L18.55 5.45M5.45 18.55L7.2 16.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.2 14.15A8.8 8.8 0 1 1 9.85 3.8 7 7 0 1 0 20.2 14.15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

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

            <nav className="nav" aria-label="Primary navigation">
              <a href="#why">Why</a>
              <a href="#security">Security</a>
              <a href="#flow">Flow</a>
              <a href="#agents">Agents</a>
            </nav>

            <div className="header-controls">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                aria-pressed={theme === 'dark'}
              >
                <span className="theme-icon" aria-hidden="true">
                  {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                </span>
                <span className="theme-copy">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </button>

              <details className="about-menu">
                <summary>About</summary>
                <div className="about-panel">
                  <p>
                    One-time secret sharing with client-side encryption. Secrets are burned after viewing.
                  </p>
                  <p>
                    Share the link and passphrase separately for the strongest protection.
                  </p>
                  <p>
                    Agent instructions live at <a href="/agents.txt">/agents.txt</a>.
                  </p>
                  <p className="about-signature">built by ashref.tn</p>
                </div>
              </details>
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
    </div>
  );
}

export default App;
