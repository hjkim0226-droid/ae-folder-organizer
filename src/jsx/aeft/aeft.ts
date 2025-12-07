/**
 * AE Folder Organizer - ExtendScript Core Logic
 * Organizes After Effects project panel items into 01_Render and 02_Data folders
 */

// Re-export utility
export { dispatchTS } from "../utils/utils";

// ===== Types =====
interface OrganizerConfig {
  renderFolderName: string;
  dataFolderName: string;
  renderKeywords: string[];
  organizeSubfolders: boolean;
  hideSystemItems: boolean;
}

interface OrganizeResult {
  success: boolean;
  movedToRender: number;
  movedToData: number;
  skipped: number;
  error?: string;
}

interface ProjectStats {
  totalItems: number;
  comps: number;
  footage: number;
  folders: number;
  solids: number;
}

// ===== Default Config =====
const DEFAULT_CONFIG: OrganizerConfig = {
  renderFolderName: "01_Render",
  dataFolderName: "02_Data",
  renderKeywords: ["_render", "_final", "_output", "_export", "RENDER_", "[RENDER]"],
  organizeSubfolders: true,
  hideSystemItems: true,
};

// ===== Helper Functions =====

/**
 * Check if item name contains any render keywords
 */
const isRenderComp = (item: Item, keywords: string[]): boolean => {
  if (!(item instanceof CompItem)) return false;

  const name = item.name.toLowerCase();
  for (const keyword of keywords) {
    if (name.indexOf(keyword.toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
};

/**
 * Check if item is a Solid or other system item
 */
const isSystemItem = (item: Item): boolean => {
  if (!(item instanceof FootageItem)) return false;

  const source = item.mainSource;
  if (source instanceof SolidSource) return true;

  // Check for null objects by name pattern
  const name = item.name.toLowerCase();
  if (name.indexOf("null") !== -1 || name.indexOf("controller") !== -1) {
    return true;
  }

  return false;
};

/**
 * Get file extension from item name
 */
const getFileExtension = (name: string): string => {
  const parts = name.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return "";
};

/**
 * Determine subfolder category for footage items
 */
const getFootageCategory = (item: FootageItem): string => {
  const ext = getFileExtension(item.name);

  // Video
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv"].indexOf(ext) !== -1) {
    return "_Footage";
  }

  // Images
  if (["jpg", "jpeg", "png", "psd", "tif", "tiff", "gif", "bmp", "ai", "eps", "svg", "exr"].indexOf(ext) !== -1) {
    return "_Images";
  }

  // Audio
  if (["mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"].indexOf(ext) !== -1) {
    return "_Audio";
  }

  // Data files
  if (["json", "csv", "xml", "txt", "xlsx", "xls"].indexOf(ext) !== -1) {
    return "_Data";
  }

  return "_Misc";
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
 * Find or create a subfolder inside a parent folder
 */
const getOrCreateSubfolder = (name: string, parent: FolderItem): FolderItem => {
  // Search for existing subfolder
  for (let i = 1; i <= parent.numItems; i++) {
    const item = parent.item(i);
    if (item instanceof FolderItem && item.name === name) {
      return item;
    }
  }

  // Create new subfolder
  const folder = app.project.items.addFolder(name);
  folder.parentFolder = parent;
  return folder;
};

/**
 * Check if item is already in the target folder structure
 */
const isInFolder = (item: Item, folderName: string): boolean => {
  let current = item.parentFolder;

  while (current !== null && current !== app.project.rootFolder) {
    if (current.name === folderName) {
      return true;
    }
    current = current.parentFolder;
  }

  return false;
};

/**
 * Check if item is at root level (not in any folder)
 */
const isAtRoot = (item: Item): boolean => {
  return item.parentFolder === app.project.rootFolder;
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
    folders: 0,
    solids: 0,
  };

  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);
    stats.totalItems++;

    if (item instanceof CompItem) {
      stats.comps++;
    } else if (item instanceof FolderItem) {
      stats.folders++;
    } else if (item instanceof FootageItem) {
      if (item.mainSource instanceof SolidSource) {
        stats.solids++;
      } else {
        stats.footage++;
      }
    }
  }

  return stats;
};

/**
 * Preview what would be organized (dry run)
 */
