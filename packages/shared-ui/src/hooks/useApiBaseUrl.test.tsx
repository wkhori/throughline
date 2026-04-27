import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { ApiBaseUrlProvider, useApiBaseUrl } from './useApiBaseUrl.js';

describe('useApiBaseUrl', () => {
  it('returns the configured base URL', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiBaseUrlProvider value="http://api.local">{children}</ApiBaseUrlProvider>
    );
    const { result } = renderHook(() => useApiBaseUrl(), { wrapper });
    expect(result.current).toBe('http://api.local');
  });

  it('throws when provider is missing', () => {
    expect(() => renderHook(() => useApiBaseUrl())).toThrow(/ApiBaseUrlProvider missing/);
  });
});
