/**
 * FolderItem Component
 * Renders a folder with categories and label color options
 */

import { useState } from "react";
import { evalTS } from "../../../js/lib/utils/bolt";
import { DraggableCategory } from "../DraggableCategory";
import { findDuplicateKeywords, generateId } from "../../../domain";
import { ALL_CATEGORIES } from "../../../domain/constants";
import type {
  CategoryConfig,
  CategoryType,
  FolderConfig,
  SubcategoryConfig,
  SubcategoryFilter,
} from "../../../domain/types";

// ===== Props Interface =====

export interface FolderItemProps {
  folder: FolderConfig;
  onUpdate: (folder: FolderConfig) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  assignedCategories: Map<CategoryType, string>;
  isFirst: boolean;
  isLast: boolean;
  folders: FolderConfig[];
}

// ===== Types =====

type DragOverTarget = CategoryType | "END" | null;

// ===== Component =====

export function FolderItem({
  folder,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  assignedCategories,
  isFirst,
  isLast,
  folders,
}: FolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedCategory, setDraggedCategory] = useState<CategoryType | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<DragOverTarget>(null);

  // ===== Category Management =====

  const deleteCategory = (type: CategoryType) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.filter((c) => c.type !== type),
    });
  };

  const addCategory = (type: CategoryType) => {
    const categories = folder.categories || [];
    const maxOrder = Math.max(0, ...categories.map((c) => c.order));

    // Check if this category exists in other folders with filters (allows duplication)
    const existsWithFilters = folders.some(
      (f) =>
        f.id !== folder.id &&
        f.categories?.some((c) => {
          if (c.type !== type || !c.enabled) return false;
          const hasFilters =
            (c.filters && c.filters.length > 0) ||
            (c.keywords && c.keywords.length > 0);
          return hasFilters;
        })
    );

    onUpdate({
      ...folder,
      categories: [
        ...categories,
        {
          type,
          enabled: true,
          order: maxOrder + 1,
          createSubfolders: false,
          detectSequences: type === "Footage" || type === "Images",
          needsKeyword: existsWithFilters,
        },
      ],
    });
  };

  const isCategoryDisabled = (type: CategoryType) => {
    const assignedTo = assignedCategories.get(type);
    return assignedTo !== undefined && assignedTo !== folder.id;
  };

  const toggleSubfolders = (type: CategoryType) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.map((c) =>
        c.type === type ? { ...c, createSubfolders: !c.createSubfolders } : c
      ),
    });
  };

  const updateFilters = (type: CategoryType, filters: SubcategoryFilter[]) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.map((c) =>
        c.type === type ? { ...c, filters, keywords: undefined } : c
      ),
    });
  };

  const updateSubcategories = (
    type: CategoryType,
    subcategories: SubcategoryConfig[]
  ) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.map((c) =>
        c.type === type ? { ...c, subcategories } : c
      ),
    });
  };

  const updateCategoryLabelColor = (
    type: CategoryType,
    enableLabelColor: boolean,
    labelColor?: number
  ) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.map((c) =>
        c.type === type ? { ...c, enableLabelColor, labelColor } : c
      ),
    });
  };

  // ===== Category Drag & Drop =====

  const categoryDragHandlers = {
    onDragStart: (e: React.DragEvent, type: CategoryType) => {
      setDraggedCategory(type);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/category", type);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
    },
    onDragLeave: () => {
      setDragOverCategory(null);
    },
    onDrop: (e: React.DragEvent, targetType: CategoryType) => {
      e.preventDefault();
      setDragOverCategory(null);
      if (!draggedCategory || draggedCategory === targetType) return;

      const categories = folder.categories || [];
      const draggedIdx = categories.findIndex((c) => c.type === draggedCategory);
      const targetIdx = categories.findIndex((c) => c.type === targetType);

      if (draggedIdx === -1 || targetIdx === -1) return;

      const newCategories = [...categories];
      const [removed] = newCategories.splice(draggedIdx, 1);
      newCategories.splice(targetIdx, 0, removed);

      newCategories.forEach((c, i) => {
        c.order = i;
      });

      onUpdate({ ...folder, categories: newCategories });
      setDraggedCategory(null);
    },
    onDragEnd: () => {
      setDraggedCategory(null);
      setDragOverCategory(null);
    },
  };

  const sortedCategories = [...(folder.categories || [])].sort(
    (a, b) => a.order - b.order
  );
  const isSystemFolder = folder.id === "system";

  return (
    <div className="folder-item">
      <div className="folder-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="folder-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="folder-emoji">📁</span>
        <input
          type="text"
          className="folder-name-input"
          value={folder.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ ...folder, name: e.target.value })}
          placeholder="Folder name"
        />
        <div className="folder-actions">
          {!folder.isRenderFolder && !isSystemFolder && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                disabled={isFirst}
              >
                ↑
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                disabled={isLast}
              >
                ↓
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="delete"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="folder-content">
          {folder.isRenderFolder ? (
            <RenderFolderSettings folder={folder} onUpdate={onUpdate} />
          ) : (
            <div className="category-list">
              {sortedCategories.length > 0 ? (
                <>
                  {sortedCategories.map((cat) => {
                    const duplicates = findDuplicateKeywords(folder.categories);
                    const catDuplicates = duplicates.get(cat.type);
                    return (
                      <DraggableCategory
                        key={cat.type}
                        category={cat}
                        duplicateKeywords={catDuplicates}
                        onDelete={() => deleteCategory(cat.type)}
                        onToggleSubfolders={() => toggleSubfolders(cat.type)}
                        onUpdateFilters={(filters) =>
                          updateFilters(cat.type, filters)
                        }
                        onUpdateSubcategories={(subcats) =>
                          updateSubcategories(cat.type, subcats)
                        }
                        onUpdateLabelColor={(enable, color) =>
                          updateCategoryLabelColor(cat.type, enable, color)
                        }
                        isDragOver={dragOverCategory === cat.type}
                        dragHandlers={{
                          ...categoryDragHandlers,
                          onDragOver: (e) => {
                            categoryDragHandlers.onDragOver(e);
                            setDragOverCategory(cat.type);
                          },
                        }}
                      />
                    );
                  })}
                  {draggedCategory && (
                    <div
                      className={`drop-zone-end ${
                        dragOverCategory === "END" ? "active" : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCategory("END");
                      }}
                      onDragLeave={() => setDragOverCategory(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCategory(null);
                        if (!draggedCategory) return;
                        const categories = folder.categories || [];
                        const draggedIdx = categories.findIndex(
                          (c) => c.type === draggedCategory
                        );
                        if (draggedIdx === -1) return;
                        const newCategories = [...categories];
                        const [removed] = newCategories.splice(draggedIdx, 1);
                        newCategories.push(removed);
                        newCategories.forEach((c, i) => {
                          c.order = i;
                        });
                        onUpdate({ ...folder, categories: newCategories });
                        setDraggedCategory(null);
                      }}
                    ></div>
                  )}
                </>
              ) : (
                <div className="no-categories">No categories assigned</div>
              )}

              {!isSystemFolder && (
                <div className="add-category">
                  {ALL_CATEGORIES.filter(
                    (type) =>
                      !folder.categories?.some((c) => c.type === type) &&
                      !isCategoryDisabled(type)
                  ).map((type) => (
                    <button
                      key={type}
                      className="btn-add-category"
                      onClick={() => addCategory(type)}
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Label Color Option - All folders */}
          <div className="label-color-section">
            <label className="label-color-option">
              <input
                type="checkbox"
                checked={folder.enableLabelColor || false}
                onChange={(e) =>
                  onUpdate({ ...folder, enableLabelColor: e.target.checked })
                }
              />
              <span>🎨 Apply Label Color</span>
            </label>
            {folder.enableLabelColor && (
              <div className="color-picker">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                  (colorIdx) => (
                    <button
                      key={colorIdx}
                      className={`color-swatch color-${colorIdx} ${
                        folder.labelColor === colorIdx ? "selected" : ""
                      }`}
                      onClick={() =>
                        onUpdate({ ...folder, labelColor: colorIdx })
                      }
                      title={`Label ${colorIdx}`}
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

// ===== Render Folder Settings Sub-component =====

interface RenderFolderSettingsProps {
  folder: FolderConfig;
  onUpdate: (folder: FolderConfig) => void;
}

function RenderFolderSettings({ folder, onUpdate }: RenderFolderSettingsProps) {
  const handleGetSelectedComps = async () => {
    try {
      const names = await evalTS("getSelectedCompNames");
      if (names && names.length > 0) {
        const newKeywords = [...(folder.renderKeywords || [])];
        for (const name of names) {
          if (!newKeywords.includes(name)) {
            newKeywords.push(name);
          }
        }
        onUpdate({ ...folder, renderKeywords: newKeywords });
      }
    } catch (e) {
      console.error("Failed to get selected comps:", e);
    }
  };

  const removeKeyword = (idx: number) => {
    const newKeywords = folder.renderKeywords?.filter((_, i) => i !== idx) || [];
    onUpdate({ ...folder, renderKeywords: newKeywords });
  };

  const addKeyword = (value: string) => {
    const newKeywords = [...(folder.renderKeywords || []), value];
    onUpdate({ ...folder, renderKeywords: newKeywords });
  };

  return (
    <div className="render-folder-settings">
      <div className="render-keywords">
        <div className="render-keywords-header">
          <label>🔑 Keywords (auto-detect)</label>
          <button className="btn-get-comps" onClick={handleGetSelectedComps}>
            + Selected Comps
          </button>
        </div>
        <div className="render-keyword-tags">
          {folder.renderKeywords?.map((kw, idx) => (
            <span
              key={idx}
              className="keyword-tag"
              onClick={() => removeKeyword(idx)}
            >
              {kw} ×
            </span>
          ))}
          {(!folder.renderKeywords || folder.renderKeywords.length === 0) && (
            <span className="keyword-tag warning-tag">⚠ No keywords</span>
          )}
        </div>
        <input
          type="text"
          placeholder="Add keyword (Enter to add)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const input = e.currentTarget;
              const value = input.value.trim();
              if (value) {
                addKeyword(value);
                input.value = "";
              }
            }
          }}
        />
      </div>
      <label className="skip-org-option">
        <input
          type="checkbox"
          checked={folder.skipOrganization !== false}
          onChange={(e) =>
            onUpdate({ ...folder, skipOrganization: e.target.checked })
          }
        />
        <span>Skip organization for items in this folder</span>
      </label>
    </div>
  );
}
