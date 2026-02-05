

export default function NotFound() {
  return (
    <div className="card">
      <div className="not-found">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Go Home
        </a>
      </div>
    </div>
  );
}