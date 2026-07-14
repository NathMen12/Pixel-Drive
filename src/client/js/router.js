/**
 * Hash Router - Client-side routing
 */

const routes = new Map();
let currentRoute = null;
let beforeEachHooks = [];

export function defineRoute(path, handler) {
  routes.set(path, handler);
}

export function addBeforeEach(hook) {
  beforeEachHooks.push(hook);
}

export async function navigate(path, replace = false) {
  // Run beforeEach hooks
  for (const hook of beforeEachHooks) {
    const result = await hook(path);
    if (result === false) return;
    if (typeof result === 'string') path = result;
  }

  const hash = path.startsWith('#') ? path : `#${path}`;
  if (replace) {
    history.replaceState(null, '', hash);
  } else {
    history.pushState(null, '', hash);
  }
  await handleRoute();
}

export async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');
  const params = new URLSearchParams(queryString);

  // Find matching route
  let matchedRoute = null;
  let matchedParams = {};

  for (const [routePath, handler] of routes) {
    const regex = routeToRegex(routePath);
    const match = path.match(regex);
    if (match) {
      matchedRoute = handler;
      // Extract named params
      const paramNames = routePath.match(/:(\w+)/g) || [];
      paramNames.forEach((name, i) => {
        matchedParams[name.slice(1)] = match[i + 1];
      });
      break;
    }
  }

  if (matchedRoute) {
    currentRoute = { path, params: { ...matchedParams, ...Object.fromEntries(params) } };
    await matchedRoute(currentRoute);
  } else {
    // 404 - redirect to drive
    navigate('/drive');
  }
}

function routeToRegex(path) {
  const regexPath = path
    .replace(/:(\w+)/g, '([^/]+)')
    .replace(/\//g, '\\/');
  return new RegExp(`^${regexPath}$`);
}

export function getCurrentRoute() {
  return currentRoute;
}

export function getQueryParam(name) {
  return currentRoute?.params?.[name] || null;
}

// Initialize router
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('load', handleRoute);
}

// Programmatic navigation helpers
export const router = {
  drive: (folderId = null) => navigate(folderId ? `/drive?folder=${folderId}` : '/drive'),
  gallery: () => navigate('/gallery'),
  settings: () => navigate('/settings'),
  login: () => navigate('/login'),
  register: () => navigate('/register'),
  shared: (id) => navigate(`/shared/${id}`),
  embed: (id) => navigate(`/embed/${id}`),
  back: () => history.back(),
};