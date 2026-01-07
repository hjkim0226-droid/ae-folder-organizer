/**
 * SubcategoryItem Component
 * Renders a subcategory with filters and label color options
 */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useHostApp } from "../../contexts";
import type { SubcategoryConfig, SubcategoryFilter } from "../../../domain/types";

// ===== Props Interface =====

export interface SubcategoryItemProps {
  subcat: SubcategoryConfig;
  onUpdate: (updates: Partial<SubcategoryConfig>) => void;
  onDelete: () => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  needsFilter: boolean;
  canBeAllItems: boolean;
}

// ===== Component =====

export function SubcategoryItem({
  subcat,
  onUpdate,
  onDelete,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  needsFilter,
  canBeAllItems,
}: SubcategoryItemProps) {
  const { getLabelColorCSS } = useHostApp();
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Get filters from subcategory
   * Migrates legacy extensions/keywords to unified filter format
   */
  const getFilters = (): SubcategoryFilter[] => {
    if (subcat.filters && subcat.filters.length > 0) {
      return subcat.filters;
    }
    // Migrate legacy data
    const migrated: SubcategoryFilter[] = [];
    if (subcat.extensions) {
      subcat.extensions.forEach((ext) =>
        migrated.push({ type: "ext", value: ext })
      );
    }
    if (subcat.keywords) {
      subcat.keywords.forEach((kw) => {
        if (kw.startsWith("prefix:")) {
          migrated.push({ type: "prefix", value: kw.substring(7) });
        } else {
          migrated.push({ type: "keyword", value: kw });
        }
      });
    }
    return migrated;
  };

  const filters = getFilters();
  const hasFilters = filters.length > 0;

  /**
   * Add a new filter from input string
   * Detects filter type from prefix:
   *   - ".mp4" -> ext filter
   *   - "prefix:VFX_" -> prefix filter
   *   - "keyword" -> keyword filter
   */
  const addFilter = (input: string) => {
    const newFilter: SubcategoryFilter = input.startsWith(".")
      ? { type: "ext", value: input.substring(1) }
      : input.startsWith("prefix:")
        ? { type: "prefix", value: input.substring(7) }
        : { type: "keyword", value: input };
    const newFilters = [...filters, newFilter];
    onUpdate({ filters: newFilters });
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onUpdate({ filters: newFilters });
  };

  const getTagClass = (filter: SubcategoryFilter) => {
    if (filter.type === "ext") return "subcat-tag ext-tag";
    if (filter.type === "prefix") return "subcat-tag prefix-tag";
    return "subcat-tag";
  };

  const getTagLabel = (filter: SubcategoryFilter) => {
    if (filter.type === "ext") return `.${filter.value}`;
    if (filter.type === "prefix") return `prefix:${filter.value}`;
    return filter.value;
  };

  // Label color CSS style
  const labelColorStyle = subcat.enableLabelColor
    ? { color: getLabelColorCSS(subcat.labelColor) }
    : undefined;

  return (
    <div className="subcategory-item-wrapper">
      <div
        className={`subcategory-item ${isDragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.stopPropagation();
          onDragOver(e);
        }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDrop();
        }}
      >
        {/* Left area: Draggable */}
        <div
          className="subcat-left"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("text/subcategory", subcat.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="subcat-expand" style={labelColorStyle}>
            {isExpanded ? "▼" : "▶"}
          </span>
          <input
            type="text"
            className="subcat-name"
            value={subcat.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            style={labelColorStyle}
          />
          {hasFilters && (
            <span className="subcat-tag-count"><Icon icon="ph:tag-fill" width={12} color="#81c784" />{filters.length}</span>
          )}
        </div>

        {/* Right area: Sub checkbox + Delete */}
        <div className="subcat-right">
          <label
            className="subcat-sub-option"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={subcat.createSubfolders || false}
              onChange={(e) => onUpdate({ createSubfolders: e.target.checked })}
            />
            <span>Sub</span>
          </label>
          <button className="subcat-delete" onClick={onDelete}>
            ✕
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="subcat-tags-section">
          <div className="subcat-tags">
            {filters.map((filter, idx) => (
              <span
                key={idx}
                className={getTagClass(filter)}
                onClick={() => removeFilter(idx)}
              >
                {getTagLabel(filter)} ×
              </span>
            ))}
            {!hasFilters && needsFilter && (
              <span className="subcat-tag warning-tag"><Icon icon="ph:warning-fill" width={12} color="#ff9800" style={{ marginRight: 2 }} /> Filter Required</span>
            )}
            {!hasFilters && !needsFilter && canBeAllItems && (
              <span className="subcat-tag all-tag"><Icon icon="ph:folder-fill" width={12} color="#4fc3f7" style={{ marginRight: 2 }} /> All Items (no filter)</span>
            )}
            {!hasFilters && !needsFilter && !canBeAllItems && (
              <span className="subcat-tag warning-tag"><Icon icon="ph:warning-fill" width={12} color="#ff9800" style={{ marginRight: 2 }} /> Cannot be All Items</span>
            )}
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
          {/* Label Color Section */}
          <div className="subcat-label-color">
            <label className="label-color-option">
              <input
                type="checkbox"
                checked={subcat.enableLabelColor || false}
                onChange={(e) =>
                  onUpdate({
                    enableLabelColor: e.target.checked,
                    labelColor: subcat.labelColor,
                  })
                }
              />
              <span><Icon icon="ph:palette-fill" width={14} style={{ marginRight: 4 }} /> Label Color</span>
            </label>
            {subcat.enableLabelColor && (
              <div className="label-color-picker">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                  (colorIdx) => (
                    <button
                      key={colorIdx}
                      className={`color-swatch color-${colorIdx} ${
                        subcat.labelColor === colorIdx ? "selected" : ""
                      }`}
                      onClick={() =>
                        onUpdate({ enableLabelColor: true, labelColor: colorIdx })
                      }
                      title={`Color ${colorIdx}`}
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
