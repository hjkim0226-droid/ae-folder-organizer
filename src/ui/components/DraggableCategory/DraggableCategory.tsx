/**
 * DraggableCategory Component
 * Renders a category with filters, subcategories, and label color options
 */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useHostApp } from "../../contexts";
import { SubcategoryItem } from "../SubcategoryItem";
import { generateId } from "../../../domain";
import type {
  CategoryConfig,
  CategoryType,
  SubcategoryConfig,
  SubcategoryFilter,
} from "../../../domain/types";

// ===== Props Interface =====

export interface DraggableCategoryProps {
  category: CategoryConfig;
  duplicateKeywords?: string[];
  onDelete: () => void;
  onToggleSubfolders: () => void;
  onUpdateFilters: (filters: SubcategoryFilter[]) => void;
  onUpdateSubcategories: (subcategories: SubcategoryConfig[]) => void;
  onUpdateLabelColor: (enable: boolean, color?: number) => void;
  isDragOver: boolean;
  dragHandlers: {
    onDragStart: (e: React.DragEvent, type: CategoryType) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, type: CategoryType) => void;
    onDragEnd: () => void;
  };
}

// ===== Component =====

export function DraggableCategory({
  category,
  duplicateKeywords,
  onDelete,
  onToggleSubfolders,
  onUpdateFilters,
  onUpdateSubcategories,
  onUpdateLabelColor,
  isDragOver,
  dragHandlers,
}: DraggableCategoryProps) {
  const { getLabelColorCSS } = useHostApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedSubcat, setDraggedSubcat] = useState<string | null>(null);
  const [dragOverSubcat, setDragOverSubcat] = useState<string | null>(null);

  /**
   * Get filters from category
   * Migrates legacy keywords to unified filter format
   */
  const getFilters = (): SubcategoryFilter[] => {
    if (category.filters && category.filters.length > 0) {
      return category.filters;
    }
    // Migrate legacy keywords
    const migrated: SubcategoryFilter[] = [];
    if (category.keywords) {
      category.keywords.forEach((kw) => {
        if (kw.startsWith("prefix:")) {
          migrated.push({ type: "prefix", value: kw.substring(7) });
        } else if (kw.startsWith(".")) {
          migrated.push({ type: "ext", value: kw.substring(1) });
        } else {
          migrated.push({ type: "keyword", value: kw });
        }
      });
    }
    return migrated;
  };

  const filters = getFilters();
  const hasFilters = filters.length > 0;
  const hasSubcategories =
    category.subcategories && category.subcategories.length > 0;

  /**
   * Add a new filter from input string
   */
  const addFilter = (input: string) => {
    const newFilter: SubcategoryFilter = input.startsWith(".")
      ? { type: "ext", value: input.substring(1) }
      : input.startsWith("prefix:")
        ? { type: "prefix", value: input.substring(7) }
        : { type: "keyword", value: input };
    onUpdateFilters([...filters, newFilter]);
  };

  const removeFilter = (index: number) => {
    onUpdateFilters(filters.filter((_, i) => i !== index));
  };

  const getTagClass = (filter: SubcategoryFilter) => {
    if (filter.type === "ext") return "keyword-tag ext-tag";
    if (filter.type === "prefix") return "keyword-tag prefix-tag";
    return "keyword-tag";
  };

  const getTagLabel = (filter: SubcategoryFilter) => {
    if (filter.type === "ext") return `.${filter.value}`;
    if (filter.type === "prefix") return `prefix:${filter.value}`;
    return filter.value;
  };

  // ===== Subcategory Management =====

  const addSubcategory = () => {
    const subcats = category.subcategories || [];
    const maxOrder = Math.max(0, ...subcats.map((s) => s.order));
    const newSubcat: SubcategoryConfig = {
      id: generateId(),
      name: "NewSub",
      order: maxOrder + 1,
      filterType: "all",
    };
    onUpdateSubcategories([...subcats, newSubcat]);
  };

  const updateSubcategory = (id: string, updates: Partial<SubcategoryConfig>) => {
    const subcats = category.subcategories || [];
    onUpdateSubcategories(
      subcats.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSubcategory = (id: string) => {
    const subcats = category.subcategories || [];
    onUpdateSubcategories(subcats.filter((s) => s.id !== id));
  };

  const reorderSubcategory = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const subcats = category.subcategories || [];
    const draggedIdx = subcats.findIndex((s) => s.id === draggedId);
    const targetIdx = subcats.findIndex((s) => s.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newSubcats = [...subcats];
    const [removed] = newSubcats.splice(draggedIdx, 1);
    newSubcats.splice(targetIdx, 0, removed);
    newSubcats.forEach((s, i) => {
      s.order = i;
    });
    onUpdateSubcategories(newSubcats);
  };

  // ===== Helper for subcategory filter requirements =====

  const getSubcatHasFilters = (sc: SubcategoryConfig) => {
    if (sc.filters && sc.filters.length > 0) return true;
    if (sc.extensions && sc.extensions.length > 0) return true;
    if (sc.keywords && sc.keywords.length > 0) return true;
    return false;
  };

  // Label color CSS style
  const labelColorStyle = category.enableLabelColor
    ? { color: getLabelColorCSS(category.labelColor) }
    : undefined;

  return (
    <div className={`category-item-wrapper ${isDragOver ? "drag-over" : ""}`}>
      <div
        className="category-item"
        onDragOver={(e) => {
          e.stopPropagation();
          e.preventDefault();
          dragHandlers.onDragOver(e);
        }}
        onDragLeave={dragHandlers.onDragLeave}
        onDrop={(e) => {
          e.stopPropagation();
          dragHandlers.onDrop(e, category.type);
        }}
      >
        {/* Left area: Draggable */}
        <div
          className="category-left"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            dragHandlers.onDragStart(e, category.type);
          }}
          onDragEnd={dragHandlers.onDragEnd}
          onClick={() => {
            // Only Comps, Footage, Images, Audio can expand (not Solids)
            if (category.type !== "Solids") {
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {/* Show expand icon except for Solids */}
          {category.type !== "Solids" && (
            <span className="category-expand" style={labelColorStyle}>
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          <span className="category-name" style={labelColorStyle}>
            {category.type}
          </span>
          {hasFilters && <span className="keyword-badge"><Icon icon="ph:key-fill" width={12} color="#ffc107" /></span>}
          {hasSubcategories && (
            <span className="subcategory-badge">
              <Icon icon="ph:folder-open-fill" width={12} color="#4fc3f7" />{category.subcategories?.length}
            </span>
          )}
          {duplicateKeywords && duplicateKeywords.length > 0 && (
            <span
              className="duplicate-warning"
              title={`Duplicate: ${duplicateKeywords.join(", ")}`}
            >
              <Icon icon="ph:warning-fill" width={12} color="#ff9800" />
            </span>
          )}
        </div>

        {/* Right area: Sub checkbox + Delete */}
        <div className="category-right">
          {/* Show Sub checkbox for Footage, Images, Audio (not Comps, Solids) */}
          {category.type !== "Comps" && category.type !== "Solids" && (
            <label className="subfolder-option">
              <input
                type="checkbox"
                checked={category.createSubfolders}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSubfolders();
                }}
              />
              <span>Sub</span>
            </label>
          )}
          <button
            className="category-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded area (not for Solids, Comps shows only subcategories) */}
      {isExpanded && category.type !== "Solids" && (
        <div className="category-expanded">
          {/* Filters Section - except Comps */}
          {category.type !== "Comps" && (
            <div className="category-keywords">
              <div className="keyword-tags">
                {category.needsKeyword && !hasFilters && (
                  <span className="keyword-tag required-tag">
                    <Icon icon="fluent:warning-24-filled" width={12} color="#ff9800" style={{ marginRight: 2 }} /> Filter Required
                  </span>
                )}
                {!category.needsKeyword && !hasFilters && (
                  <span className="keyword-tag all-tag">
                    All {category.type}
                  </span>
                )}
                {filters.map((filter, idx) => (
                  <span
                    key={idx}
                    className={getTagClass(filter)}
                    onClick={() => removeFilter(idx)}
                  >
                    {getTagLabel(filter)} ×
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder=".mp4 / prefix:VFX_ / keyword"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const input = e.currentTarget;
                    const value = input.value.trim();
                    if (value) {
                      addFilter(value);
                      input.value = "";
                    }
                  }
                }}
              />
            </div>
          )}

          {/* Label Color Section */}
          <div className="label-color-section">
            <label className="label-color-option">
              <input
                type="checkbox"
                checked={category.enableLabelColor || false}
                onChange={(e) =>
                  onUpdateLabelColor(e.target.checked, category.labelColor)
                }
              />
              <span><Icon icon="ph:palette-fill" width={14} style={{ marginRight: 4 }} /> Apply Label Color</span>
            </label>
            {category.enableLabelColor && (
              <div className="label-color-picker">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                  (colorIdx) => (
                    <button
                      key={colorIdx}
                      className={`color-swatch color-${colorIdx} ${
                        category.labelColor === colorIdx ? "selected" : ""
                      }`}
                      onClick={() => onUpdateLabelColor(true, colorIdx)}
                      title={`Color ${colorIdx}`}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* Subcategories Section */}
          <div className="subcategories-section">
            <div className="subcategories-header">
              <span><Icon icon="ph:folder-open-fill" width={14} color="#4fc3f7" style={{ marginRight: 4 }} /> Subcategories</span>
              <button className="btn-add-subcategory" onClick={addSubcategory}>
                + Add
              </button>
            </div>
            {hasSubcategories ? (
              <div className="subcategories-list">
                {category.subcategories
                  ?.sort((a, b) => a.order - b.order)
                  .map((subcat, index, sortedSubcats) => {
                    // Check if any previous subcategory has filters
                    const previousHasFilters = sortedSubcats
                      .slice(0, index)
                      .some(getSubcatHasFilters);
                    // Check if any previous subcategory is "All Items" (no filters)
                    const previousHasAllItems = sortedSubcats
                      .slice(0, index)
                      .some((sc) => !getSubcatHasFilters(sc));

                    // If previous has filters, this one needs filters too
                    const needsFilter = index > 0 && previousHasFilters;
                    // Can only be "All Items" if first or no previous is "All Items"
                    const canBeAllItems = index === 0 || !previousHasAllItems;

                    return (
                      <SubcategoryItem
                        key={subcat.id}
                        subcat={subcat}
                        onUpdate={(updates) =>
                          updateSubcategory(subcat.id, updates)
                        }
                        onDelete={() => deleteSubcategory(subcat.id)}
                        isDragOver={dragOverSubcat === subcat.id}
                        onDragStart={() => setDraggedSubcat(subcat.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSubcat(subcat.id);
                        }}
                        onDragLeave={() => setDragOverSubcat(null)}
                        onDrop={() => {
                          if (draggedSubcat && draggedSubcat !== subcat.id) {
                            reorderSubcategory(draggedSubcat, subcat.id);
                          }
                          setDraggedSubcat(null);
                          setDragOverSubcat(null);
                        }}
                        onDragEnd={() => {
                          setDraggedSubcat(null);
                          setDragOverSubcat(null);
                        }}
                        needsFilter={needsFilter}
                        canBeAllItems={canBeAllItems}
                      />
                    );
                  })}
              </div>
            ) : (
              <small className="no-subcategories">
                No subcategories.{" "}
                {category.type !== "Comps"
                  ? 'Extension-based subfolders will be used if "Sub" is checked.'
                  : "Add subcategories to organize comps."}
              </small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
