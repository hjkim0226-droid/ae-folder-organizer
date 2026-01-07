/**
 * Snap Organizer - ExtendScript Core Logic v1.1
 * Config-based folder organization with sequence detection
 */

// Re-export utility
export { dispatchTS } from "../utils/utils";

// ===== Types (Shared with JS) =====

interface FolderConfig {
  id: string;
  name: string;
  order: number;
  isRenderFolder: boolean;
  renderKeywords?: string[];
  skipOrganization?: boolean;  // Skip further organization for items in this folder
  categories?: CategoryConfig[];
  enableLabelColor?: boolean;  // 라벨 컬러 활성화
  labelColor?: number;  // AE 라벨 컬러 인덱스 (1-16)
}

interface CategoryConfig {
  type: string;
  enabled: boolean;
  order?: number;
  createSubfolders: boolean;
  detectSequences?: boolean;
  keywords?: string[];
  subcategories?: SubcategoryConfig[];
  enableLabelColor?: boolean;  // 라벨 컬러 활성화
  labelColor?: number;  // AE 라벨 컬러 인덱스 (1-16)
}


interface SubcategoryFilter {
  type: "ext" | "prefix" | "keyword";
  value: string;
}

interface SubcategoryConfig {
  id: string;
  name: string;
  order: number;
  filterType: "extension" | "keyword" | "all";  // Legacy
  extensions?: string[];  // Legacy
  keywords?: string[];  // Legacy
  filters?: SubcategoryFilter[];  // New unified filter system
  keywordRequired?: boolean;
  createSubfolders?: boolean;
  enableLabelColor?: boolean;  // 라벨 컬러 활성화
  labelColor?: number;  // AE 라벨 컬러 인덱스 (1-16)
}

interface ExceptionRule {
  id: string;
  type: "nameContains" | "extension";
  pattern: string;
  targetFolderId: string;
  targetCategory?: string;
}

interface OrganizerConfig {
  folders: FolderConfig[];
  exceptions: ExceptionRule[];
  settings?: {
    deleteEmptyFolders: boolean;
    applyFolderLabelColor?: boolean;  // 폴더 자체에 라벨 컬러 적용 여부
  };
}

interface OrganizeResult {
  success: boolean;
  movedItems: { folderId: string; folderName: string; count: number }[];
  skipped: number;
  error?: string;
}

