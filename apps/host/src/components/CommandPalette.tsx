import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { tinykeys } from 'tinykeys';

// Phase 7 polish — keyboard-driven command palette. Toggle with ⌘K / Ctrl+K. Items are static
// for the demo (open dashboard / draft week / admin / sign out); future iterations can wire them
// to recent commits / search / etc.
//
// Visible-only on supplied actions; the host shell consumes <CommandPalette> once per app and
// passes role-aware actions in. Closed state renders nothing — palette is invisible by default.

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  perform: () => void;
}

interface CommandPaletteProps {
  actions: CommandAction[];
}

export function CommandPalette({ actions }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = tinykeys(window, {
      '$mod+KeyK': (event: KeyboardEvent) => {
        event.preventDefault();
        setOpen((p) => !p);
      },
      Escape: () => setOpen(false),
    });
    return () => unsub();
  }, []);

  if (!open) return null;

  return (
    <div
      data-testid="command-palette"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-150 max-w-full overflow-hidden rounded-lg border border-(--commit-border) bg-(--commit-bg) shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Throughline command palette"
          className="text-(--commit-text)"
          shouldFilter
        >
          <Command.Input
            placeholder="Type a command…"
            className="w-full border-b border-(--commit-border) bg-transparent px-4 py-3 text-sm outline-hidden placeholder:text-(--commit-muted)"
          />
          <Command.List className="max-h-80 overflow-auto p-1">
            <Command.Empty className="px-4 py-3 text-xs text-(--commit-muted)">
              No matching commands.
            </Command.Empty>
            {actions.map((action) => (
              <Command.Item
                key={action.id}
                data-testid={`palette-item-${action.id}`}
                value={`${action.id} ${action.label} ${action.hint ?? ''}`}
                onSelect={() => {
                  action.perform();
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-(--commit-text) data-[selected=true]:bg-(--badge-bg)"
              >
                <span>{action.label}</span>
                {action.hint ? (
                  <span className="text-xs text-(--commit-muted)">{action.hint}</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
