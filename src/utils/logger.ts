/**
 * Centralized logging utility
 * Automatically disables debug logs in production
 */

const isDevelopment = import.meta.env.DEV;

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const noop = () => {};

const createLogger = (): Logger => {
  return {
    debug: isDevelopment ? console.log.bind(console, "[DEBUG]") : noop,
    info: isDevelopment ? console.info.bind(console, "[INFO]") : noop,
    warn: console.warn.bind(console, "[WARN]"),
    error: console.error.bind(console, "[ERROR]"),
  };
};

export const logger = createLogger();

export default logger;
