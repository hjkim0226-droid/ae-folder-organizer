/**
 * Premiere Pro Snap Organizer - ExtendScript Core Logic
 * Config-based bin organization for Premiere Pro projects
 */

// Re-export utility
export { dispatchTS } from "../utils/utils";

import {
  validateProject,
  traverseBin,
  findBinByName,
  getOrCreateRootBin,
  getOrCreateBinPath,
  deleteEmptyBins,
  getFileExtension,
  getItemCategory,
  trimStr,
  VIDEO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
} from "./ppro-utils";

// ===== Types (Shared with JS) =====

interface FolderConfig {
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

interface CategoryConfig {
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

interface SubcategoryFilter {
  type: "ext" | "prefix" | "keyword";
  value: string;
}

interface SubcategoryConfig {
  id: string;
  name: string;
  order: number;
  filterType: "extension" | "keyword" | "all";
  extensions?: string[];
  keywords?: string[];
  filters?: SubcategoryFilter[];
  keywordRequired?: boolean;
  createSubfolders?: boolean;
  enableLabelColor?: boolean;
  labelColor?: number;
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
    applyFolderLabelColor?: boolean;
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
  comps: number;      // sequences in PPRO
  footage: number;    // video clips
  images: number;
  audio: number;
  sequences: number;
  solids: number;     // not used in PPRO
  folders: number;    // bins
}

interface ItemInfo {
  id: number;
  name: string;
  type: string;
}

interface RenameRequest {
  id: number;
  newName: string;
}

interface RenameResult {
  success: boolean;
  renamed: number;
  errors: string[];
}

// ===== Helper Functions =====

/**
 * Check if item name contains render keywords
 */
const isRenderSequence = (item: ProjectItem, keywords: string[]): boolean => {
  if (!item.isSequence()) return false;

  const name = item.name.toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    const keyword = trimStr(keywords[i]);
    if (keyword === "") continue;
    if (name.indexOf(keyword.toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
};

/**
 * Check if exception rule matches item
 */
const matchesException = (item: ProjectItem, exception: ExceptionRule): boolean => {
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
 * Match item to subcategory based on filters
 */
const matchSubcategory = (item: ProjectItem, subcategory: SubcategoryConfig): boolean => {
  const itemName = item.name.toLowerCase();
  const ext = getFileExtension(item.name);

  // New filter system
  if (subcategory.filters && subcategory.filters.length > 0) {
    for (let i = 0; i < subcategory.filters.length; i++) {
      const filter = subcategory.filters[i];
      if (filter.type === "ext") {
        if (filter.value.toLowerCase() === ext) return true;
      } else if (filter.type === "prefix") {
        if (itemName.indexOf(filter.value.toLowerCase()) === 0) return true;
      } else if (filter.type === "keyword") {
        if (itemName.indexOf(filter.value.toLowerCase()) !== -1) return true;
      }
    }
    return false;
  }

  // No filters = matches everything
  if (!subcategory.filters || subcategory.filters.length === 0) {
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

    if (!subcategory.extensions && !subcategory.keywords &&
      subcategory.filterType !== "extension" && subcategory.filterType !== "keyword") {
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
 * Collect all items from project for processing
 */
const collectAllItems = (): ProjectItem[] => {
  const items: ProjectItem[] = [];
  const root = app.project.rootItem;

  traverseBin(root, (item) => {
    if (item.type !== ProjectItemType.BIN) {
      items.push(item);
    }
  });

  return items;
};

// ===== Main Export Functions =====

/**
 * Get names of selected sequences
 */
export const getSelectedCompNames = (): string[] => {
  const validation = validateProject();
  if (!validation.valid) return [];

  const names: string[] = [];

  // Premiere Pro doesn't have direct selection API like AE
  // We traverse and check for sequences
  traverseBin(app.project.rootItem, (item) => {
    if (item.isSequence()) {
      names.push(item.name);
    }
  });

  return names;
};

/**
 * Get all selected items with their info for batch rename
 */
export const getSelectedItems = (): ItemInfo[] => {
  const validation = validateProject();
  if (!validation.valid) return [];

  const items: ItemInfo[] = [];

  // Collect all non-bin items
  traverseBin(app.project.rootItem, (item) => {
    if (item.type !== ProjectItemType.BIN) {
      let itemType = "clip";
      if (item.isSequence()) itemType = "sequence";
      items.push({
        id: parseInt(item.nodeId, 10) || 0,
        name: item.name,
        type: itemType,
      });
    }
  });

  return items;
};

/**
 * Batch rename items
 */
export const batchRenameItems = (requests: RenameRequest[]): RenameResult => {
  const validation = validateProject();
  if (!validation.valid) {
    return {
      success: false,
      renamed: 0,
      errors: [validation.error || "No project open"],
    };
  }

  const result: RenameResult = {
    success: true,
    renamed: 0,
    errors: [],
  };

  // Build a map of nodeId to item
  const itemMap: { [id: string]: ProjectItem } = {};
  traverseBin(app.project.rootItem, (item) => {
    itemMap[item.nodeId] = item;
  });

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    try {
      const item = itemMap[req.id.toString()];
      if (item && item.type !== ProjectItemType.BIN) {
        item.name = req.newName;
        result.renamed++;
      }
    } catch (e) {
      result.errors.push("Failed to rename item ID " + req.id);
      result.success = false;
    }
  }

  return result;
};

/**
 * Get project statistics
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
    };
  }

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

  traverseBin(app.project.rootItem, (item) => {
    stats.totalItems++;

    if (item.type === ProjectItemType.BIN) {
      stats.folders++;
    } else if (item.isSequence()) {
      stats.sequences++;
      stats.comps++;  // comps = sequences in PPRO
    } else {
      const category = getItemCategory(item);
      if (category === "Audio") {
        stats.audio++;
      } else if (category === "Images") {
        stats.images++;
      } else {
        stats.footage++;  // Video clips
      }
    }
  });

  return stats;
};

/**
 * Get label colors from Premiere Pro preferences
 * Uses app.properties.getProperty to read BE.Prefs.LabelColors
 * Returns array of 16 hex color strings (or empty if can't read)
 */
export const getLabelColors = (): string[] => {
  const colors: string[] = [];

  try {
    // PPro stores label colors in preferences as BE.Prefs.LabelColors.X
    // Color format might be decimal RGB or hex string
    for (let i = 0; i < 16; i++) {
      const colorProp = "BE.Prefs.LabelColors." + i;

      // @ts-ignore
      if (app.properties.doesPropertyExist(colorProp)) {
        // @ts-ignore
        const colorValue = app.properties.getProperty(colorProp);

        if (colorValue) {
          // Try to parse as decimal (e.g., 16711680 for red = 0xFF0000)
          const numValue = parseInt(colorValue, 10);
          if (!isNaN(numValue)) {
            // Convert decimal to hex color
            const hex = "#" + ("000000" + numValue.toString(16)).slice(-6);
            colors.push(hex);
          } else if (colorValue.charAt(0) === "#") {
            // Already hex format
            colors.push(colorValue);
          } else {
            colors.push("");
          }
        } else {
          colors.push("");
        }
      } else {
        colors.push("");
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

  // Initialize move counts
  const moveCounts: { [key: string]: number } = {};
  for (let i = 0; i < config.folders.length; i++) {
    moveCounts[config.folders[i].id] = 0;
  }

  try {
    const binNames: string[] = [];
    for (let fn = 0; fn < config.folders.length; fn++) {
      binNames.push(config.folders[fn].name);
    }

    // Create all bins first (sorted by order)
    const sortedFolders = config.folders.slice().sort(function (a, b) { return a.order - b.order; });
    const binMap: { [key: string]: ProjectItem } = {};

    for (let i = 0; i < sortedFolders.length; i++) {
      const fc = sortedFolders[i];
      binMap[fc.id] = getOrCreateRootBin(fc.name);
    }

    // Build category-to-folder mappings
    const categoryFolderMappings: { [key: string]: Array<{ folderId: string; config: CategoryConfig; order: number }> } = {};

    for (let i = 0; i < config.folders.length; i++) {
      const folder = config.folders[i];
      const cats = folder.categories || [];
      const sortedCats = cats.slice().sort(function (a: CategoryConfig, b: CategoryConfig) {
        return (a.order || 0) - (b.order || 0);
      });

      for (let j = 0; j < sortedCats.length; j++) {
        const cat = sortedCats[j];
        if (cat.enabled) {
          // Map PPRO categories to AE-style names
          let categoryType = cat.type;
          if (categoryType === "Comps") categoryType = "Sequences";
          if (categoryType === "Footage") categoryType = "Video";

          if (!categoryFolderMappings[categoryType]) {
            categoryFolderMappings[categoryType] = [];
          }
          categoryFolderMappings[categoryType].push({
            folderId: folder.id,
            config: cat,
            order: j + 1,
          });
        }
      }
    }

    // Collect items to process
    const itemsToProcess: ProjectItem[] = [];

    traverseBin(app.project.rootItem, (item) => {
      if (item.type === ProjectItemType.BIN) return;

      if (itemIds !== null) {
        let found = false;
        const itemNodeId = parseInt(item.nodeId, 10) || 0;
        for (let idIdx = 0; idIdx < itemIds.length; idIdx++) {
          if (itemIds[idIdx] === itemNodeId) {
            found = true;
            break;
          }
        }
        if (!found) return;
      }

      itemsToProcess.push(item);
    });

    // Process each item
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      let targetFolderId: string | null = null;
      let targetSubfolder: string | null = null;
      let labelColorToApply: number | null = null;  // 라벨 컬러 추적

      // 1. Check render folders first
      for (let j = 0; j < config.folders.length; j++) {
        const folder = config.folders[j];
        if (folder.isRenderFolder && folder.renderKeywords) {
          if (isRenderSequence(item, folder.renderKeywords)) {
            targetFolderId = folder.id;
            break;
          }
        }
      }

      // 2. If not render, categorize by type
      if (targetFolderId === null) {
        let categoryType = getItemCategory(item);

        // Map to config category names
        if (categoryType === "Sequences") {
          // Check if there's a "Comps" mapping (AE terminology)
          if (categoryFolderMappings["Sequences"]) {
            categoryType = "Sequences";
          } else if (categoryFolderMappings["Comps"]) {
            categoryType = "Comps";
          }
        }

        if (categoryType !== null) {
          const mappings = categoryFolderMappings[categoryType];
          if (mappings && mappings.length > 0) {
            let selectedMapping = mappings[0];
            const itemName = item.name.toLowerCase();

            // Find best matching folder based on keywords
            for (let m = 0; m < mappings.length; m++) {
              const mapping = mappings[m];
              const keywords = mapping.config.keywords;

              if (keywords && keywords.length > 0) {
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

            // 카테고리 라벨 컬러 체크
            if (selectedMapping.config.enableLabelColor && selectedMapping.config.labelColor) {
              labelColorToApply = selectedMapping.config.labelColor;
            }

            // Create numbered category subfolder
            const orderPrefix = (selectedMapping.order < 10 ? "0" : "") + selectedMapping.order;
            const displayCategoryType = categoryType === "Comps" ? "Sequences" : categoryType;
            const numberedCategoryName = orderPrefix + "_" + displayCategoryType;
            targetSubfolder = numberedCategoryName;

            // Check for subcategories
            const subcats = selectedMapping.config.subcategories;
            if (subcats && subcats.length > 0) {
              let matchedSubcat: SubcategoryConfig | null = null;

              const sortedSubcats = subcats.slice().sort(function (a: SubcategoryConfig, b: SubcategoryConfig) {
                return a.order - b.order;
              });

              for (let s = 0; s < sortedSubcats.length; s++) {
                if (matchSubcategory(item, sortedSubcats[s])) {
                  matchedSubcat = sortedSubcats[s];
                  break;
                }
              }

              if (matchedSubcat) {
                const subPrefix = (matchedSubcat.order < 10 ? "0" : "") + matchedSubcat.order;
                targetSubfolder = numberedCategoryName + "/" + subPrefix + "_" + matchedSubcat.name;

                // 서브카테고리 라벨 컬러 체크 (가장 높은 우선순위)
                if (matchedSubcat.enableLabelColor && matchedSubcat.labelColor) {
                  labelColorToApply = matchedSubcat.labelColor;
                }
              } else if (sortedSubcats.length >= 2) {
                const othersName = generateOthersFolderName(sortedSubcats.length);
                targetSubfolder = numberedCategoryName + "/" + othersName;
              }
            } else if (selectedMapping.config.createSubfolders) {
              // Extension-based sub-subfolder
              const ext = getFileExtension(item.name).toUpperCase();
              if (ext) {
                targetSubfolder = numberedCategoryName + "/_" + ext;
              }
            }
          }
        }
      }

      // 3. Apply exception rules
      for (let j = 0; j < config.exceptions.length; j++) {
        const ex = config.exceptions[j];
        if (matchesException(item, ex)) {
          targetFolderId = ex.targetFolderId;
          targetSubfolder = null;
          break;
        }
      }

      // Move item if target found
      if (targetFolderId !== null && binMap[targetFolderId]) {
        let targetBin = binMap[targetFolderId];

        // Create subfolder if needed
        if (targetSubfolder !== null) {
          targetBin = getOrCreateBinPath(targetSubfolder, targetBin);
        }

        // Move item to target bin
        const moveResult = item.moveBin(targetBin);
        if (moveResult === 0) {  // 0 = success in PPRO
          moveCounts[targetFolderId] = (moveCounts[targetFolderId] || 0) + 1;

          // Apply label color (우선순위: 서브카테고리 > 카테고리 > 폴더)
          if (labelColorToApply !== null) {
            try {
              item.setColorLabel(labelColorToApply);
            } catch (labelErr) {
              // Ignore label color errors
            }
          } else {
            // 폴더 라벨 컬러 체크 (가장 낮은 우선순위)
            for (let f = 0; f < config.folders.length; f++) {
              const fc = config.folders[f];
              if (fc.id === targetFolderId && fc.enableLabelColor && fc.labelColor) {
                try {
                  item.setColorLabel(fc.labelColor);
                } catch (labelErr) {
                  // Ignore label color errors
                }
                break;
              }
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

    // Delete empty bins if enabled
    if (config.settings?.deleteEmptyFolders !== false) {
      deleteEmptyBins(app.project.rootItem);
    }

  } catch (e: any) {
    result.success = false;
    result.error = e.toString();
  }

  return result;
};

/**
 * Get default configuration (adapted for Premiere Pro)
 */
export const getDefaultConfig = (): OrganizerConfig => {
  return {
    folders: [
      {
        id: "render",
        name: "00_Export",
        order: 0,
        isRenderFolder: true,
        renderKeywords: ["_render", "_final", "_output", "_export", "EXPORT_", "[EXPORT]"],
        categories: [],
      },
      {
        id: "source",
        name: "01_Source",
        order: 1,
        isRenderFolder: false,
        categories: [
          { type: "Comps", enabled: true, createSubfolders: false },  // Sequences
          { type: "Footage", enabled: true, createSubfolders: false },  // Video
          { type: "Images", enabled: true, createSubfolders: false },
          { type: "Audio", enabled: true, createSubfolders: false },
        ],
      },
      {
        id: "system",
        name: "99_System",
        order: 99,
        isRenderFolder: false,
        categories: [],
      },
    ],
    exceptions: [],
  };
};