interface ProjectStats {
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

// ===== Helper: Project Validation =====

const validateProject = (): { valid: boolean; error?: string } => {
  if (!app.project) {
    return { valid: false, error: "No project open" };
  }
  return { valid: true };
};

// ===== Extension Categories =====

const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mxf"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "psd", "tif", "tiff", "gif", "bmp", "ai", "eps", "svg"];
const SEQUENCE_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "tif", "tiff", "tga", "bmp", "gif"];
const SEQUENCE_CG_EXTENSIONS = ["exr", "dpx", "cin", "hdr"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"];

// Combined for sequence detection
const ALL_SEQUENCE_EXTENSIONS = SEQUENCE_IMAGE_EXTENSIONS.concat(SEQUENCE_CG_EXTENSIONS);

// ===== Helper Functions =====

/**
 * Get file extension from item name
 */
const getFileExtension = (name: string): string => {
  // Handle sequence patterns like "name.[####].exr" or "name.0001.exr"
  const cleanName = name.replace(/\[\#+\]/g, "0000").replace(/\.\d{4,}\./, ".");
  const parts = cleanName.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return "";
};

/**
 * Get actual file extension from FootageItem's source file
 * Uses mainSource.file.name for accurate extension detection
 * Falls back to item.name if no file source available
 */
const getActualFileExtension = (item: FootageItem): string => {
  if (item.mainSource instanceof FileSource) {
    const source = item.mainSource as FileSource;
    if (source.file) {
      return getFileExtension(source.file.name);
    }
  }
  // Fallback to item name
  return getFileExtension(item.name);
};

/**
 * ES3-compatible trim function
 */
const trimStr = (str: string): string => {
  return str.replace(/^\s+|\s+$/g, "");
};

/**
 * Check if item is an image sequence using mainSource.isStill
 * When isStill is false for an image file = it's a sequence
 */
const isSequence = (item: FootageItem): boolean => {
  if (!(item.mainSource instanceof FileSource)) return false;

  const source = item.mainSource as FileSource;

  // If it's marked as still, it's definitely not a sequence
  if (source.isStill) return false;

  // If not still, check if it's an image format (= image sequence)
  const ext = getActualFileExtension(item);

  // Not still + image extension = image sequence
  for (let i = 0; i < ALL_SEQUENCE_EXTENSIONS.length; i++) {
    if (ALL_SEQUENCE_EXTENSIONS[i] === ext) return true;
  }

  return false;
};

/**
 * Get sequence type for subfolder naming (e.g., "EXR Sequence")
 */
const getSequenceType = (item: FootageItem): string => {
  const ext = getActualFileExtension(item).toUpperCase();
  return ext + " Sequence";
};

/**
 * Check if item is a Solid or Null
 */
const isSolid = (item: Item): boolean => {
  if (!(item instanceof FootageItem)) return false;

  const source = item.mainSource;
  if (source instanceof SolidSource) return true;

  // Check for null objects by name pattern
  const name = item.name.toLowerCase();
  if (name.indexOf("null") !== -1) return true;

  return false;
};

/**
 * Check if item name contains render keywords
 */
const isRenderComp = (item: Item, keywords: string[]): boolean => {
  if (!(item instanceof CompItem)) return false;

  const name = item.name.toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    const keyword = trimStr(keywords[i]);
    // Skip empty keywords
    if (keyword === "") continue;
    if (name.indexOf(keyword.toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
};

/**
 * Determine item category type
 * Extended to properly return Footage/Images/Audio based on extension
 */
const getItemCategory = (item: Item, detectSequences: boolean): string | null => {
  if (item instanceof CompItem) return "Comps";
  if (item instanceof FolderItem) return null;

  if (item instanceof FootageItem) {
    // Check for Solid first
    if (isSolid(item)) return "Solids";

    // Check for Sequence (return special type for later processing)
    if (detectSequences && isSequence(item)) return "Sequences";

    // Get extension for categorization (use actual file extension)
    const ext = getActualFileExtension(item);

    // Check Audio first (more specific)
    for (let i = 0; i < AUDIO_EXTENSIONS.length; i++) {
      if (AUDIO_EXTENSIONS[i] === ext) return "Audio";
    }

    // Check Images (static images, not sequences)
    for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
      if (IMAGE_EXTENSIONS[i] === ext) return "Images";
    }

    // Default: treat as Footage (video files and others)
    return "Footage";
  }

  return null;
};

/**
 * Find or create a folder at project root
 */
const getOrCreateRootFolder = (name: string): FolderItem => {
  const project = app.project;

  // Search for existing folder
  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    if (item instanceof FolderItem && item.name === name && item.parentFolder === project.rootFolder) {
      return item;
    }
  }

  // Create new folder
  return project.items.addFolder(name);
};

/**
 * Find or create a subfolder (supports nested paths like "Footage/_MP4")
 */
const getOrCreateSubfolder = (path: string, parent: FolderItem): FolderItem => {
  const parts = path.split("/");
  let current = parent;

  for (let p = 0; p < parts.length; p++) {
    const name = parts[p];
    if (!name) continue;

    let found: FolderItem | null = null;
    for (let i = 1; i <= current.numItems; i++) {
      const item = current.item(i);
      if (item instanceof FolderItem && item.name === name) {
        found = item;
        break;
      }
    }

    if (found) {
      current = found;
    } else {
      const folder = app.project.items.addFolder(name);
      folder.parentFolder = current;
      current = folder;
    }
  }

  return current;
};

/**
 * Check if item is already in any organized folder
 */
const isInOrganizedFolder = (item: Item, folderNames: string[]): boolean => {
  let current = item.parentFolder;

  while (current !== null && current !== app.project.rootFolder) {
    for (let i = 0; i < folderNames.length; i++) {
      if (current.name === folderNames[i]) return true;
    }
    current = current.parentFolder;
  }

  return false;
};

/**
 * Check if exception rule matches item
 */
const matchesException = (item: Item, exception: ExceptionRule): boolean => {
  const name = item.name.toLowerCase();
  const pattern = exception.pattern.toLowerCase();

  if (exception.type === "nameContains") {
    return name.indexOf(pattern) !== -1;
  } else if (exception.type === "extension") {
    const ext = getFileExtension(item.name);
    return ext === pattern.replace(".", "");
  }

  return false;
};

/**
 * Match item to subcategory based on filters (new system) or filterType (legacy)
 */
const matchSubcategory = (item: Item, subcategory: SubcategoryConfig): boolean => {
  const itemName = item.name.toLowerCase();
  const ext = getFileExtension(item.name);

  // New filter system - check filters array first
  if (subcategory.filters && subcategory.filters.length > 0) {
    for (let i = 0; i < subcategory.filters.length; i++) {
      const filter = subcategory.filters[i];
      if (filter.type === "ext") {
        // Extension filter: .mp4, .mov, etc.
        if (filter.value.toLowerCase() === ext) return true;
      } else if (filter.type === "prefix") {
        // Prefix filter: VFX_, BG_, etc.
        if (itemName.indexOf(filter.value.toLowerCase()) === 0) return true;
      } else if (filter.type === "keyword") {
        // Keyword filter: fire, explosion, etc.
        if (itemName.indexOf(filter.value.toLowerCase()) !== -1) return true;
      }
    }
    return false;  // Has filters but none matched
  }

  // No filters = matches everything (acts as "All Items")
  if (!subcategory.filters || subcategory.filters.length === 0) {
    // Check legacy fields
    if (subcategory.keywordRequired) return false;
    if (subcategory.filterType === "all") return true;

    // Legacy extension check
    if (subcategory.filterType === "extension" && subcategory.extensions) {
      for (let i = 0; i < subcategory.extensions.length; i++) {
        if (subcategory.extensions[i].toLowerCase() === ext) return true;
      }
    }

    // Legacy keyword check
    if (subcategory.filterType === "keyword" && subcategory.keywords) {
      for (let i = 0; i < subcategory.keywords.length; i++) {
        const kw = subcategory.keywords[i];
        if (kw && itemName.indexOf(kw.toLowerCase()) !== -1) return true;
      }
    }

    // No filters and no legacy = match all
    if (!subcategory.extensions && !subcategory.keywords && subcategory.filterType !== "extension" && subcategory.filterType !== "keyword") {
      return true;
    }
  }

  return false;
};

/**
 * Generate Others folder name with proper numbering
 */
const generateOthersFolderName = (count: number): string => {
  const orderNum = count + 1;
  const prefix = (orderNum < 10 ? "0" : "") + orderNum;
  return prefix + "_Others";
};

/**
 * Delete empty folders recursively
 */
const deleteEmptyFolders = (): number => {
  let deletedCount = 0;
  let foundEmpty = true;

  // Keep iterating until no more empty folders found
  while (foundEmpty) {
    foundEmpty = false;
    const project = app.project;

    // Iterate backwards to safely delete
    for (let i = project.numItems; i >= 1; i--) {
      const item = project.item(i);

      if (item instanceof FolderItem) {
        // Check if folder is empty
        if (item.numItems === 0) {
          item.remove();
          deletedCount++;
          foundEmpty = true;
        }
      }
    }
  }

  return deletedCount;
};

// ===== Main Export Functions =====

/**
 * Get names of selected compositions
 */
export const getSelectedCompNames = (): string[] => {
  const project = app.project;
  const names: string[] = [];

  // Get selected items from project panel
  const selection = project.selection;

  for (let i = 0; i < selection.length; i++) {
    const item = selection[i];
    if (item instanceof CompItem) {
      names.push(item.name);
    }
  }

  return names;
};

/**
 * Get all selected items with their info for batch rename
 */
interface ItemInfo {
  id: number;
  name: string;
  type: string;
}

export const getSelectedItems = (): ItemInfo[] => {
  const validation = validateProject();
  if (!validation.valid) {
    return [];
  }

  const project = app.project;
  const items: ItemInfo[] = [];
  const selection = project.selection;
  const addedIds: { [id: number]: boolean } = {};  // 중복 방지

  // 폴더 내 아이템을 재귀적으로 수집하는 헬퍼 함수
  const collectItemsFromFolder = (folder: FolderItem): void => {
    for (let i = 1; i <= folder.numItems; i++) {
      const child = folder.item(i);
      if (child instanceof FolderItem) {
        collectItemsFromFolder(child);  // 하위 폴더 재귀 탐색
      } else if (!addedIds[child.id]) {
        let itemType = "unknown";
        if (child instanceof CompItem) itemType = "comp";
        else if (child instanceof FootageItem) itemType = "footage";
        items.push({ id: child.id, name: child.name, type: itemType });
        addedIds[child.id] = true;
      }
    }
  };

  for (let i = 0; i < selection.length; i++) {
    const item = selection[i];
    if (item instanceof FolderItem) {
      // 폴더가 선택되면 내부 아이템들을 모두 수집
      collectItemsFromFolder(item);
    } else if (!addedIds[item.id]) {
      let itemType = "unknown";
      if (item instanceof CompItem) itemType = "comp";
      else if (item instanceof FootageItem) itemType = "footage";
      items.push({ id: item.id, name: item.name, type: itemType });
      addedIds[item.id] = true;
    }
  }

  return items;
};

/**
 * Batch rename items
 */
interface RenameRequest {
  id: number;
  newName: string;
}

interface RenameResult {
  success: boolean;
  renamed: number;
  errors: string[];
}

export const batchRenameItems = (requests: RenameRequest[]): RenameResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return {
      success: false,
      renamed: 0,
      errors: [validation.error || "No project open"],
    };
  }

  const project = app.project;
  const result: RenameResult = {
    success: true,
    renamed: 0,
    errors: [],
  };

  app.beginUndoGroup("Batch Rename Items");

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    try {
      const item = project.itemByID(req.id);
      if (item && !(item instanceof FolderItem)) {
        item.name = req.newName;
        result.renamed++;
      }
    } catch (e) {
      result.errors.push("Failed to rename item ID " + req.id);
      result.success = false;
    }
  }

  app.endUndoGroup();

  return result;
};

