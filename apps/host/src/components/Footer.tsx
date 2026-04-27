import { Link } from 'react-router-dom';
import { Logo } from '@throughline/shared-ui';

export function Footer() {
  return (
    <footer className="border-t border-(--color-hero-border) bg-(--color-shell-bg)">
      <div className="mx-auto flex max-w-300 flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center lg:px-10">
        <div className="flex items-center gap-3 text-(--color-shell-text)">
          <Logo size={20} showWordmark={false} />
          <span className="text-sm font-semibold tracking-tight">Throughline</span>
          <span className="ml-2 text-xs text-(--color-hero-muted)">
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
