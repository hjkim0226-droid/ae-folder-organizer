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
  createSubfolders: boolean;
  detectSequences?: boolean;
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
const SEQUENCE_EXTENSIONS = ["exr", "dpx", "tga", "cin", "hdr"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"];

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
 * Check if item is an image sequence
 */
const isSequence = (item: FootageItem): boolean => {
  if (!(item.mainSource instanceof FileSource)) return false;

  const name = item.name;

  // Pattern 1: name_[####].ext or name[####].ext
  if (/\[\#+\]\.\w+$/.test(name)) return true;

  // Pattern 2: name.0001.ext (4+ digits)
  if (/\.\d{4,}\.\w+$/.test(name)) return true;

  // Pattern 3: name_0001.ext (4+ digits with underscore)
  if (/_\d{4,}\.\w+$/.test(name)) return true;

  // Check extension - common sequence formats
  const ext = getFileExtension(name);
  if (SEQUENCE_EXTENSIONS.indexOf(ext) !== -1) {
    // If it's a sequence extension and has multiple frames duration
    if (item.hasVideo && !item.hasAudio) {
      if (item.duration > item.frameDuration * 2) return true;
    }
  }

  return false;
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
    if (name.indexOf(keywords[i].toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
};

/**
 * Determine item category type
 */
const getItemCategory = (item: Item, detectSequences: boolean): string | null => {
  if (item instanceof CompItem) return "Comps";
  if (item instanceof FolderItem) return null;

  if (item instanceof FootageItem) {
    // Check for Solid first
    if (isSolid(item)) return "Solids";

    // Check for Sequence
    if (detectSequences && isSequence(item)) return "Sequences";

    const ext = getFileExtension(item.name);

    // Video
    if (VIDEO_EXTENSIONS.indexOf(ext) !== -1) return "Footage";

    // Images
    if (IMAGE_EXTENSIONS.indexOf(ext) !== -1 || SEQUENCE_EXTENSIONS.indexOf(ext) !== -1) {
      return "Images";
    }

    // Audio
    if (AUDIO_EXTENSIONS.indexOf(ext) !== -1) return "Audio";

    return "Footage"; // Default to Footage for unknown
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

    // Build category-to-folder mapping
    const categoryFolderMap: { [key: string]: { folderId: string; config: CategoryConfig } } = {};

    for (let i = 0; i < config.folders.length; i++) {
      const folder = config.folders[i];
      const cats = folder.categories || [];
      for (let j = 0; j < cats.length; j++) {
        const cat = cats[j];
        if (cat.enabled) {
          categoryFolderMap[cat.type] = { folderId: folder.id, config: cat };
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

      // 2. If not render, categorize by type
      if (targetFolderId === null) {
        // Determine if we should detect sequences
        let detectSequences = false;
        const footageCat = categoryFolderMap["Footage"];
        if (footageCat && footageCat.config.detectSequences) {
          detectSequences = true;
        }

        const categoryType = getItemCategory(item, detectSequences);

        if (categoryType !== null) {
          // Handle "Sequences" as a subfolder of Footage/Images
          if (categoryType === "Sequences") {
            const footageMapping = categoryFolderMap["Footage"];
            if (footageMapping) {
              targetFolderId = footageMapping.folderId;
              if (footageMapping.config.createSubfolders) {
                targetSubfolder = "_Sequences";
              }
            }
          } else {
            const mapping = categoryFolderMap[categoryType];
            if (mapping) {
              targetFolderId = mapping.folderId;

              // Always create category subfolder (e.g., Comps, Footage, Images)
              targetSubfolder = categoryType;

              // If createSubfolders is enabled, create extension-based sub-subfolder
              if (mapping.config.createSubfolders && item instanceof FootageItem) {
                const ext = getFileExtension(item.name).toUpperCase();
                if (ext) {
                  // Will create nested: Footage/_MP4
                  targetSubfolder = categoryType + "/_" + ext;
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