export const previewOrganize = (configJson: string): string => {
  const config: OrganizerConfig = configJson ? JSON.parse(configJson) : DEFAULT_CONFIG;

  const preview = {
    toRender: [] as string[],
    toData: [] as string[],
    toSystem: [] as string[],
    skipped: [] as string[],
  };

  const project = app.project;

  for (let i = 1; i <= project.numItems; i++) {
    const item = project.item(i);

    // Skip folders
    if (item instanceof FolderItem) {
      continue;
    }

    // Skip items already in organized folders
    if (isInFolder(item, config.renderFolderName) || isInFolder(item, config.dataFolderName)) {
      preview.skipped.push(item.name);
      continue;
    }

    // Classify item
    if (isRenderComp(item, config.renderKeywords)) {
      preview.toRender.push(item.name);
    } else if (config.hideSystemItems && isSystemItem(item)) {
      preview.toSystem.push(item.name);
    } else {
      preview.toData.push(item.name);
    }
  }

  return JSON.stringify(preview);
};

/**
 * Main organize function
 */
export const organizeProject = (configJson?: string): OrganizeResult => {
  const config: OrganizerConfig = configJson ? JSON.parse(configJson) : DEFAULT_CONFIG;

  const result: OrganizeResult = {
    success: true,
    movedToRender: 0,
    movedToData: 0,
    skipped: 0,
  };

  try {
    app.beginUndoGroup("AE Folder Organizer");

    const project = app.project;

    // Create main folders
    const renderFolder = getOrCreateRootFolder(config.renderFolderName);
    const dataFolder = getOrCreateRootFolder(config.dataFolderName);

    // Create Data subfolders if enabled
    let compsFolder: FolderItem | null = null;
    let footageFolder: FolderItem | null = null;
    let imagesFolder: FolderItem | null = null;
    let audioFolder: FolderItem | null = null;
    let systemFolder: FolderItem | null = null;
    let miscFolder: FolderItem | null = null;

    if (config.organizeSubfolders) {
      compsFolder = getOrCreateSubfolder("_Comps", dataFolder);
      footageFolder = getOrCreateSubfolder("_Footage", dataFolder);
      imagesFolder = getOrCreateSubfolder("_Images", dataFolder);
      audioFolder = getOrCreateSubfolder("_Audio", dataFolder);
      miscFolder = getOrCreateSubfolder("_Misc", dataFolder);
    }

    if (config.hideSystemItems) {
      systemFolder = getOrCreateSubfolder("_System", dataFolder);
    }

    // Collect items to move (iterate backwards to avoid index issues)
    const itemsToMove: { item: Item; targetFolder: FolderItem }[] = [];

    for (let i = 1; i <= project.numItems; i++) {
      const item = project.item(i);

      // Skip folders
      if (item instanceof FolderItem) {
        continue;
      }

      // Skip items already in organized folders
      if (isInFolder(item, config.renderFolderName) || isInFolder(item, config.dataFolderName)) {
        result.skipped++;
        continue;
      }

      // Determine target folder
      let targetFolder: FolderItem;

      if (isRenderComp(item, config.renderKeywords)) {
        targetFolder = renderFolder;
        result.movedToRender++;
      } else if (config.hideSystemItems && isSystemItem(item) && systemFolder) {
        targetFolder = systemFolder;
        result.movedToData++;
      } else if (item instanceof CompItem) {
        targetFolder = compsFolder || dataFolder;
        result.movedToData++;
      } else if (item instanceof FootageItem) {
        if (config.organizeSubfolders) {
          const category = getFootageCategory(item);
          switch (category) {
            case "_Footage":
              targetFolder = footageFolder || dataFolder;
              break;
            case "_Images":
              targetFolder = imagesFolder || dataFolder;
              break;
            case "_Audio":
              targetFolder = audioFolder || dataFolder;
              break;
            default:
              targetFolder = miscFolder || dataFolder;
          }
        } else {
          targetFolder = dataFolder;
        }
        result.movedToData++;
      } else {
        targetFolder = miscFolder || dataFolder;
        result.movedToData++;
      }

      itemsToMove.push({ item, targetFolder });
    }

    // Move items
    for (const { item, targetFolder } of itemsToMove) {
      item.parentFolder = targetFolder;
    }

    app.endUndoGroup();

  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
    app.endUndoGroup();
  }

  return result;
};

/**
 * Get current configuration (for UI initialization)
 */
export const getDefaultConfig = (): OrganizerConfig => {
  return DEFAULT_CONFIG;
};
