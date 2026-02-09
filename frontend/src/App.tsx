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
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => setTheme(media.matches ? 'dark' : 'light');
    updateTheme();
    media.addEventListener('change', updateTheme);
    return () => media.removeEventListener('change', updateTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
