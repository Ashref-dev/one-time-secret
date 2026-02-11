import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles.css';

// Pages
import CreateSecret from './pages/CreateSecret';
import ViewSecret from './pages/ViewSecret';
import NotFound from './pages/NotFound';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => setTheme(media.matches ? 'dark' : 'light');
    updateTheme();
    media.addEventListener('change', updateTheme);
    return () => media.removeEventListener('change', updateTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <span className="logo-dot" aria-hidden="true" />
              <span className="logo-text">ots.ashref.tn</span>
            </div>
            <nav className="nav">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                aria-pressed={theme === 'dark'}
              >
                <span className="theme-label">Theme</span>
                <span className="theme-state">{theme === 'light' ? 'Light' : 'Dark'}</span>
                <span className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} aria-hidden="true" />
              </button>
              <details className="about-menu">
                <summary>About</summary>
                <div className="about-panel">
                  <p>
                    One-time secret sharing with client-side encryption. Secrets are deleted after viewing.
                  </p>
                  <p className="about-muted">
                    Keep the link and passphrase separate for maximum safety.
                  </p>
                  <p className="about-muted">
                    made by ashref.tn
                  </p>
                </div>
              </details>
            </nav>
          </div>
        </div>
      </header>

      <main id="main" className="main">
        <div className="container">
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
