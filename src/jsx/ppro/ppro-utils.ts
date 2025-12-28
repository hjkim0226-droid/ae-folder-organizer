/**
 * Premiere Pro Folder Organizer - Utility Functions
 * Handles Bin traversal and manipulation for Premiere Pro projects
 */

// ===== Project Validation =====

export const validateProject = (): { valid: boolean; error?: string } => {
  if (!app.project) {
    return { valid: false, error: "No project open" };
  }
  if (!app.project.rootItem) {
    return { valid: false, error: "Project has no root item" };
  }
  return { valid: true };
};

// ===== Bin Traversal =====

/**
 * Traverse all items in a bin recursively
 */
export const traverseBin = (
  bin: ProjectItem,
  callback: (item: ProjectItem, depth: number) => void,
  depth: number = 0
): void => {
  if (!bin.children) return;

  for (let i = 0; i < bin.children.numItems; i++) {
    const child = bin.children[i];
    callback(child, depth);

    // Recursively traverse if it's a bin
    if (child.type === ProjectItemType.BIN) {
      traverseBin(child, callback, depth + 1);
    }
  }
};

/**
 * Find a bin by name within a parent bin
 */
export const findBinByName = (parent: ProjectItem, name: string): ProjectItem | null => {
  if (!parent.children) return null;

  for (let i = 0; i < parent.children.numItems; i++) {
    const child = parent.children[i];
    if (child.type === ProjectItemType.BIN && child.name === name) {
      return child;
    }
  }
  return null;
};

/**
 * Get or create a bin at the root level
 */
export const getOrCreateRootBin = (name: string): ProjectItem => {
  const root = app.project.rootItem;
  const existing = findBinByName(root, name);

  if (existing) {
    return existing;
  }

  // Create new bin at root
  root.createBin(name);

  // Find and return the newly created bin
  return findBinByName(root, name)!;
};

/**
 * Get or create a nested bin path (e.g., "Footage/Sequences/EXR")
 */
export const getOrCreateBinPath = (path: string, parent: ProjectItem): ProjectItem => {
  const parts = path.split("/");
  let current = parent;

  for (let i = 0; i < parts.length; i++) {
    const name = parts[i];
    if (!name) continue;

    const existing = findBinByName(current, name);
    if (existing) {
      current = existing;
    } else {
      current.createBin(name);
      const newBin = findBinByName(current, name);
      if (newBin) {
        current = newBin;
      }
    }
  }

  return current;
};

/**
 * Check if a bin is empty
 */
export const isEmptyBin = (bin: ProjectItem): boolean => {
  if (bin.type !== ProjectItemType.BIN) return false;
  if (!bin.children) return true;
  return bin.children.numItems === 0;
};

/**
 * Delete empty bins recursively
 * Returns the count of deleted bins
 */
export const deleteEmptyBins = (parent: ProjectItem): number => {
  let deletedCount = 0;
  let foundEmpty = true;

  while (foundEmpty) {
    foundEmpty = false;

    if (!parent.children) break;

    // Iterate backwards for safe deletion
    for (let i = parent.children.numItems - 1; i >= 0; i--) {
      const child = parent.children[i];

      if (child.type === ProjectItemType.BIN) {
        // First, recursively clean child bins
        deletedCount += deleteEmptyBins(child);

        // Then check if this bin is now empty
        if (isEmptyBin(child)) {
          child.deleteBin();
          deletedCount++;
          foundEmpty = true;
        }
      }
    }
  }

  return deletedCount;
};

// ===== Item Type Detection =====

/**
 * Get file extension from item name
 */
export const getFileExtension = (name: string): string => {
  // Handle sequence patterns like "name.[####].exr" or "name.0001.exr"
  const cleanName = name.replace(/\[\#+\]/g, "0000").replace(/\.\d{4,}\./, ".");
  const parts = cleanName.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return "";
};

/**
 * Check if item is a sequence in Premiere Pro
 */
export const isSequence = (item: ProjectItem): boolean => {
  return item.isSequence();
};

/**
 * Check if item is a bin
 */
export const isBin = (item: ProjectItem): boolean => {
  return item.type === ProjectItemType.BIN;
};

/**
 * Check if item is a clip (video/audio/image)
 */
export const isClip = (item: ProjectItem): boolean => {
  return item.type === ProjectItemType.CLIP;
};

// ===== Extension Categories =====

export const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mxf", "prproj"];
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "psd", "tif", "tiff", "gif", "bmp", "ai", "eps", "svg"];
export const AUDIO_EXTENSIONS = ["mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"];
export const GRAPHICS_EXTENSIONS = ["mogrt", "psd", "ai", "eps"];

/**
 * Determine item category based on extension
 */
export const getItemCategory = (item: ProjectItem): string | null => {
  if (item.type === ProjectItemType.BIN) return null;

  // Check if it's a sequence first
  if (item.isSequence()) return "Sequences";

  const ext = getFileExtension(item.name);

  // Check Audio first (more specific)
  for (let i = 0; i < AUDIO_EXTENSIONS.length; i++) {
    if (AUDIO_EXTENSIONS[i] === ext) return "Audio";
  }

  // Check Images
  for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
    if (IMAGE_EXTENSIONS[i] === ext) return "Images";
  }

  // Check Graphics (Motion Graphics Templates)
  for (let i = 0; i < GRAPHICS_EXTENSIONS.length; i++) {
    if (GRAPHICS_EXTENSIONS[i] === ext) return "Graphics";
  }

  // Default: treat as Video
  return "Video";
};

// ===== ES3-compatible helpers =====

export const trimStr = (str: string): string => {
  return str.replace(/^\s+|\s+$/g, "");
};
