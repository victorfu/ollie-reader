// The web logger uses Vite's import.meta.env; keep the server logger Node-only.
export const logger = {
  error: (message: string) => console.error(`[ETTS] ${message}`),
};
