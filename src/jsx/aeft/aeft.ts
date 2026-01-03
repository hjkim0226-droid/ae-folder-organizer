/**
 * AE Folder Organizer - ExtendScript Core Logic v1.1
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
  const ext = getFileExtension(item.name);

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
  const ext = getFileExtension(item.name).toUpperCase();
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

    // Get extension for categorization
    const ext = getFileExtension(item.name);

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
  };

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
  error?: string;
}

/**
 * Isolate missing footage items to _Missing folder
 */
export const isolateMissingFootage = (): IsolateResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return { success: false, movedCount: 0, folderName: "", error: validation.error };
  }

  const result: IsolateResult = {
    success: true,
    movedCount: 0,
    folderName: "_Missing",
  };

  try {
    app.beginUndoGroup("Isolate Missing Footage");

    const project = app.project;
    const missingFolder = getOrCreateRootFolder("_Missing");

    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);
      if (item instanceof FootageItem && item.footageMissing) {
        item.parentFolder = missingFolder;
        result.movedCount++;
      }
    }

    app.endUndoGroup();
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
 * Isolate unused items to _Unused folder
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
    folderName: "_Unused",
  };

  try {
    app.beginUndoGroup("Isolate Unused Assets");

    const project = app.project;
    const unusedFolder = getOrCreateRootFolder("_Unused");
    const usedIds = getUsedItemIds(renderKeywords);

    // Collect items to move (avoid modifying while iterating)
    const itemsToMove: Item[] = [];

    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);

      // Skip folders
      if (item instanceof FolderItem) continue;

      // Skip solids (usually intentionally unused)
      if (item instanceof FootageItem && isSolid(item)) continue;

      // Skip items already in _Unused or _Missing folders
      if (item.parentFolder && (item.parentFolder.name === "_Unused" || item.parentFolder.name === "_Missing")) continue;

      // If not used, mark for moving
      if (!usedIds[item.id]) {
        itemsToMove.push(item);
      }
    }

    // Move items
    for (let i = 0; i < itemsToMove.length; i++) {
      itemsToMove[i].parentFolder = unusedFolder;
      result.movedCount++;
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
    app.beginUndoGroup("AE Folder Organizer");
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
