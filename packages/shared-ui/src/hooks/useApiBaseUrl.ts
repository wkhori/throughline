import { createContext, useContext } from 'react';

const ApiBaseUrlContext = createContext<string | null>(null);

export const ApiBaseUrlProvider = ApiBaseUrlContext.Provider;

export const useApiBaseUrl = (): string => {
  const v = useContext(ApiBaseUrlContext);
  if (!v) throw new Error('ApiBaseUrlProvider missing — wrap the remote in <ApiBaseUrlProvider value={...}>');
  return v;
};
