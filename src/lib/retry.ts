export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error) => {
    // Retry on network errors and 5xx server errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }
    if (error instanceof Response) {
      return error.status >= 500;
    }
    return true;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelay
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function retryableFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(input, init);
    if (!response.ok && response.status >= 500) {
      throw response;
    }
    return response;
  }, retryOptions);
}
