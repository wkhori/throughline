import { Link } from 'react-router-dom';

const REMOTE_APP_URL = 'https://weekly-commit-remote-production.up.railway.app/';

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-(--color-hero-border) bg-(--color-shell-bg)/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-300 items-center justify-between px-6 lg:px-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-(--color-shell-text) transition-opacity hover:opacity-80"
          aria-label="Throughline home"
        >
          <Logomark />
          <span className="text-base font-semibold tracking-tight">Throughline</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-6">
          <Link
            to="/architecture"
            className="hidden text-sm font-medium text-(--color-hero-text) transition-colors hover:text-(--color-shell-text) sm:inline"
          >
            Architecture
          </Link>
          <a
            href={REMOTE_APP_URL}
            className="inline-flex items-center rounded-md bg-(--color-shell-text) px-3.5 py-2 text-sm font-medium text-(--color-shell-bg) shadow-sm transition-opacity hover:opacity-90"
          >
            Launch demo
          </a>
        </div>
      </nav>
    </header>
  );
}

function Logomark() {
  return (
    <svg
      width="22"
      height="22"
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
  );
}
