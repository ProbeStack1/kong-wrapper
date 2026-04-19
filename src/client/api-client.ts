import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

const RETRYABLE_ERROR_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNABORTED",
]);

function getTimeoutMs(): number {
  return Number(process.env.REQUEST_TIMEOUT_MS ?? 10000);
}

function getRetryCount(): number {
  return Number(process.env.AXIOS_RETRY_COUNT ?? 2);
}

function getRetryDelayMs(): number {
  return Number(process.env.AXIOS_RETRY_DELAY_MS ?? 300);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function withDefaultHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
  const authHeader = process.env.KONNECT_PAT
    ? { Authorization: `Bearer ${process.env.KONNECT_PAT}` }
    : {};

  return {
    timeout: getTimeoutMs(),
    ...config,
    headers: {
      ...authHeader,
      ...(config.headers as Record<string, string> | undefined),
    },
  };
}

function shouldRetry(error: unknown, attempt: number): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (attempt >= getRetryCount()) {
    return false;
  }

  if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }

  if (error.response && error.response.status >= 500) {
    return true;
  }

  return false;
}

async function requestWithRetry<T>(config: AxiosRequestConfig, attempt = 0): Promise<AxiosResponse<T>> {
  try {
    return await axios.request<T>(withDefaultHeaders(config));
  } catch (error) {
    if (shouldRetry(error, attempt)) {
      await sleep(getRetryDelayMs());
      return requestWithRetry<T>(config, attempt + 1);
    }

    throw error;
  }
}

export const apiClient = {
  get<T = unknown>(url: string, config: AxiosRequestConfig = {}) {
    return requestWithRetry<T>({
      ...config,
      method: "GET",
      url,
    });
  },

  post<T = unknown>(url: string, data?: unknown, config: AxiosRequestConfig = {}) {
    return requestWithRetry<T>({
      ...config,
      method: "POST",
      url,
      data,
    });
  },

  put<T = unknown>(url: string, data?: unknown, config: AxiosRequestConfig = {}) {
    return requestWithRetry<T>({
      ...config,
      method: "PUT",
      url,
      data,
    });
  },

  patch<T = unknown>(url: string, data?: unknown, config: AxiosRequestConfig = {}) {
    return requestWithRetry<T>({
      ...config,
      method: "PATCH",
      url,
      data,
    });
  },

  delete<T = unknown>(url: string, config: AxiosRequestConfig = {}) {
    return requestWithRetry<T>({
      ...config,
      method: "DELETE",
      url,
    });
  },
};
