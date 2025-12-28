/**
 * Shared ExtendScript Types
 * Used by both After Effects and Premiere Pro adapters
 */

// ===== Folder Configuration =====

export interface FolderConfig {
  id: string;
  name: string;
  order: number;
  isRenderFolder: boolean;
  renderKeywords?: string[];
  skipOrganization?: boolean;
  categories?: CategoryConfig[];
  enableLabelColor?: boolean;
  labelColor?: number;
}

export interface CategoryConfig {
  type: string;
  enabled: boolean;
  order?: number;
  createSubfolders: boolean;
  detectSequences?: boolean;
  keywords?: string[];
  subcategories?: SubcategoryConfig[];
  enableLabelColor?: boolean;
  labelColor?: number;
}

export interface SubcategoryFilter {
  type: "ext" | "prefix" | "keyword";
  value: string;
}

export interface SubcategoryConfig {
  id: string;
  name: string;
  order: number;
  filterType?: "extension" | "keyword" | "all";
  extensions?: string[];
  keywords?: string[];
  filters?: SubcategoryFilter[];
  keywordRequired?: boolean;
  createSubfolders?: boolean;
  enableLabelColor?: boolean;
  labelColor?: number;
}

export interface ExceptionRule {
  id: string;
  type: "nameContains" | "extension";
  pattern: string;
  targetFolderId: string;
  targetCategory?: string;
}

export interface OrganizerConfig {
  folders: FolderConfig[];
  exceptions: ExceptionRule[];
  settings?: {
    deleteEmptyFolders: boolean;
    applyFolderLabelColor?: boolean;
  };
}

export interface OrganizeResult {
  success: boolean;
  movedItems: { folderId: string; folderName: string; count: number }[];
  skipped: number;
  error?: string;
}

export interface ProjectStats {
  totalItems: number;
  comps: number;
  footage: number;
  images: number;
  audio: number;
  sequences: number;
  solids: number;
  folders: number;
}

export interface ItemInfo {
  id: number;
  name: string;
  type: string;
  isFolder: boolean;
}

export interface RenameRequest {
  id: number;
  newName: string;
}

export interface RenameResult {
  success: boolean;
  renamed: number;
  errors: string[];
}
