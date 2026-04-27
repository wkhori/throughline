import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-(--color-hero-border) bg-(--color-shell-bg)">
      <div className="mx-auto flex max-w-300 flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center lg:px-10">
        <div className="flex items-center gap-2 text-(--color-shell-text)">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4 L12 12 L4 20" />
            <path d="M12 12 L20 12" />
          </svg>
          <span className="text-sm font-semibold tracking-tight">Throughline</span>
          <span className="ml-3 text-xs text-(--color-hero-muted)">
            &copy; {new Date().getFullYear()}
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-(--color-hero-text)">
          <Link to="/architecture" className="hover:text-(--color-shell-text)">
            Architecture
          </Link>
          <a
            href="https://weekly-commit-remote-production.up.railway.app/"
            className="hover:text-(--color-shell-text)"
          >
            Demo
          </a>
        </nav>
      </div>
    </footer>
  );
}