/**
 * Get project statistics including health check info
 */
export const getProjectStats = (): ProjectStats => {
  const validation = validateProject();
  if (!validation.valid) {
    return {
      totalItems: 0,
      comps: 0,
      footage: 0,
      images: 0,
      audio: 0,
      sequences: 0,
      solids: 0,
      folders: 0,
      missingFootage: 0,
      unusedItems: 0,
      duplicateFootage: 0,
    };
  }

  const project = app.project;
  const stats: ProjectStats = {
    totalItems: 0,
    comps: 0,
    footage: 0,
    images: 0,
    audio: 0,
    sequences: 0,
    solids: 0,
    folders: 0,
    missingFootage: 0,
    unusedItems: 0,
    duplicateFootage: 0,
  };

  // Track file paths to detect duplicates
  const filePathMap: { [path: string]: number } = {};

  // Collect all used item IDs (for unused detection)
  const usedItemIds: { [id: number]: boolean } = {};

  // First pass: count items and detect missing footage
  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    stats.totalItems++;

    if (item instanceof CompItem) {
      stats.comps++;
      // Mark all items used in this comp
      for (let l = 1; l <= item.numLayers; l++) {
        const layer = item.layer(l);
        if (layer.source) {
          usedItemIds[layer.source.id] = true;
        }
      }
    } else if (item instanceof FolderItem) {
      stats.folders++;
    } else if (item instanceof FootageItem) {
      // Check for missing footage
      if (item.footageMissing) {
        stats.missingFootage++;
      }

      // Track file path for duplicate detection (skip solids and missing)
      if (!isSolid(item) && !item.footageMissing) {
        if (item.mainSource instanceof FileSource) {
          const source = item.mainSource as FileSource;
          if (source.file) {
            const filePath = source.file.fsName;
            if (filePathMap[filePath]) {
              filePathMap[filePath]++;
            } else {
              filePathMap[filePath] = 1;
            }
          }
        }
      }

      if (isSolid(item)) {
        stats.solids++;
      } else if (isSequence(item)) {
        stats.sequences++;
      } else {
        const ext = getFileExtension(item.name);
        let isAudio = false;
        let isImage = false;
        for (let e = 0; e < AUDIO_EXTENSIONS.length; e++) {
          if (AUDIO_EXTENSIONS[e] === ext) { isAudio = true; break; }
        }
        for (let e = 0; e < IMAGE_EXTENSIONS.length; e++) {
          if (IMAGE_EXTENSIONS[e] === ext) { isImage = true; break; }
        }
        if (isAudio) {
          stats.audio++;
        } else if (isImage) {
          stats.images++;
        } else {
          stats.footage++;
        }
      }
    }
  }

  // Count duplicate footage items
  for (const path in filePathMap) {
    if (filePathMap[path] > 1) {
      stats.duplicateFootage += filePathMap[path];
    }
  }

  // Second pass: count unused items (footage and comps not used anywhere)
  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    if (item instanceof FolderItem) continue;

    // Skip solids - they're usually intentionally unused
    if (item instanceof FootageItem && isSolid(item)) continue;

    if (!usedItemIds[item.id]) {
      // Check if this comp is used in any other comp (deep check)
      let isUsed = false;
      if (item instanceof CompItem) {
        // Comps might be render comps - check usedIn
        // @ts-ignore - usedIn exists but might not be in types
        if (item.usedIn && item.usedIn.length > 0) {
          isUsed = true;
        }
      }
      if (!isUsed) {
        stats.unusedItems++;
      }
    }
  }

  return stats;
};

