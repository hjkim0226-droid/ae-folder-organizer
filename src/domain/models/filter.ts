/**
 * Snap Organizer - Filter Models
 * Pure functions for filter matching and exception handling
 */

import type {
  SubcategoryConfig,
  SubcategoryFilter,
  ExceptionRule,
} from "../types";
import { getFileExtension, trimStr } from "./config";

// ===== Filter Matching =====

/**
 * Check if a filename matches a single filter
 */
export const matchesFilter = (
  filename: string,
  filter: SubcategoryFilter
): boolean => {
  const name = filename.toLowerCase();
  const value = filter.value.toLowerCase();

  switch (filter.type) {
    case "ext":
      // Extension filter: check file extension
      const ext = getFileExtension(filename);
      return ext === value || ext === value.replace(/^\./, "");

    case "prefix":
      // Prefix filter: check if name starts with value
      return name.startsWith(value);

    case "keyword":
      // Keyword filter: check if name contains value
      return name.includes(value);

    default:
      return false;
  }
};

/**
 * Check if a filename matches any filter in a list
 */
export const matchesAnyFilter = (
  filename: string,
  filters: SubcategoryFilter[]
): boolean => {
  return filters.some((filter) => matchesFilter(filename, filter));
};

// ===== Subcategory Matching =====

/**
 * Get filters from subcategory config
 * Handles both legacy and new filter systems
 */
export const getSubcategoryFilters = (
  subcat: SubcategoryConfig
): SubcategoryFilter[] => {
  // New unified filter system
  if (subcat.filters && subcat.filters.length > 0) {
    return subcat.filters;
  }

  // Legacy: convert extensions to ext filters
  const filters: SubcategoryFilter[] = [];

  if (subcat.extensions && subcat.extensions.length > 0) {
    subcat.extensions.forEach((ext) => {
      filters.push({ type: "ext", value: ext.toLowerCase() });
    });
  }

  // Legacy: convert keywords to keyword filters
  if (subcat.keywords && subcat.keywords.length > 0) {
    subcat.keywords.forEach((kw) => {
      filters.push({ type: "keyword", value: kw.toLowerCase() });
    });
  }

  return filters;
};

/**
 * Check if a filename matches a subcategory's filters
 * Returns true if the item should be placed in this subcategory
 */
export const matchesSubcategory = (
  filename: string,
  subcat: SubcategoryConfig
): boolean => {
  const filters = getSubcategoryFilters(subcat);

  // If no filters defined, don't match (requires explicit filters)
  if (filters.length === 0) {
    return false;
  }

  // Check if any filter matches
  return matchesAnyFilter(filename, filters);
};

/**
 * Find matching subcategory for a filename
 * Returns the first matching subcategory or null
 */
export const findMatchingSubcategory = (
  filename: string,
  subcategories: SubcategoryConfig[]
): SubcategoryConfig | null => {
  // Sort by order first
  const sorted = [...subcategories].sort((a, b) => a.order - b.order);

  for (const subcat of sorted) {
    if (matchesSubcategory(filename, subcat)) {
      return subcat;
    }
  }

  return null;
};

// ===== Exception Rule Matching =====

/**
 * Check if a filename matches an exception rule
 */
export const matchesExceptionRule = (
  filename: string,
  rule: ExceptionRule
): boolean => {
  const name = filename.toLowerCase();
  const pattern = rule.pattern.toLowerCase();

  switch (rule.type) {
    case "nameContains":
      // Name contains pattern
      return name.includes(pattern);

    case "extension":
      // File extension matches pattern
      const ext = getFileExtension(filename);
      return ext === pattern || ext === pattern.replace(/^\./, "");

    default:
      return false;
  }
};

/**
 * Find first matching exception rule for a filename
 */
export const findMatchingException = (
  filename: string,
  exceptions: ExceptionRule[]
): ExceptionRule | null => {
  for (const rule of exceptions) {
    if (matchesExceptionRule(filename, rule)) {
      return rule;
    }
  }
  return null;
};

// ===== Render Comp Detection =====

/**
 * Check if a comp name matches render keywords
 */
export const isRenderComp = (
  compName: string,
  renderKeywords: string[]
): boolean => {
  if (!renderKeywords || renderKeywords.length === 0) {
    return false;
  }

  const nameLower = compName.toLowerCase();

  for (const keyword of renderKeywords) {
    const kw = trimStr(keyword).toLowerCase();
    if (kw && nameLower.includes(kw)) {
      return true;
    }
  }

  return false;
};

// ===== "Others" Folder Generation =====

/**
 * Generate folder name for items that don't match any subcategory
 * Format: "_Others" or "_기타"
 */
export const generateOthersFolderName = (): string => {
  return "_Others";
};

// ===== Filter Validation =====

/**
 * Check if a filter value is valid (non-empty after trim)
 */
export const isValidFilterValue = (value: string): boolean => {
  return trimStr(value).length > 0;
};

/**
 * Normalize filter value (trim whitespace, lowercase for comparison)
 */
export const normalizeFilterValue = (value: string): string => {
  return trimStr(value).toLowerCase();
};

/**
 * Parse filter input string into filters array
 * Supports comma-separated values
 * @example ".mp4, .mov, .avi" -> [{ type: "ext", value: "mp4" }, ...]
 */
export const parseFilterInput = (
  input: string,
  filterType: SubcategoryFilter["type"]
): SubcategoryFilter[] => {
  const values = input.split(",").map((v) => trimStr(v)).filter(Boolean);

  return values.map((value) => ({
    type: filterType,
    value: filterType === "ext" ? value.replace(/^\./, "") : value,
  }));
};
