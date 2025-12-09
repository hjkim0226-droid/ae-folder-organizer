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
}

interface CategoryConfig {
  type: string;
  enabled: boolean;
  order?: number;
  createSubfolders: boolean;
  detectSequences?: boolean;
  keywords?: string[];
  subcategories?: SubcategoryConfig[];
}

interface SubcategoryConfig {
  id: string;
  name: string;
  order: number;
  filterType: "extension" | "keyword" | "all";
  extensions?: string[];
  keywords?: string[];
  keywordRequired?: boolean;
  createSubfolders?: boolean;
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
 * Match item to subcategory based on filterType
 */
const matchSubcategory = (item: Item, subcategory: SubcategoryConfig): boolean => {
  // keywordRequired = true means no filtering
  if (subcategory.keywordRequired) return false;

  // all type matches everything
  if (subcategory.filterType === "all") return true;

  const itemName = item.name.toLowerCase();
  const ext = getFileExtension(item.name);

  if (subcategory.filterType === "extension" && subcategory.extensions) {
    for (let i = 0; i < subcategory.extensions.length; i++) {
      if (subcategory.extensions[i].toLowerCase() === ext) return true;
    }
  }

  if (subcategory.filterType === "keyword" && subcategory.keywords) {
    for (let i = 0; i < subcategory.keywords.length; i++) {
      const kw = subcategory.keywords[i];
      if (kw && itemName.indexOf(kw.toLowerCase()) !== -1) return true;
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
  const project = app.project;
  const items: ItemInfo[] = [];
  const selection = project.selection;

  for (let i = 0; i < selection.length; i++) {
    const item = selection[i];
    if (!(item instanceof FolderItem)) {
      let itemType = "unknown";
      if (item instanceof CompItem) itemType = "comp";
      else if (item instanceof FootageItem) itemType = "footage";

      items.push({
        id: item.id,
        name: item.name,
        type: itemType,
      });
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
 * Get project statistics
 */
export const getProjectStats = (): ProjectStats => {
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
  };

  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    stats.totalItems++;

    if (item instanceof CompItem) {
      stats.comps++;
    } else if (item instanceof FolderItem) {
      stats.folders++;
    } else if (item instanceof FootageItem) {
      if (isSolid(item)) {
        stats.solids++;
      } else if (isSequence(item)) {
        stats.sequences++;
      } else {
        const ext = getFileExtension(item.name);
        if (AUDIO_EXTENSIONS.indexOf(ext) !== -1) {
          stats.audio++;
        } else if (IMAGE_EXTENSIONS.indexOf(ext) !== -1) {
          stats.images++;
        } else {
          stats.footage++;
        }
      }
    }
  }

  return stats;
};

/**
 * Main organize function with config
 */
export const organizeProject = (configJson: string, itemIdsJson?: string): OrganizeResult => {
  const config: OrganizerConfig = JSON.parse(configJson);
  const itemIds: number[] | null = itemIdsJson ? JSON.parse(itemIdsJson) : null;

  const result: OrganizeResult = {
    success: true,
    movedItems: [],
    skipped: 0,
  };

  // Initialize move counts
  const moveCounts: { [key: string]: number } = {};
  for (let i = 0; i < config.folders.length; i++) {
    moveCounts[config.folders[i].id] = 0;
  }

  try {
    app.beginUndoGroup("AE Folder Organizer");

    const project = app.project;
    const folderNames = config.folders.map(function (f) { return f.name; });

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
        if (itemIds.indexOf(item.id) === -1) continue;
      }

      itemsToProcess.push(item);
    }

    // Process each item
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      let targetFolderId: string | null = null;
      let targetSubfolder: string | null = null;

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
          // Handle "Sequences" - only create subfolder if createSubfolders is enabled
          if (categoryType === "Sequences" && item instanceof FootageItem) {
            if (footageMappings && footageMappings.length > 0) {
              targetFolderId = footageMappings[0].folderId;
              const orderPrefix = (footageMappings[0].order < 10 ? "0" : "") + footageMappings[0].order;

              // Only create Sequences subfolder if createSubfolders is checked
              if (footageMappings[0].config.createSubfolders) {
                const seqType = getSequenceType(item); // e.g., "EXR Sequence"
                targetSubfolder = orderPrefix + "_Footage/Sequences/" + seqType;
              } else {
                // Just put in Footage folder without sequence subfolder
                targetSubfolder = orderPrefix + "_Footage";
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
    try { app.endUndoGroup(); } catch (x) { }
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
