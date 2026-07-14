/**
 * API Client - Fetch wrapper with auth, error handling, credentials
 */

const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important for HttpOnly cookies
    ...options,
  };

  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  } else if (options.body instanceof FormData) {
    // Don't set Content-Type for FormData, let browser set it with boundary
    delete config.headers['Content-Type'];
    config.body = options.body;
  }

  try {
    const response = await fetch(url, config);

    // Handle 401 - token expired
    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry original request
        return request(endpoint, options);
      } else {
        // Redirect to login
        window.location.href = '/login';
        throw new ApiError('Session expirée', 401);
      }
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      throw new ApiError(data?.message || `Erreur ${response.status}`, response.status, data);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Erreur réseau', 0);
  }
}

async function refreshToken() {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Auth API
export const authApi = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  register: (username, password, email, acceptTerms) => request('/auth/register', { method: 'POST', body: { username, password, email, acceptTerms } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  changePassword: (current, newPassword) => request('/auth/password', { method: 'PUT', body: { current, newPassword } }),
  deleteAccount: () => request('/auth/delete', { method: 'DELETE' }),
  refresh: () => request('/auth/refresh', { method: 'POST' }),
};

// Nodes API
export const nodesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/nodes${query ? `?${query}` : ''}`);
  },
  get: (id) => request(`/nodes/${id}`),
  createFolder: (data) => request('/nodes/folder', { method: 'POST', body: data }),
  rename: (id, name) => request(`/nodes/${id}`, { method: 'PATCH', body: { name } }),
  move: (id, parentId) => request(`/nodes/${id}/move`, { method: 'PATCH', body: { parentId } }),
  toggleFav: (id) => request(`/nodes/${id}/fav`, { method: 'POST' }),
  trash: (id) => request(`/nodes/${id}/trash`, { method: 'POST' }),
  restore: (id) => request(`/nodes/${id}/restore`, { method: 'POST' }),
  delete: (id) => request(`/nodes/${id}`, { method: 'DELETE' }),
  search: (q) => request(`/nodes/search?q=${encodeURIComponent(q)}`),
  storage: () => request('/nodes/storage'),
};

// Upload API
export const uploadApi = {
  init: (data) => request('/upload/init', { method: 'POST', body: data }),
  pixelate: (buffer) => {
    const formData = new FormData();
    formData.append('chunk', new Blob([buffer]));
    return request('/upload/pixelate', { method: 'POST', body: formData });
  },
  chunk: (data) => request('/upload/chunk', { method: 'POST', body: data }),
  finalize: (data) => request('/upload/finalize', { method: 'POST', body: data }),
};

// Shares API
export const sharesApi = {
  list: (nodeId) => request(`/shares?nodeId=${nodeId}`),
  createPublic: (nodeId, data) => request(`/shares/public`, { method: 'POST', body: { nodeId, ...data } }),
  createUser: (nodeId, data) => request(`/shares/user`, { method: 'POST', body: { nodeId, ...data } }),
  delete: (id) => request(`/shares/${id}`, { method: 'DELETE' }),
  verifyPassword: (id, password) => request(`/shares/${id}/verify`, { method: 'POST', body: { password } }),
};

// API Keys
export const apiKeyApi = {
  list: () => request('/api-keys'),
  create: (data) => request('/api-keys', { method: 'POST', body: data }),
  delete: (id) => request(`/api-keys/${id}`, { method: 'DELETE' }),
};

// Admin API
export const adminApi = {
  stats: () => request('/admin/stats'),
  users: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/users${query ? `?${query}` : ''}`);
  },
  user: (id) => request(`/admin/users/${id}`),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  impersonate: (id) => request(`/admin/impersonate/${id}`, { method: 'POST' }),
  cleanup: () => request('/admin/cleanup', { method: 'POST' }),
};

// Health
export const healthApi = {
  check: () => request('/health'),
  ready: () => request('/health/ready'),
};

export { ApiError, request };