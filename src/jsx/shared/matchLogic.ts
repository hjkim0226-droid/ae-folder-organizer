/**
 * Shared Match Logic for ExtendScript
 * Pure functions for matching items to categories/subcategories
 * No host-specific API dependencies (works for both AE and PPro)
 */

import { SubcategoryConfig, SubcategoryFilter, ExceptionRule } from "./types";

// ===== String Utilities (ES3 compatible) =====

/**
 * ES3-compatible trim function
 */
export function trimStr(str: string): string {
  return str.replace(/^\s+|\s+$/g, "");
}

/**
 * Get file extension from filename (lowercase)
 * Handles sequence patterns like "name.[####].exr" or "name.0001.exr"
 */
export function getFileExtension(name: string): string {
  // Handle sequence patterns
  var cleanName = name.replace(/\[\#+\]/g, "0000").replace(/\.\d{4,}\./, ".");
  var parts = cleanName.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return "";
}

// ===== Exception Matching =====

/**
 * Check if exception rule matches item name
 * Pure function - takes name, not item object
 */
export function matchesException(
  itemName: string,
  exception: ExceptionRule
): boolean {
  var name = itemName.toLowerCase();
  var pattern = exception.pattern.toLowerCase();

  if (exception.type === "nameContains") {
    return name.indexOf(pattern) !== -1;
  } else if (exception.type === "extension") {
    var ext = getFileExtension(itemName);
    var patternExt = pattern.replace(/^\./, "");
    return ext === patternExt;
  }

  return false;
}

/**
 * Find first matching exception rule
 */
export function findMatchingException(
  itemName: string,
  exceptions: ExceptionRule[]
): ExceptionRule | null {
  for (var i = 0; i < exceptions.length; i++) {
    if (matchesException(itemName, exceptions[i])) {
      return exceptions[i];
    }
  }
  return null;
}

// ===== Render Comp Detection =====

/**
 * Check if name contains any render keyword
 */
export function matchesRenderKeywords(
  name: string,
  keywords: string[]
): boolean {
  if (!keywords || keywords.length === 0) return false;

  var nameLower = name.toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    var kw = trimStr(keywords[i]);
    if (kw === "") continue;
    if (nameLower.indexOf(kw.toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

// ===== Subcategory Matching =====

/**
 * Check if item matches a single filter
 */
export function matchesFilter(
  itemName: string,
  filter: SubcategoryFilter
): boolean {
  var name = itemName.toLowerCase();
  var value = filter.value.toLowerCase();

  if (filter.type === "ext") {
    var ext = getFileExtension(itemName);
    return ext === value || ext === value.replace(/^\./, "");
  } else if (filter.type === "prefix") {
    return name.indexOf(value) === 0;
  } else if (filter.type === "keyword") {
    return name.indexOf(value) !== -1;
  }

  return false;
}

/**
 * Check if item matches any filter in a list
 */
export function matchesAnyFilter(
  itemName: string,
  filters: SubcategoryFilter[]
): boolean {
  for (var i = 0; i < filters.length; i++) {
    if (matchesFilter(itemName, filters[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Get filters from subcategory (handles legacy format)
 */
export function getSubcategoryFilters(
  subcat: SubcategoryConfig
): SubcategoryFilter[] {
  // New unified filter system
  if (subcat.filters && subcat.filters.length > 0) {
    return subcat.filters;
  }

  // Convert legacy formats
  var filters: SubcategoryFilter[] = [];

  // Legacy extensions
  if (subcat.extensions && subcat.extensions.length > 0) {
    for (var i = 0; i < subcat.extensions.length; i++) {
      filters.push({
        type: "ext",
        value: subcat.extensions[i].toLowerCase(),
      });
    }
  }

  // Legacy keywords
  if (subcat.keywords && subcat.keywords.length > 0) {
    for (var j = 0; j < subcat.keywords.length; j++) {
      filters.push({
        type: "keyword",
        value: subcat.keywords[j].toLowerCase(),
      });
    }
  }

  return filters;
}

/**
 * Check if item matches subcategory's filters
 */
export function matchSubcategory(
  itemName: string,
  subcategory: SubcategoryConfig
): boolean {
  var filters = getSubcategoryFilters(subcategory);

  // New filter system
  if (filters.length > 0) {
    return matchesAnyFilter(itemName, filters);
  }

  // No filters defined
  if (subcategory.keywordRequired) {
    return false;
  }

  // Match all if filterType is "all"
  if (subcategory.filterType === "all") {
    return true;
  }

  // If no filters and no legacy fields, don't match
  return false;
}

/**
 * Find matching subcategory for an item
 * Returns first match by order
 */
export function findMatchingSubcategory(
  itemName: string,
  subcategories: SubcategoryConfig[]
): SubcategoryConfig | null {
  // Sort by order first
  var sorted = subcategories.slice().sort(function (a, b) {
    return (a.order || 0) - (b.order || 0);
  });

  for (var i = 0; i < sorted.length; i++) {
    if (matchSubcategory(itemName, sorted[i])) {
      return sorted[i];
    }
  }

  return null;
}

// ===== Folder Name Generation =====

/**
 * Generate Others folder name with proper numbering
 */
export function generateOthersFolderName(existingCount: number): string {
  var orderNum = existingCount + 1;
  var prefix = (orderNum < 10 ? "0" : "") + orderNum;
  return prefix + "_Others";
}

/**
 * Generate display folder name with order prefix
 */
export function getDisplayFolderName(
  folderName: string,
  folderId: string,
  index: number
): string {
  if (folderId === "system") {
    return "99_" + folderName;
  }
  var prefix = index < 10 ? "0" + index : "" + index;
  return prefix + "_" + folderName;
}

// ===== Extension Categories =====

export var VIDEO_EXTENSIONS = [
  "mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mxf"
];

export var IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "psd", "tif", "tiff", "gif", "bmp", "ai", "eps", "svg"
];

export var SEQUENCE_IMAGE_EXTENSIONS = [
  "png", "jpg", "jpeg", "tif", "tiff", "tga", "bmp", "gif"
];

export var SEQUENCE_CG_EXTENSIONS = [
  "exr", "dpx", "cin", "hdr"
];

export var AUDIO_EXTENSIONS = [
  "mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"
];

// Combined for sequence detection
export var ALL_SEQUENCE_EXTENSIONS = SEQUENCE_IMAGE_EXTENSIONS.concat(
  SEQUENCE_CG_EXTENSIONS
);

/**
 * Check if extension is in array (ES3 compatible)
 */
export function extensionInArray(ext: string, arr: string[]): boolean {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === ext) return true;
  }
  return false;
}
