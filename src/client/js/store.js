/**
 * Store - Reactive State Management
 * Proxy-based reactive store with localStorage persistence
 */

import { authManager } from './auth.js';

class Store {
  constructor() {
    this.state = {
      user: null,
      nodes: [],
      currentFolder: null,
      viewMode: 'grid', // 'grid' | 'list'
      sortBy: 'name', // 'name' | 'size' | 'date' | 'type'
      sortOrder: 'asc', // 'asc' | 'desc'
      searchQuery: '',
      storage: { used: 0, total: 0 },
      sidebarOpen: true,
      theme: 'dark',
      uploadQueue: [],
      notifications: [],
    };

    this.listeners = new Set();
    this.persistKeys = ['viewMode', 'sortBy', 'sortOrder', 'theme', 'sidebarOpen'];
    this.loadPersisted();
  }

  // Proxy handler for reactivity
  createProxy() {
    return new Proxy(this.state, {
      set: (target, prop, value) => {
        const oldValue = target[prop];
        target[prop] = value;
        this.notify(prop, value, oldValue);
        this.persist(prop, value);
        return true;
      },
      get: (target, prop) => {
        if (prop === 'subscribe') return this.subscribe.bind(this);
        if (prop === 'getState') return () => ({ ...target });
        return target[prop];
      },
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(prop, value, oldValue) {
    this.listeners.forEach(listener => {
      try {
        listener(prop, value, oldValue, this.state);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    });
  }

  persist(key, value) {
    if (this.persistKeys.includes(key)) {
      try {
        localStorage.setItem(`pixeldrive_${key}`, JSON.stringify(value));
      } catch (err) {
        console.warn('Failed to persist:', err);
      }
    }
  }

  loadPersisted() {
    this.persistKeys.forEach(key => {
      try {
        const value = localStorage.getItem(`pixeldrive_${key}`);
        if (value !== null) {
          this.state[key] = JSON.parse(value);
        }
      } catch (err) {
        console.warn('Failed to load persisted:', err);
      }
    });
  }

  // User management
  setUser(user) {
    this.state.user = user;
    this.notify('user', user, this.state.user);
  }

  getUser() {
    return this.state.user;
  }

  clearUser() {
    this.state.user = null;
    this.state.nodes = [];
    this.state.currentFolder = null;
    this.notify('user', null, this.state.user);
  }

  // Nodes management
  setNodes(nodes) {
    this.state.nodes = nodes || [];
    this.notify('nodes', this.state.nodes, this.state.nodes);
  }

  getNodes() {
    return this.state.nodes;
  }

  getNode(id) {
    return this.state.nodes.find(n => n.id === id);
  }

  addNode(node) {
    this.state.nodes = [...this.state.nodes, node];
    this.notify('nodes', this.state.nodes, this.state.nodes);
  }

  updateNode(id, updates) {
    const index = this.state.nodes.findIndex(n => n.id === id);
    if (index !== -1) {
      this.state.nodes[index] = { ...this.state.nodes[index], ...updates };
      this.notify('nodes', this.state.nodes, this.state.nodes);
    }
  }

  removeNode(id) {
    this.state.nodes = this.state.nodes.filter(n => n.id !== id);
    this.notify('nodes', this.state.nodes, this.state.nodes);
  }

  // Folder navigation
  setCurrentFolder(folderId) {
    this.state.currentFolder = folderId;
    this.notify('currentFolder', folderId, this.state.currentFolder);
  }

  getCurrentFolder() {
    return this.state.currentFolder;
  }

  getCurrentFolderNodes() {
    return this.state.nodes.filter(n => n.parent_id === this.state.currentFolder);
  }

  getRootNodes() {
    return this.state.nodes.filter(n => n.parent_id === null);
  }

  getBreadcrumbs() {
    if (!this.state.currentFolder) return [{ id: null, name: 'Racine' }];
    const crumbs = [];
    let current = this.getNode(this.state.currentFolder);
    while (current) {
      crumbs.unshift({ id: current.id, name: current.name });
      current = current.parent_id ? this.getNode(current.parent_id) : null;
    }
    return [{ id: null, name: 'Racine' }, ...crumbs];
  }

  // View settings
  setViewMode(mode) {
    this.state.viewMode = mode;
  }

  getViewMode() {
    return this.state.viewMode;
  }

  setSortBy(field) {
    if (this.state.sortBy === field) {
      this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortBy = field;
      this.state.sortOrder = 'asc';
    }
    this.notify('sort', { by: this.state.sortBy, order: this.state.sortOrder }, null);
  }

  getSort() {
    return { by: this.state.sortBy, order: this.state.sortOrder };
  }

  // Search
  setSearchQuery(query) {
    this.state.searchQuery = query;
    this.notify('search', query, this.state.searchQuery);
  }

  getSearchQuery() {
    return this.state.searchQuery;
  }

  // Storage
  setStorage(storage) {
    this.state.storage = storage;
    this.notify('storage', storage, this.state.storage);
  }

  getStorage() {
    return this.state.storage;
  }

  // Sidebar
  toggleSidebar() {
    this.state.sidebarOpen = !this.state.sidebarOpen;
  }

  setSidebarOpen(open) {
    this.state.sidebarOpen = open;
  }

  isSidebarOpen() {
    return this.state.sidebarOpen;
  }

  // Theme
  setTheme(theme) {
    this.state.theme = theme;
  }

  getTheme() {
    return this.state.theme;
  }

  // Notifications
  addNotification(notification) {
    const id = crypto.randomUUID();
    this.state.notifications = [...this.state.notifications, { id, ...notification, timestamp: Date.now() }];
    this.notify('notifications', this.state.notifications, this.state.notifications);
    return id;
  }

  removeNotification(id) {
    this.state.notifications = this.state.notifications.filter(n => n.id !== id);
    this.notify('notifications', this.state.notifications, this.state.notifications);
  }

  getNotifications() {
    return this.state.notifications;
  }

  // Computed getters
  getFilteredNodes() {
    let nodes = this.state.currentFolder
      ? this.state.nodes.filter(n => n.parent_id === this.state.currentFolder)
      : this.state.nodes.filter(n => n.parent_id === null);

    // Filter trashed
    nodes = nodes.filter(n => !n.is_trashed);

    // Search filter
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.name.toLowerCase().includes(q));
    }

    // Sort
    nodes.sort((a, b) => {
      let aVal, bVal;
      switch (this.state.sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'size':
          aVal = a.size || 0;
          bVal = b.size || 0;
          break;
        case 'date':
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return this.state.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.state.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Folders first
    return nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return 0;
    });
  }

  getFavorites() {
    return this.state.nodes.filter(n => n.is_fav && !n.is_trashed);
  }

  getTrash() {
    return this.state.nodes.filter(n => n.is_trashed);
  }

  getMediaNodes() {
    return this.state.nodes.filter(n =>
      n.type === 'file' &&
      (n.mime_type?.startsWith('image/') ||
       n.mime_type?.startsWith('video/') ||
       n.mime_type?.startsWith('audio/'))
    );
  }

  // Reset
  reset() {
    this.state = {
      user: null,
      nodes: [],
      currentFolder: null,
      viewMode: 'grid',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      storage: { used: 0, total: 0 },
      sidebarOpen: true,
      theme: 'dark',
      uploadQueue: [],
      notifications: [],
    };
    this.listeners.forEach(l => l('reset', this.state, null));
  }
}

export const store = new Store().createProxy();