export default function NotFound() {
  return (
    <section className="state-card view-layout reveal delay-2">
      <div className="not-found">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    </section>
  );
}
