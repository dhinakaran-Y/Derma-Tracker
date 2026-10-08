import axios, { AxiosError } from 'axios';

/**
 * Normalizes any configured API URL to ensure it points to the API root.
 * If provided without an '/api' suffix (e.g. 'https://derma-tracker.onrender.com'),
 * it automatically appends '/api' so all endpoint routes (/auth/staff/login, /admin, etc.) resolve properly.
 */
export function normalizeApiUrl(url?: string): string {
  if (!url) return '/api';
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '/api';
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes('localhost')) {
      return normalizeApiUrl(envUrl);
    }
    // In browser, using relative '/api' leverages Next.js proxy rewrite on port 3000
    // This eliminates CORS, port 5000 firewall/NAT blocking, and works seamlessly
    // on localhost, LAN IP (10.x.x.x, 192.168.x.x), and any public tunnel!
    return '/api';
  }
  return normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');
}

const API_BASE = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');

/**
 * Configured Axios instance with credentials (httpOnly cookie)
 * and automatic Bearer token injection from localStorage.
 */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach Bearer token from localStorage as fallback/complement to cookie
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      config.baseURL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle authentication expiration and unwrap errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isLoginPage = window.location.pathname === '/login';
      if (!isLoginPage && !window.location.pathname.startsWith('/login')) {
        // Clear stored token on authorization failure
        localStorage.removeItem('token');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to store JWT token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
}

/**
 * Helper to clear JWT token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}

/**
 * Safely extracts user-friendly error message from Axios / API errors
 */
export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }
    if (data?.error && typeof data.error === 'string') {
      return data.error;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export const getErrorMessage = getApiErrorMessage;

/**
 * Format media URLs so uploads point to backend server or preserve external CDN URLs
 */
export function getMediaUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Local Next.js public assets
  if (path.startsWith('/images/') || path.startsWith('/icons/') || path.startsWith('/favicon')) {
    return path;
  }

  // Ensure path points to /api/uploads/<filename>
  let clean = path;
  if (!clean.startsWith('/api/uploads') && !clean.startsWith('api/uploads')) {
    const filename = clean.replace(/^\/+/, '').replace(/^uploads\//, '');
    clean = `/api/uploads/${filename}`;
  } else if (!clean.startsWith('/')) {
    clean = `/${clean}`;
  }

  // If explicit public server URL is configured
  const fallbackServer = (process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, ''))?.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    if (fallbackServer && !fallbackServer.includes('localhost')) {
      return `${fallbackServer}${clean}`;
    }
    // In browser, relative `/api/uploads/...` routes through Next.js proxy rewrite seamlessly
    return clean;
  }

  const serverUrl = fallbackServer || 'http://localhost:5000';
  return `${serverUrl}${clean}`;
}

export default api;
