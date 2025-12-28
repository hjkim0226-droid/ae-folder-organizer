/**
 * AE Folder Organizer - Category Models
 * Pure functions for category classification and management
 */

import type { CategoryConfig, CategoryType, FolderConfig } from "../types";
import {
  VIDEO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  ALL_SEQUENCE_EXTENSIONS,
} from "../constants/extensions";
import { getFileExtension } from "./config";

// ===== Category Assignment =====

/**
 * Get map of categories to their assigned folders
 * Categories without filters can only be assigned to one folder
 * Categories with filters can be duplicated across folders
 *
 * @returns Map<CategoryType, folderId>
 */
export const getAssignedCategories = (
  folders: FolderConfig[]
): Map<CategoryType, string> => {
  const assigned = new Map<CategoryType, string>();

  folders.forEach((folder) => {
    folder.categories?.forEach((cat) => {
      // Skip categories with filters - they can be duplicated across folders
      const hasFilters =
        (cat.filters && cat.filters.length > 0) ||
        (cat.keywords && cat.keywords.length > 0);

      if (cat.enabled && !hasFilters) {
        assigned.set(cat.type, folder.id);
      }
    });
  });

  return assigned;
};

// ===== Duplicate Detection =====

/**
 * Find duplicate keywords across categories in same folder
 * Used to warn users about conflicting keyword assignments
 *
 * @returns Map<CategoryType, duplicateKeywords[]>
 */
export const findDuplicateKeywords = (
  categories: CategoryConfig[] | undefined
): Map<CategoryType, string[]> => {
  const duplicates = new Map<CategoryType, string[]>();
  if (!categories) return duplicates;

  const keywordMap = new Map<string, CategoryType[]>();

  // Collect all keywords by category
  categories.forEach((cat) => {
    cat.keywords?.forEach((kw) => {
      const lower = kw.toLowerCase();
      const existing = keywordMap.get(lower) || [];
      existing.push(cat.type);
      keywordMap.set(lower, existing);
    });
  });

  // Find duplicates (keywords used in multiple categories)
  keywordMap.forEach((types, kw) => {
    if (types.length > 1) {
      types.forEach((type) => {
        const dups = duplicates.get(type) || [];
        if (!dups.includes(kw)) dups.push(kw);
        duplicates.set(type, dups);
      });
    }
  });

  return duplicates;
};

// ===== Category Classification =====

/**
 * Determine category type based on file extension
 * Pure function - no ExtendScript dependencies
 *
 * @param extension - File extension (without dot)
 * @param options.isSequence - True if item is an image sequence
 * @returns CategoryType or null if not categorizable
 */
export const determineCategory = (
  extension: string,
  options?: { isSequence?: boolean }
): CategoryType | null => {
  const ext = extension.toLowerCase();

  // Sequences are always Footage
  if (options?.isSequence) {
    return "Footage";
  }

  // Video files -> Footage
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Footage";
  }

  // Audio files -> Audio
  if ((AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Audio";
  }

  // Image files -> Images (single images, not sequences)
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Images";
  }

  // CG/VFX formats without sequence flag -> Images
  // (with sequence flag they would be Footage, handled above)
  if ((ALL_SEQUENCE_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Images";
  }

  return null;
};

/**
 * Determine category from filename
 * Convenience wrapper around determineCategory
 */
export const determineCategoryFromFilename = (
  filename: string,
  options?: { isSequence?: boolean }
): CategoryType | null => {
  const extension = getFileExtension(filename);
  return determineCategory(extension, options);
};

// ===== Category Order Management =====

/**
 * Sort categories by order
 */
export const sortCategories = (categories: CategoryConfig[]): CategoryConfig[] => {
  return [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

/**
 * Recalculate category orders after reordering
 */
export const recalculateCategoryOrders = (
  categories: CategoryConfig[]
): CategoryConfig[] => {
  return categories.map((cat, index) => ({
    ...cat,
    order: index,
  }));
};

// ===== Category Validation =====

/**
 * Check if a category type is valid
 */
export const isValidCategoryType = (type: string): type is CategoryType => {
  return ["Comps", "Footage", "Images", "Audio", "Solids"].includes(type);
};