// ===== Health Check Types =====

interface IsolateResult {
  success: boolean;
  movedCount: number;
  folderName: string;
  usedCount?: number;      // For missing: used items count
  unusedCount?: number;    // For missing: unused items count
  error?: string;
}

// System folder names
const SYSTEM_FOLDER_NAME = "99_System";
const MISSING_USED_FOLDER = "_Missing_Used";
const MISSING_UNUSED_FOLDER = "_Missing_Unused";
const UNUSED_FOLDER = "_Unused";

/**
 * Get or create a subfolder under 99_System
 */
const getOrCreateSystemSubfolder = (subfolderName: string): FolderItem => {
  const project = app.project;
  let systemFolder: FolderItem | null = null;

  // Find or create 99_System folder
  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    if (item instanceof FolderItem && item.name === SYSTEM_FOLDER_NAME && item.parentFolder === project.rootFolder) {
      systemFolder = item;
      break;
    }
  }

  if (!systemFolder) {
    systemFolder = project.items.addFolder(SYSTEM_FOLDER_NAME);
  }

  // Find or create subfolder
  for (let i = 1; i <= systemFolder.numItems; i++) {
    const item = systemFolder.item(i);
    if (item instanceof FolderItem && item.name === subfolderName) {
      return item;
    }
  }

  return project.items.addFolder(subfolderName);
};

/**
 * Check if a missing footage item is used in any comp
 */
const isMissingItemUsed = (item: FootageItem): boolean => {
  const project = app.project;

  for (let i = 1; i <= project.numItems; i++) {
    const comp = project.item(i);
    if (!(comp instanceof CompItem)) continue;

    for (let l = 1; l <= comp.numLayers; l++) {
      const layer = comp.layer(l);
      // @ts-ignore - layer.source exists for AVLayer
      if (layer.source && layer.source.id === item.id) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Isolate missing footage items to 99_System/_Missing_Used and _Missing_Unused
 */
export const isolateMissingFootage = (): IsolateResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return { success: false, movedCount: 0, folderName: "", error: validation.error };
  }

  const result: IsolateResult = {
    success: true,
    movedCount: 0,
    folderName: SYSTEM_FOLDER_NAME,
    usedCount: 0,
    unusedCount: 0,
  };

  try {
    const project = app.project;

    // Collect missing items, separating used vs unused
    const usedItems: FootageItem[] = [];
    const unusedItems: FootageItem[] = [];

    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);
      if (item instanceof FootageItem && item.footageMissing) {
        // Skip if already in system missing folders
        if (item.parentFolder) {
          const parentName = item.parentFolder.name;
          if (parentName === MISSING_USED_FOLDER || parentName === MISSING_UNUSED_FOLDER) continue;
        }

        if (isMissingItemUsed(item)) {
          usedItems.push(item);
        } else {
          unusedItems.push(item);
        }
      }
    }

    // Only create folders and move if there are items
    const totalItems = usedItems.length + unusedItems.length;
    if (totalItems > 0) {
      app.beginUndoGroup("Isolate Missing Footage");

      // Find or create 99_System folder first
      let systemFolder: FolderItem | null = null;
      for (let i = 1; i <= project.numItems; i++) {
        const item = project.item(i);
        if (item instanceof FolderItem && item.name === SYSTEM_FOLDER_NAME && item.parentFolder === project.rootFolder) {
          systemFolder = item;
          break;
        }
      }
      if (!systemFolder) {
        systemFolder = project.items.addFolder(SYSTEM_FOLDER_NAME);
      }

      // Move used missing items
      if (usedItems.length > 0) {
        let usedFolder: FolderItem | null = null;
        for (let i = 1; i <= systemFolder.numItems; i++) {
          const item = systemFolder.item(i);
          if (item instanceof FolderItem && item.name === MISSING_USED_FOLDER) {
            usedFolder = item;
            break;
          }
        }
        if (!usedFolder) {
          usedFolder = project.items.addFolder(MISSING_USED_FOLDER);
          usedFolder.parentFolder = systemFolder;
        }

        for (let i = 0; i < usedItems.length; i++) {
          usedItems[i].parentFolder = usedFolder;
        }
        result.usedCount = usedItems.length;
      }

      // Move unused missing items
      if (unusedItems.length > 0) {
        let unusedFolder: FolderItem | null = null;
        for (let i = 1; i <= systemFolder.numItems; i++) {
          const item = systemFolder.item(i);
          if (item instanceof FolderItem && item.name === MISSING_UNUSED_FOLDER) {
            unusedFolder = item;
            break;
          }
        }
        if (!unusedFolder) {
          unusedFolder = project.items.addFolder(MISSING_UNUSED_FOLDER);
          unusedFolder.parentFolder = systemFolder;
        }

        for (let i = 0; i < unusedItems.length; i++) {
          unusedItems[i].parentFolder = unusedFolder;
        }
        result.unusedCount = unusedItems.length;
      }

      result.movedCount = totalItems;
      app.endUndoGroup();
    }
  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
  }

  return result;
};

