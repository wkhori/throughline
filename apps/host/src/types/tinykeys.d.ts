// Ambient module declaration for tinykeys — the package's `exports` map omits the .d.ts file
// so TypeScript can't resolve the bundled types. We declare the minimal API the host uses.

declare module 'tinykeys' {
  type KeyHandler = (event: KeyboardEvent) => void;
  type KeyBindingMap = Record<string, KeyHandler>;
  export function tinykeys(
    target: Window | HTMLElement,
    keyBindingMap: KeyBindingMap,
    options?: { event?: 'keydown' | 'keyup'; capture?: boolean; timeout?: number },
  ): () => void;
}
