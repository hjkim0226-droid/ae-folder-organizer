/**
 * Snap Organizer - Domain Types
 * Single source of truth for all type definitions
 */

// ===== Host App =====

export type HostApp = "aeft" | "ppro";

// ===== Category Types =====

export type CategoryType = "Comps" | "Footage" | "Images" | "Audio" | "Solids";

// ===== Filter System =====

export interface SubcategoryFilter {
  type: "ext" | "prefix" | "keyword";
  value: string;
}

// ===== Subcategory Configuration =====

export interface SubcategoryConfig {
  id: string;
  name: string;
  order: number;
  // Legacy filter system (kept for backward compatibility)
  filterType?: "extension" | "keyword" | "all";
  extensions?: string[];
  keywords?: string[];
  // New unified filter system
  filters?: SubcategoryFilter[];
  keywordRequired?: boolean;
  createSubfolders?: boolean;
  // Label color settings
  enableLabelColor?: boolean;
  labelColor?: number;  // AE label color index (1-16)
}

// ===== Category Configuration =====

export interface CategoryConfig {
  type: CategoryType;
  enabled: boolean;
  order: number;
  createSubfolders: boolean;
  detectSequences?: boolean;
  // Legacy keyword system
  keywords?: string[];
  // New unified filter system
  filters?: SubcategoryFilter[];
  needsKeyword?: boolean;  // True when this is a duplicate category requiring keywords
  subcategories?: SubcategoryConfig[];
  // Label color settings
  enableLabelColor?: boolean;
  labelColor?: number;
}

// ===== Folder Configuration =====

export interface FolderConfig {
  id: string;
  name: string;
  order: number;
  isRenderFolder: boolean;
  renderKeywords?: string[];
  skipOrganization?: boolean;
  categories?: CategoryConfig[];
  // Label color settings
  enableLabelColor?: boolean;
  labelColor?: number;
}

// ===== Exception Rules =====

export interface ExceptionRule {
  id: string;
  type: "nameContains" | "extension";
  pattern: string;
  targetFolderId: string;
  targetCategory?: CategoryType;
}

// ===== Organizer Settings =====

export interface OrganizerSettings {
  deleteEmptyFolders: boolean;
  showStats: boolean;
  applyFolderLabelColor: boolean;
  language?: "en" | "ko" | "ja" | "zh" | "zh-TW" | "auto";
  isolateMissing?: boolean;
  isolateUnused?: boolean;
  mergeDuplicates?: boolean;
  reloadBeforeOrganize?: boolean;
}

// ===== Organizer Config =====

export interface OrganizerConfig {
  folders: FolderConfig[];
  exceptions: ExceptionRule[];
  renderCompIds?: number[];
  settings: OrganizerSettings;
}

// ===== Versioned Config (with migration support) =====

export interface VersionedConfig extends OrganizerConfig {
  version?: number;
}

// ===== Organize Result =====

export interface OrganizeResult {
  success: boolean;
  movedItems: MoveResult[];
  skipped: number;
  error?: string;
}

export interface MoveResult {
  folderId: string;
  folderName: string;
  count: number;
}

// ===== Project Stats =====

export interface ProjectStats {
  totalItems: number;
  comps: number;
  footage: number;
  images: number;
  audio: number;
  sequences: number;
  solids: number;
  folders: number;
  // Health Check
  missingFootage: number;
  unusedItems: number;
  duplicateFootage: number;
}

// ===== Health Check Result =====

export interface HealthCheckResult {
  missingFootage: ItemInfo[];
  unusedItems: ItemInfo[];
}

export interface IsolateResult {
  success: boolean;
  movedCount: number;
  folderName: string;
  error?: string;
}

// ===== Item Info (for batch operations) =====

export interface ItemInfo {
  id: number;
  name: string;
  type: string;
  isFolder: boolean;
}

// ===== Batch Rename Types =====

export interface RenameRequest {
  id: number;
  newName: string;
}

export interface RenameResult {
  success: boolean;
  renamed: number;
  errors: string[];
}

// ===== UI State Types =====

export type DragOverTarget = CategoryType | "END" | null;

export type OrganizeStatus = "ready" | "organizing" | "success" | "error";

// ===== Term Mapping for Host Apps =====

export interface HostTerms {
  appName: string;
  folder: string;
  comp: string;
  footage: string;
  sequence: string;
  bin: string;
  organize: string;
  solids: string;
  showSolids: boolean;
}

export const TERMS: Record<HostApp, HostTerms> = {
  aeft: {
    appName: "AE",
    folder: "Folder",
    comp: "Comp",
    footage: "Footage",
    sequence: "Sequence",
    bin: "Folder",
    organize: "Organize",
    solids: "Solids",
    showSolids: true,
  },
  ppro: {
    appName: "PR",
    folder: "Bin",
    comp: "Sequence",
    footage: "Clip",
    sequence: "Sequence",
    bin: "Bin",
    organize: "Organize",
    solids: "Solids",
    showSolids: false,
  },
};