/**
 * Get all items used by render comps (deep scan)
 */
const getUsedItemIds = (renderKeywords: string[]): { [id: number]: boolean } => {
  const usedIds: { [id: number]: boolean } = {};
  const project = app.project;

  // Helper: recursively mark all used items from a comp
  const markUsedItems = (comp: CompItem, visited: { [id: number]: boolean }) => {
    if (visited[comp.id]) return;
    visited[comp.id] = true;
    usedIds[comp.id] = true;

    for (let l = 1; l <= comp.numLayers; l++) {
      const layer = comp.layer(l);
      if (layer.source) {
        usedIds[layer.source.id] = true;
        // If source is a comp, recurse
        if (layer.source instanceof CompItem) {
          markUsedItems(layer.source, visited);
        }
      }
    }
  };

  // Find render comps and trace their dependencies
  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    if (item instanceof CompItem) {
      const name = item.name.toLowerCase();
      for (let k = 0; k < renderKeywords.length; k++) {
        const keyword = trimStr(renderKeywords[k]).toLowerCase();
        if (keyword && name.indexOf(keyword) !== -1) {
          markUsedItems(item, {});
          break;
        }
      }
    }
  }

  return usedIds;
};

/**
 * Isolate unused items to 99_System/_Unused folder
 * @param renderKeywords Keywords to identify render comps (e.g., ["_render", "_final"])
 */
export const isolateUnusedAssets = (renderKeywordsJson: string): IsolateResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return { success: false, movedCount: 0, folderName: "", error: validation.error };
  }

  const renderKeywords: string[] = JSON.parse(renderKeywordsJson);

  const result: IsolateResult = {
    success: true,
    movedCount: 0,
    folderName: SYSTEM_FOLDER_NAME + "/" + UNUSED_FOLDER,
  };

  try {
    const project = app.project;
    const usedIds = getUsedItemIds(renderKeywords);

    // Collect items to move (avoid modifying while iterating)
    const itemsToMove: Item[] = [];

    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);

      // Skip folders
      if (item instanceof FolderItem) continue;

      // Skip solids (usually intentionally unused)
      if (item instanceof FootageItem && isSolid(item)) continue;

      // Skip items already in system health check folders
      if (item.parentFolder) {
        const parentName = item.parentFolder.name;
        if (parentName === UNUSED_FOLDER ||
            parentName === MISSING_USED_FOLDER ||
            parentName === MISSING_UNUSED_FOLDER) continue;
      }

      // Skip missing footage (handled by isolateMissingFootage)
      if (item instanceof FootageItem && item.footageMissing) continue;

      // If not used, mark for moving
      if (!usedIds[item.id]) {
        itemsToMove.push(item);
      }
    }

    // Only create folder and move if there are items
    if (itemsToMove.length > 0) {
      app.beginUndoGroup("Isolate Unused Assets");

      // Find or create 99_System folder first
      let systemFolder: FolderItem | null = null;
      for (let i = 1; i <= project.numItems; i++) {
        const item = project.item(i);
        if (item instanceof FolderItem && item.name === SYSTEM_FOLDER_NAME && item.parentFolder === project.rootFolder) {
          systemFolder = item;
          break;
        }
      }
      if (!systemFolder) {
        systemFolder = project.items.addFolder(SYSTEM_FOLDER_NAME);
      }

      // Find or create _Unused folder under System
      let unusedFolder: FolderItem | null = null;
      for (let i = 1; i <= systemFolder.numItems; i++) {
        const item = systemFolder.item(i);
        if (item instanceof FolderItem && item.name === UNUSED_FOLDER) {
          unusedFolder = item;
          break;
        }
      }
      if (!unusedFolder) {
        unusedFolder = project.items.addFolder(UNUSED_FOLDER);
        unusedFolder.parentFolder = systemFolder;
      }

      for (let i = 0; i < itemsToMove.length; i++) {
        itemsToMove[i].parentFolder = unusedFolder;
        result.movedCount++;
      }

      app.endUndoGroup();
    }
  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
  }

  return result;
};

// ===== Duplicate Footage Detection & Merge =====

interface DuplicateGroup {
  filePath: string;
  items: { id: number; name: string }[];
}

interface MergeDuplicatesResult {
  success: boolean;
  mergedCount: number;
  deletedCount: number;
  error?: string;
}

/**
 * Find duplicate footage items (same file path imported multiple times)
 * Returns groups of duplicate items
 */
export const findDuplicateFootage = (): DuplicateGroup[] => {
  const validation = validateProject();
  if (!validation.valid) {
    return [];
  }

  const project = app.project;
  const filePathMap: { [path: string]: { id: number; name: string }[] } = {};

  // Collect all footage items by file path
  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);

    if (item instanceof FootageItem && !isSolid(item) && !item.footageMissing) {
      if (item.mainSource instanceof FileSource) {
        const source = item.mainSource as FileSource;
        if (source.file) {
          const filePath = source.file.fsName;
          if (!filePathMap[filePath]) {
            filePathMap[filePath] = [];
          }
          filePathMap[filePath].push({ id: item.id, name: item.name });
        }
      }
    }
  }

  // Filter to only groups with duplicates
  const duplicateGroups: DuplicateGroup[] = [];
  for (const filePath in filePathMap) {
    if (filePathMap[filePath].length > 1) {
      duplicateGroups.push({
        filePath: filePath,
        items: filePathMap[filePath],
      });
    }
  }

  return duplicateGroups;
};

