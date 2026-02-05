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
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <span className="logo-icon">🔐</span>
              <span className="logo-text">OTS</span>
            </div>
            <nav className="nav">
              <button 
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Routes>
            <Route path="/" element={<CreateSecret />} />
            <Route path="/s/:id" element={<ViewSecret />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p className="footer-text">
            Secure one-time secret sharing. Secrets are encrypted in your browser and can only be viewed once.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;