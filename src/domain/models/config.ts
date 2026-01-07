/**
 * Snap Organizer - Config Models
 * Pure functions for configuration management
 */

import type { FolderConfig, VersionedConfig } from "../types";

// ===== ID Generation =====

/**
 * Generate a unique random ID
 * @returns 7-character alphanumeric string
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// ===== Config Validation =====

/**
 * Validate config structure
 * Type guard to check if config is valid VersionedConfig
 */
export const validateConfig = (config: unknown): config is VersionedConfig => {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;

  // Required fields check
  if (!Array.isArray(c.folders)) return false;
  if (!Array.isArray(c.exceptions)) return false;
  if (!c.settings || typeof c.settings !== "object") return false;

  // Validate folders array
  for (const folder of c.folders as unknown[]) {
    if (!folder || typeof folder !== "object") return false;
    const f = folder as Record<string, unknown>;
    if (typeof f.id !== "string" || typeof f.name !== "string") return false;
  }

  return true;
};

// ===== Folder Name Generation =====

/**
 * Generate display folder name with order prefix
 * @example "Render" with index 0 -> "00_Render"
 * @example "Source" with index 1 -> "01_Source"
 * @example "System" folder always gets "99_" prefix
 */
export const getDisplayFolderName = (folder: FolderConfig, index: number): string => {
  if (folder.id === "system") {
    return `99_${folder.name}`;
  }
  const prefix = index.toString().padStart(2, "0");
  return `${prefix}_${folder.name}`;
};

// ===== Folder Order Management =====

/**
 * Sort folders by order, with system folder always last
 */
export const sortFolders = (folders: FolderConfig[]): FolderConfig[] => {
  return [...folders].sort((a, b) => {
    // System folder always at the end
    if (a.id === "system") return 1;
    if (b.id === "system") return -1;
    return a.order - b.order;
  });
};

/**
 * Recalculate folder orders after reordering
 * Ensures orders are sequential and system folder has order 99
 */
export const recalculateFolderOrders = (folders: FolderConfig[]): FolderConfig[] => {
  let order = 0;
  return folders.map(folder => {
    if (folder.id === "system") {
      return { ...folder, order: 99 };
    }
    return { ...folder, order: order++ };
  });
};

// ===== String Utilities =====

/**
 * ES3-compatible trim function
 * Used in ExtendScript context where String.prototype.trim doesn't exist
 */
export const trimStr = (str: string): string => {
  return str.replace(/^\s+|\s+$/g, "");
};

/**
 * Get file extension from filename
 * Handles sequence patterns like "name.[####].exr" or "name.0001.exr"
 */
export const getFileExtension = (name: string): string => {
  // Handle sequence patterns
  const cleanName = name
    .replace(/\[\#+\]/g, "0000")
    .replace(/\.\d{4,}\./, ".");

  const parts = cleanName.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return "";
};