/**
 * Merge duplicate footage items
 * Keeps the first item, replaces references in all comps, then removes duplicates
 */
export const mergeDuplicateFootage = (): MergeDuplicatesResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return { success: false, mergedCount: 0, deletedCount: 0, error: validation.error };
  }

  const result: MergeDuplicatesResult = {
    success: true,
    mergedCount: 0,
    deletedCount: 0,
  };

  try {
    const project = app.project;
    const duplicateGroups = findDuplicateFootage();

    if (duplicateGroups.length === 0) {
      return result; // No duplicates to merge
    }

    app.beginUndoGroup("Merge Duplicate Footage");

    for (let g = 0; g < duplicateGroups.length; g++) {
      const group = duplicateGroups[g];
      if (group.items.length < 2) continue;

      // Keep the first item as the master
      const masterId = group.items[0].id;
      let masterItem: FootageItem | null = null;

      // Find master item
      for (let i = 1; i <= project.numItems; i++) {
        const item = project.item(i);
        if (item.id === masterId && item instanceof FootageItem) {
          masterItem = item;
          break;
        }
      }

      if (!masterItem) continue;

      // Process duplicates (skip the first one which is the master)
      for (let d = 1; d < group.items.length; d++) {
        const dupId = group.items[d].id;
        let dupItem: FootageItem | null = null;

        // Find duplicate item
        for (let i = 1; i <= project.numItems; i++) {
          const item = project.item(i);
          if (item.id === dupId && item instanceof FootageItem) {
            dupItem = item;
            break;
          }
        }

        if (!dupItem) continue;

        // Replace all references to duplicate with master in all comps
        for (let c = 1; c <= project.numItems; c++) {
          const comp = project.item(c);
          if (!(comp instanceof CompItem)) continue;

          for (let l = comp.numLayers; l >= 1; l--) {
            const layer = comp.layer(l);
            if (layer.source && layer.source.id === dupId) {
              // Replace source with master
              // @ts-ignore - replaceSource exists
              layer.replaceSource(masterItem, false);
            }
          }
        }

        // Remove the duplicate item
        dupItem.remove();
        result.deletedCount++;
      }

      result.mergedCount++;
    }

    app.endUndoGroup();
  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
  }

  return result;
};

// ===== Reload All Footage =====

interface ReloadResult {
  success: boolean;
  reloadedCount: number;
  error?: string;
}

/**
 * Reload all footage items using AE's native reload command
 * Command ID 2257 = "Reload Footage"
 */
export const reloadAllFootage = (): ReloadResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return { success: false, reloadedCount: 0, error: validation.error };
  }

  const result: ReloadResult = {
    success: true,
    reloadedCount: 0,
  };

  try {
    const project = app.project;

    // Collect all file-based footage items
    const footageItems: FootageItem[] = [];
    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);
      if (item instanceof FootageItem && !isSolid(item)) {
        // Only reload file-based footage (not solids, not placeholders)
        if (item.mainSource instanceof FileSource) {
          footageItems.push(item);
        }
      }
    }

    if (footageItems.length === 0) {
      return result; // No footage to reload
    }

    app.beginUndoGroup("Reload All Footage");

    // Store current selection
    const originalSelection = project.selection.slice();

    // Reload each footage item
    for (let i = 0; i < footageItems.length; i++) {
      const item = footageItems[i];

      // Select only this item
      // First deselect all
      for (let j = 1; j <= project.numItems; j++) {
        project.item(j).selected = false;
      }
      // Select target item
      item.selected = true;

      // Execute Reload Footage command (ID: 2257)
      app.executeCommand(2257);
      result.reloadedCount++;
    }

    // Restore original selection
    for (let j = 1; j <= project.numItems; j++) {
      project.item(j).selected = false;
    }
    for (let i = 0; i < originalSelection.length; i++) {
      originalSelection[i].selected = true;
    }

    app.endUndoGroup();
  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
  }

  return result;
};

/**
 * Get label colors from AE preferences
 * Returns array of 16 hex color strings
 */
export const getLabelColors = (): string[] => {
  const colors: string[] = [];

  try {
    // AE 24.0+ has app.project.labelColors (array of LabelColor objects)
    // @ts-ignore
    if (app.project && app.project.labelColors) {
      // @ts-ignore
      const labelColors = app.project.labelColors;
      for (let i = 0; i < 16; i++) {
        try {
          // LabelColor has getValue() that returns [r, g, b] array (0-1 range)
          // @ts-ignore
          const rgb = labelColors[i];
          if (rgb && rgb.length >= 3) {
            const r = Math.round(rgb[0] * 255);
            const g = Math.round(rgb[1] * 255);
            const b = Math.round(rgb[2] * 255);
            const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            colors.push(hex);
          } else {
            colors.push("");
          }
        } catch (e) {
          colors.push("");
        }
      }
    }
  } catch (e) {
    // Return empty array on error
  }

  return colors;
};

/**
 * Main organize function with config
 */
