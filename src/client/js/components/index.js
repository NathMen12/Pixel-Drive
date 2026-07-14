/**
 * Components Registry
 * Define all custom elements
 */

import { Header } from './header.js';
import { Sidebar } from './sidebar.js';
import { DriveView } from './drive-view.js';
import { GalleryView } from './gallery-view.js';
import { SettingsView } from './settings-view.js';
import { LoginView } from './login-view.js';
import { UploadQueue } from './upload-queue.js';
import { ShareModal } from './share-modal.js';
import { InfoModal } from './info-modal.js';
import { PreviewModal } from './preview-modal.js';
import { ConfirmModal } from './confirm-modal.js';
import { RenameModal } from './rename-modal.js';
import { ContextMenu } from './context-menu.js';

export function defineCustomElements() {
  const components = [
    { name: 'pd-header', class: Header },
    { name: 'pd-sidebar', class: Sidebar },
    { name: 'pd-drive-view', class: DriveView },
    { name: 'pd-gallery-view', class: GalleryView },
    { name: 'pd-settings-view', class: SettingsView },
    { name: 'pd-login-view', class: LoginView },
    { name: 'pd-upload-queue', class: UploadQueue },
    { name: 'pd-share-modal', class: ShareModal },
    { name: 'pd-info-modal', class: InfoModal },
    { name: 'pd-preview-modal', class: PreviewModal },
    { name: 'pd-confirm-modal', class: ConfirmModal },
    { name: 'pd-rename-modal', class: RenameModal },
    { name: 'pd-context-menu', class: ContextMenu },
  ];

  components.forEach(({ name, class: ComponentClass }) => {
    if (!customElements.get(name)) {
      customElements.define(name, ComponentClass);
    }
  });
}

// Export all components
export {
  Header,
  Sidebar,
  DriveView,
  GalleryView,
  SettingsView,
  LoginView,
  UploadQueue,
  ShareModal,
  InfoModal,
  PreviewModal,
  ConfirmModal,
  RenameModal,
  ContextMenu,
};