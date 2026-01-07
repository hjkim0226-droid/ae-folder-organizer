/**
 * Snap Organizer - Default Configuration
 */

import type { CategoryType, VersionedConfig } from "../types";

// ===== Current Config Version =====

export const CONFIG_VERSION = 5;

// ===== All Available Categories =====

export const ALL_CATEGORIES: CategoryType[] = [
  "Comps",
  "Footage",
  "Images",
  "Audio",
  "Solids"
];

// ===== Default Render Keywords =====

export const DEFAULT_RENDER_KEYWORDS = [
  "_render",
  "_final",
  "_output",
  "_export",
  "RENDER_",
  "[RENDER]",
  "Render"
];

// ===== Default Configuration =====

export const DEFAULT_CONFIG: VersionedConfig = {
  version: CONFIG_VERSION,
  folders: [
    {
      id: "render",
      name: "Render",
      order: 0,
      isRenderFolder: true,
      renderKeywords: ["Main", "Render"],
      skipOrganization: true,
      categories: [],
    },
    {
      id: "source",
      name: "Source",
      order: 1,
      isRenderFolder: false,
      categories: [
        { type: "Comps", enabled: true, order: 0, createSubfolders: false },
        { type: "Footage", enabled: true, order: 1, createSubfolders: false, detectSequences: true },
        { type: "Images", enabled: true, order: 2, createSubfolders: false, detectSequences: true },
        { type: "Audio", enabled: true, order: 3, createSubfolders: false },
      ],
    },
    {
      id: "system",
      name: "System",
      order: 99,
      isRenderFolder: false,
      categories: [
        { type: "Solids", enabled: true, order: 0, createSubfolders: false },
      ],
    },
  ],
  exceptions: [],
  renderCompIds: [],
  settings: {
    deleteEmptyFolders: true,
    showStats: true,
    applyFolderLabelColor: false,
    language: "auto",
    isolateMissing: false,
    isolateUnused: false,
  },
};

// ===== Default Label Colors (AE built-in fallback) =====

export const DEFAULT_LABEL_COLORS: Record<number, string> = {
  1: "#ff0000",   // Red
  2: "#ffc500",   // Yellow
  3: "#ccff00",   // Green-Yellow
  4: "#00ff00",   // Green
  5: "#00ffcc",   // Cyan-Green
  6: "#00ccff",   // Cyan
  7: "#0066ff",   // Blue
  8: "#6600ff",   // Purple
  9: "#ff00ff",   // Magenta
  10: "#ff6699", // Pink
  11: "#ff9933", // Orange
  12: "#996633", // Brown
  13: "#669999", // Teal
  14: "#999966", // Olive
  15: "#666699", // Slate
  16: "#996699", // Plum
};