export const organizeProject = (configJson: string, itemIdsJson?: string): OrganizeResult => {
  // Validate project first
  const validation = validateProject();
  if (!validation.valid) {
    return {
      success: false,
      movedItems: [],
      skipped: 0,
      error: validation.error,
    };
  }

  const config: OrganizerConfig = JSON.parse(configJson) as OrganizerConfig;
  const itemIds: number[] | null = itemIdsJson ? JSON.parse(itemIdsJson) as number[] : null;

  const result: OrganizeResult = {
    success: true,
    movedItems: [],
    skipped: 0,
  };

  // Track undo group state
  let undoGroupStarted = false;

  // Initialize move counts
  const moveCounts: { [key: string]: number } = {};
  for (let i = 0; i < config.folders.length; i++) {
    moveCounts[config.folders[i].id] = 0;
  }

  try {
    app.beginUndoGroup("Snap Organizer");
    undoGroupStarted = true;

    const project = app.project;
    const folderNames: string[] = [];
    for (let fn = 0; fn < config.folders.length; fn++) {
      folderNames.push(config.folders[fn].name);
    }

    // Create all folders first (sorted by order)
    const sortedFolders = config.folders.slice().sort(function (a, b) { return a.order - b.order; });
    const folderMap: { [key: string]: FolderItem } = {};

    for (let i = 0; i < sortedFolders.length; i++) {
      const fc = sortedFolders[i];
      folderMap[fc.id] = getOrCreateRootFolder(fc.name);
    }

    // Build category-to-folder mappings (array to support same category in multiple folders with keywords)
    const categoryFolderMappings: { [key: string]: Array<{ folderId: string; config: CategoryConfig; order: number }> } = {};

    for (let i = 0; i < config.folders.length; i++) {
      const folder = config.folders[i];
      const cats = folder.categories || [];
      // Sort categories by their order property
      const sortedCats = cats.slice().sort(function (a: CategoryConfig, b: CategoryConfig) { return (a.order || 0) - (b.order || 0); });
      for (let j = 0; j < sortedCats.length; j++) {
        const cat = sortedCats[j];
        if (cat.enabled) {
          if (!categoryFolderMappings[cat.type]) {
            categoryFolderMappings[cat.type] = [];
          }
          categoryFolderMappings[cat.type].push({ folderId: folder.id, config: cat, order: j + 1 });
        }
      }
    }

    // Collect items to process
    const itemsToProcess: Item[] = [];

    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);

      // Skip folders
      if (item instanceof FolderItem) continue;

      // If specific items requested, filter
      if (itemIds !== null) {
        let found = false;
        for (let idIdx = 0; idIdx < itemIds.length; idIdx++) {
          if (itemIds[idIdx] === item.id) { found = true; break; }
        }
        if (!found) continue;
      }

      itemsToProcess.push(item);
    }

    // Process each item
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      let targetFolderId: string | null = null;
      let targetSubfolder: string | null = null;
      let labelColorToApply: number | null = null;  // 라벨 컬러 추적 (우선순위: 서브카테고리 > 카테고리 > 폴더)

      // 1. Check render folders first
      for (let j = 0; j < config.folders.length; j++) {
        const folder = config.folders[j];
        if (folder.isRenderFolder && folder.renderKeywords) {
          if (isRenderComp(item, folder.renderKeywords)) {
            targetFolderId = folder.id;
            break;
          }
        }
      }

      // 2. If not render, categorize by type (with keyword filter support)
      if (targetFolderId === null) {
        // Determine if we should detect sequences
        let detectSequences = false;
        const footageMappings = categoryFolderMappings["Footage"];
        if (footageMappings && footageMappings.length > 0 && footageMappings[0].config.detectSequences) {
          detectSequences = true;
        }

        const categoryType = getItemCategory(item, detectSequences);

        if (categoryType !== null) {
          // Handle "Sequences" - check subcategory filters first, then fallback to Sequences folder
          if (categoryType === "Sequences" && item instanceof FootageItem) {
            if (footageMappings && footageMappings.length > 0) {
              targetFolderId = footageMappings[0].folderId;
              const orderPrefix = (footageMappings[0].order < 10 ? "0" : "") + footageMappings[0].order;
              const numberedCategoryName = orderPrefix + "_Footage";

              // Check subcategories first - sequences can match subcategory filters
              const subcats = footageMappings[0].config.subcategories;
              let matchedSubcat: SubcategoryConfig | null = null;

              if (subcats && subcats.length > 0) {
                // Sort by order
                const sortedSubcats = subcats.slice().sort(function (a: SubcategoryConfig, b: SubcategoryConfig) {
                  return a.order - b.order;
                });

                // Find matching subcategory
                for (let s = 0; s < sortedSubcats.length; s++) {
                  if (matchSubcategory(item, sortedSubcats[s])) {
                    matchedSubcat = sortedSubcats[s];
                    break;
                  }
                }

                if (matchedSubcat) {
                  // Use matched subcategory
                  const subPrefix = (matchedSubcat.order < 10 ? "0" : "") + matchedSubcat.order;
                  targetSubfolder = numberedCategoryName + "/" + subPrefix + "_" + matchedSubcat.name;
                } else if (footageMappings[0].config.createSubfolders) {
                  // No match + createSubfolders = Sequences folder
                  const seqType = getSequenceType(item); // e.g., "EXR Sequence"
                  targetSubfolder = numberedCategoryName + "/Sequences/" + seqType;
                } else {
                  // No filters, no subfolder = just Footage
                  targetSubfolder = numberedCategoryName;
                }
              } else if (footageMappings[0].config.createSubfolders) {
                // No subcategories defined, but createSubfolders = Sequences folder
                const seqType = getSequenceType(item);
                targetSubfolder = numberedCategoryName + "/Sequences/" + seqType;
              } else {
                // Just put in Footage folder without sequence subfolder
                targetSubfolder = numberedCategoryName;
              }
            }
          } else {
            const mappings = categoryFolderMappings[categoryType];
            if (mappings && mappings.length > 0) {
              // Find best matching folder based on keywords
              let selectedMapping = mappings[0]; // Default to first (no keywords = all)
              const itemName = item.name.toLowerCase();

              for (let m = 0; m < mappings.length; m++) {
                const mapping = mappings[m];
                const keywords = mapping.config.keywords;

                if (keywords && keywords.length > 0) {
                  // Check if item name matches any keyword
                  for (let k = 0; k < keywords.length; k++) {
                    const kw = trimStr(keywords[k]);
                    if (kw !== "" && itemName.indexOf(kw.toLowerCase()) !== -1) {
                      selectedMapping = mapping;
                      break;
                    }
                  }
                }
              }

              targetFolderId = selectedMapping.folderId;

              // 카테고리 라벨 컬러 체크 (폴더보다 우선)
              if (selectedMapping.config.enableLabelColor && selectedMapping.config.labelColor) {
                labelColorToApply = selectedMapping.config.labelColor;
              }

              // Create numbered category subfolder
              const orderPrefix = (selectedMapping.order < 10 ? "0" : "") + selectedMapping.order;
              const numberedCategoryName = orderPrefix + "_" + categoryType;
              targetSubfolder = numberedCategoryName;

              // Check for subcategories
              const subcats = selectedMapping.config.subcategories;
              if (subcats && subcats.length > 0) {
                let matchedSubcat: SubcategoryConfig | null = null;

                // Sort by order
                const sortedSubcats = subcats.slice().sort(function (a: SubcategoryConfig, b: SubcategoryConfig) {
                  return a.order - b.order;
                });

                // Find matching subcategory
                for (let s = 0; s < sortedSubcats.length; s++) {
                  if (matchSubcategory(item, sortedSubcats[s])) {
                    matchedSubcat = sortedSubcats[s];
                    break;
                  }
                }

                if (matchedSubcat) {
                  // Create subcategory subfolder
                  const subPrefix = (matchedSubcat.order < 10 ? "0" : "") + matchedSubcat.order;
                  targetSubfolder = numberedCategoryName + "/" + subPrefix + "_" + matchedSubcat.name;

                  // 서브카테고리 라벨 컬러 체크 (가장 높은 우선순위)
                  if (matchedSubcat.enableLabelColor && matchedSubcat.labelColor) {
                    labelColorToApply = matchedSubcat.labelColor;
                  }
                } else if (sortedSubcats.length >= 2) {
                  // No match and 2+ subcategories = use Others fallback
                  const othersName = generateOthersFolderName(sortedSubcats.length);
                  targetSubfolder = numberedCategoryName + "/" + othersName;
                }
                // If only 1 subcategory, stay in parent (acts as "all")
              } else if (selectedMapping.config.createSubfolders && item instanceof FootageItem) {
                // Legacy: extension-based sub-subfolder if no subcategories defined
                const ext = getFileExtension(item.name).toUpperCase();
                if (ext) {
                  targetSubfolder = numberedCategoryName + "/_" + ext;
                }
              }
            }
          }
        }
      }

      // 3. Apply exception rules (last priority, can override)
      for (let j = 0; j < config.exceptions.length; j++) {
        const ex = config.exceptions[j];
        if (matchesException(item, ex)) {
          targetFolderId = ex.targetFolderId;
          targetSubfolder = null; // Reset subfolder for exceptions
          break;
        }
      }

      // Move item if target found
      if (targetFolderId !== null && folderMap[targetFolderId]) {
        let targetFolder = folderMap[targetFolderId];

        // Create subfolder if needed
        if (targetSubfolder !== null) {
          targetFolder = getOrCreateSubfolder(targetSubfolder, targetFolder);
        }

        item.parentFolder = targetFolder;
        moveCounts[targetFolderId] = (moveCounts[targetFolderId] || 0) + 1;

        // Apply label color (우선순위: 서브카테고리 > 카테고리 > 폴더)
        if (labelColorToApply !== null) {
          item.label = labelColorToApply;
        } else {
          // 폴더 라벨 컬러 체크 (가장 낮은 우선순위)
          for (let f = 0; f < config.folders.length; f++) {
            const fc = config.folders[f];
            if (fc.id === targetFolderId && fc.enableLabelColor && fc.labelColor) {
              item.label = fc.labelColor;
              break;
            }
          }
        }
      } else {
        result.skipped++;
      }
    }

    // Build result
    for (let i = 0; i < config.folders.length; i++) {
      const folder = config.folders[i];
      if (moveCounts[folder.id] > 0) {
        result.movedItems.push({
          folderId: folder.id,
          folderName: folder.name,
          count: moveCounts[folder.id],
        });
      }
    }

    // Delete empty folders if enabled
    if (config.settings?.deleteEmptyFolders !== false) {
      deleteEmptyFolders();
    }

    app.endUndoGroup();

  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
    // Only end undo group if it was successfully started
    if (undoGroupStarted) {
      try { app.endUndoGroup(); } catch (undoError) { /* ignore cleanup errors */ }
    }
  }

  return result;
};

/**
 * Get default configuration
 */
export const getDefaultConfig = (): OrganizerConfig => {
  return {
    folders: [
      {
        id: "render",
        name: "00_Render",
        order: 0,
        isRenderFolder: true,
        renderKeywords: ["_render", "_final", "_output", "_export", "RENDER_", "[RENDER]"],
        categories: [],
      },
      {
        id: "source",
        name: "01_Source",
        order: 1,
        isRenderFolder: false,
        categories: [
          { type: "Footage", enabled: true, createSubfolders: false, detectSequences: true },
          { type: "Images", enabled: true, createSubfolders: false, detectSequences: true },
          { type: "Audio", enabled: true, createSubfolders: false },
          { type: "Comps", enabled: true, createSubfolders: false },
        ],
      },
      {
        id: "system",
        name: "99_System",
        order: 99,
        isRenderFolder: false,
        categories: [
          { type: "Solids", enabled: true, createSubfolders: false },
        ],
      },
    ],
    exceptions: [],
  };
};
