import { useEffect, useState } from "react";
import { subscribeBackgroundColor, evalTS } from "../lib/utils/bolt";
import "./main.scss";

// ===== Types =====

interface FolderConfig {
  id: string;
  name: string;
  order: number;
  isRenderFolder: boolean;
  renderKeywords?: string[];
  skipOrganization?: boolean;
  categories?: CategoryConfig[];
  enableLabelColor?: boolean;  // 라벨 컬러 활성화
  labelColor?: number;  // AE 라벨 컬러 인덱스 (1-16)
}

interface CategoryConfig {
  type: CategoryType;
  enabled: boolean;
  order: number;
  createSubfolders: boolean;
  detectSequences?: boolean;
  keywords?: string[];  // Legacy - kept for backward compat
  filters?: SubcategoryFilter[];  // New unified filter system
  needsKeyword?: boolean;  // True when this is a duplicate category requiring keywords
  subcategories?: SubcategoryConfig[];  // Subcategory layers
}

interface SubcategoryFilter {
  type: "ext" | "prefix" | "keyword";
  value: string;
}

interface SubcategoryConfig {
  id: string;
  name: string;
  order: number;
  filterType: "extension" | "keyword" | "all";  // Legacy, kept for backward compat
  extensions?: string[];  // Legacy
  keywords?: string[];  // Legacy
  filters?: SubcategoryFilter[];  // New unified filter system
  keywordRequired?: boolean;
  createSubfolders?: boolean;
}

type CategoryType = "Comps" | "Footage" | "Images" | "Audio" | "Solids";

interface ExceptionRule {
  id: string;
  type: "nameContains" | "extension";
  pattern: string;
  targetFolderId: string;
}

interface OrganizerConfig {
  folders: FolderConfig[];
  exceptions: ExceptionRule[];
  renderCompIds: number[];
  settings: {
    deleteEmptyFolders: boolean;
    showStats: boolean;  // 소스 오버뷰 표시
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

// ===== Config Version =====
const CONFIG_VERSION = 5;

interface VersionedConfig extends OrganizerConfig {
  version?: number;
}

// ===== Default Config =====
const DEFAULT_CONFIG: VersionedConfig = {
  version: CONFIG_VERSION,
  folders: [
    {
      id: "render",
      name: "Render",
      order: 0,
      isRenderFolder: true,
      renderKeywords: ["Render"],
      skipOrganization: true,
      categories: [],
    },
    {
      id: "source",
      name: "Source",
      order: 1,
      isRenderFolder: false,
      categories: [
        { type: "Comps", enabled: true, order: 0, createSubfolders: false },
        { type: "Footage", enabled: true, order: 1, createSubfolders: false, detectSequences: true },
        { type: "Images", enabled: true, order: 2, createSubfolders: false, detectSequences: true },
        { type: "Audio", enabled: true, order: 3, createSubfolders: false },
      ],
    },
    {
      id: "system",
      name: "System",
      order: 99,
      isRenderFolder: false,
      categories: [
        { type: "Solids", enabled: true, order: 0, createSubfolders: false },
      ],
    },
  ],
  exceptions: [],
  renderCompIds: [],
  settings: {
    deleteEmptyFolders: true,
    showStats: true,  // 기본값: 표시
  },
};

const ALL_CATEGORIES: CategoryType[] = ["Comps", "Footage", "Images", "Audio", "Solids"];

// ===== Helper Functions =====
const generateId = () => Math.random().toString(36).substring(2, 9);

const getAssignedCategories = (folders: FolderConfig[]): Map<CategoryType, string> => {
  const assigned = new Map<CategoryType, string>();
  folders.forEach((folder) => {
    folder.categories?.forEach((cat) => {
      // Skip categories with filters - they can be duplicated across folders
      const hasFilters = (cat.filters && cat.filters.length > 0) ||
        (cat.keywords && cat.keywords.length > 0);
      if (cat.enabled && !hasFilters) {
        assigned.set(cat.type, folder.id);
      }
    });
  });
  return assigned;
};

// Find duplicate keywords across categories in same folder
const findDuplicateKeywords = (categories: CategoryConfig[] | undefined): Map<CategoryType, string[]> => {
  const duplicates = new Map<CategoryType, string[]>();
  if (!categories) return duplicates;

  const keywordMap = new Map<string, CategoryType[]>();

  categories.forEach((cat) => {
    cat.keywords?.forEach((kw) => {
      const lower = kw.toLowerCase();
      const existing = keywordMap.get(lower) || [];
      existing.push(cat.type);
      keywordMap.set(lower, existing);
    });
  });

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

const getDisplayFolderName = (folder: FolderConfig, index: number): string => {
  if (folder.id === "system") {
    return `99_${folder.name}`;
  }
  const prefix = index.toString().padStart(2, "0");
  return `${prefix}_${folder.name}`;
};

// ===== Subcategory Item Component =====
const SubcategoryItem = ({
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
}: {
  subcat: SubcategoryConfig;
  onUpdate: (updates: Partial<SubcategoryConfig>) => void;
  onDelete: () => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  needsFilter: boolean;  // True if this subcategory must have filters
  canBeAllItems: boolean;  // True if this subcategory can be "All Items"
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get filters (migrate legacy data if needed)
  const getFilters = (): SubcategoryFilter[] => {
    if (subcat.filters && subcat.filters.length > 0) {
      return subcat.filters;
    }
    // Migrate legacy data
    const migrated: SubcategoryFilter[] = [];
    if (subcat.extensions) {
      subcat.extensions.forEach((ext) => migrated.push({ type: "ext", value: ext }));
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

  return (
    <div className="subcategory-item-wrapper">
      <div
        className={`subcategory-item ${isDragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.stopPropagation(); onDragOver(e); }}
        onDragLeave={onDragLeave}
        onDrop={(e) => { e.stopPropagation(); e.preventDefault(); onDrop(); }}
      >
        {/* 왼쪽 영역: 드래그 가능 */}
        <div
          className="subcat-left"
          draggable
          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/subcategory", subcat.id); onDragStart(); }}
          onDragEnd={onDragEnd}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="subcat-expand">{isExpanded ? "▼" : "▶"}</span>
          <input
            type="text"
            className="subcat-name"
            value={subcat.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
          {hasFilters && <span className="subcat-tag-count">🏷️{filters.length}</span>}
        </div>

        {/* 오른쪽 영역: Sub 체크박스 + 삭제 */}
        <div className="subcat-right">
          <label className="subcat-sub-option" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={subcat.createSubfolders || false}
              onChange={(e) => onUpdate({ createSubfolders: e.target.checked })}
            />
            <span>Sub</span>
          </label>
          <button className="subcat-delete" onClick={onDelete}>✕</button>
        </div>
      </div>

      {isExpanded && (
        <div className="subcat-tags-section">
          <div className="subcat-tags">
            {filters.map((filter, idx) => (
              <span key={idx} className={getTagClass(filter)} onClick={() => removeFilter(idx)}>
                {getTagLabel(filter)} ×
              </span>
            ))}
            {!hasFilters && needsFilter && (
              <span className="subcat-tag warning-tag">⚠ Filter Required</span>
            )}
            {!hasFilters && !needsFilter && canBeAllItems && (
              <span className="subcat-tag all-tag">📁 All Items (no filter)</span>
            )}
            {!hasFilters && !needsFilter && !canBeAllItems && (
              <span className="subcat-tag warning-tag">⚠ Cannot be All Items</span>
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
        </div>
      )}
    </div>
  );
};

// ===== Draggable Category Component =====
const DraggableCategory = ({
  category,
  duplicateKeywords,
  onDelete,
  onToggleSubfolders,
  onUpdateFilters,
  onUpdateSubcategories,
  isDragOver,
  dragHandlers,
}: {
  category: CategoryConfig;
  duplicateKeywords?: string[];
  onDelete: () => void;
  onToggleSubfolders: () => void;
  onUpdateFilters: (filters: SubcategoryFilter[]) => void;
  onUpdateSubcategories: (subcategories: SubcategoryConfig[]) => void;
  isDragOver: boolean;
  dragHandlers: {
    onDragStart: (e: React.DragEvent, type: CategoryType) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, type: CategoryType) => void;
    onDragEnd: () => void;
  };
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedSubcat, setDraggedSubcat] = useState<string | null>(null);
  const [dragOverSubcat, setDragOverSubcat] = useState<string | null>(null);

  // Get filters (migrate legacy keywords if needed)
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
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;

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
    newSubcats.forEach((s, i) => { s.order = i; });
    onUpdateSubcategories(newSubcats);
  };

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
        {/* 왼쪽 영역: 드래그 가능 */}
        <div
          className="category-left"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            dragHandlers.onDragStart(e, category.type);
          }}
          onDragEnd={dragHandlers.onDragEnd}
          onClick={() => {
            // Solids만 펼침 기능 없음
            if (category.type !== "Solids") {
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {/* Solids 외에만 펼침 아이콘 표시 */}
          {category.type !== "Solids" && (
            <span className="category-expand">{isExpanded ? "▼" : "▶"}</span>
          )}
          <span className="category-name">{category.type}</span>
          {hasFilters && <span className="keyword-badge">🔑</span>}
          {hasSubcategories && <span className="subcategory-badge">📂{category.subcategories?.length}</span>}
          {duplicateKeywords && duplicateKeywords.length > 0 && (
            <span className="duplicate-warning" title={`Duplicate: ${duplicateKeywords.join(", ")}`}>⚠️</span>
          )}
        </div>

        {/* 오른쪽 영역: Sub 체크박스 + 삭제 */}
        <div className="category-right">
          {/* Comps와 Solids 외에만 Sub 체크박스 표시 */}
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

      {/* Solids 외에는 펼침 영역 표시 (Comps는 서브카테고리만) */}
      {isExpanded && category.type !== "Solids" && (
        <div className="category-expanded">
          {/* Filters Section - Comps 제외 */}
          {category.type !== "Comps" && (
            <div className="category-keywords">
              <div className="keyword-tags">
                {category.needsKeyword && !hasFilters && (
                  <span className="keyword-tag required-tag">⚠ Filter Required</span>
                )}
                {!category.needsKeyword && !hasFilters && (
                  <span className="keyword-tag all-tag">All {category.type}</span>
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

          {/* Subcategories Section */}
          <div className="subcategories-section">
            <div className="subcategories-header">
              <span>📂 Subcategories</span>
              <button className="btn-add-subcategory" onClick={addSubcategory}>+ Add</button>
            </div>
            {hasSubcategories ? (
              <div className="subcategories-list">
                {category.subcategories
                  ?.sort((a, b) => a.order - b.order)
                  .map((subcat, index, sortedSubcats) => {
                    // Calculate if this subcategory needs a filter
                    // Rule: If not the first and previous has filters, this one needs filters
                    // Rule: Only the first subcategory can be "All Items"
                    const getSubcatHasFilters = (sc: SubcategoryConfig) => {
                      if (sc.filters && sc.filters.length > 0) return true;
                      if (sc.extensions && sc.extensions.length > 0) return true;
                      if (sc.keywords && sc.keywords.length > 0) return true;
                      return false;
                    };

                    // Check if any previous subcategory has filters
                    const previousHasFilters = sortedSubcats.slice(0, index).some(getSubcatHasFilters);
                    // Check if any previous subcategory is "All Items" (no filters)
                    const previousHasAllItems = sortedSubcats.slice(0, index).some(sc => !getSubcatHasFilters(sc));

                    // If previous has filters, this one needs filters too
                    const needsFilter = index > 0 && previousHasFilters;
                    // Can only be "All Items" if it's the first or if no previous is "All Items"
                    const canBeAllItems = index === 0 || !previousHasAllItems;

                    return (
                      <SubcategoryItem
                        key={subcat.id}
                        subcat={subcat}
                        onUpdate={(updates) => updateSubcategory(subcat.id, updates)}
                        onDelete={() => deleteSubcategory(subcat.id)}
                        isDragOver={dragOverSubcat === subcat.id}
                        onDragStart={() => setDraggedSubcat(subcat.id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverSubcat(subcat.id); }}
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
              <small className="no-subcategories">No subcategories. {category.type !== "Comps" ? 'Extension-based subfolders will be used if "Sub" is checked.' : 'Add subcategories to organize comps.'}</small>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Folder Item Component =====
const FolderItem = ({
  folder,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  assignedCategories,
  isFirst,
  isLast,
  folders,
}: {
  folder: FolderConfig;
  onUpdate: (folder: FolderConfig) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  assignedCategories: Map<CategoryType, string>;
  isFirst: boolean;
  isLast: boolean;
  folders: FolderConfig[];
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedCategory, setDraggedCategory] = useState<CategoryType | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

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
      (f) => f.id !== folder.id && f.categories?.some((c) => {
        if (c.type !== type || !c.enabled) return false;
        const hasFilters = (c.filters && c.filters.length > 0) ||
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
          needsKeyword: existsWithFilters,  // 다른 폴더에 필터가 있는 같은 카테고리가 있으면 필터 필수
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

  const updateSubcategories = (type: CategoryType, subcategories: SubcategoryConfig[]) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.map((c) =>
        c.type === type ? { ...c, subcategories } : c
      ),
    });
  };

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

  const sortedCategories = [...(folder.categories || [])].sort((a, b) => a.order - b.order);
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
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst}>↑</button>
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast}>↓</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="delete">✕</button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="folder-content">
          {folder.isRenderFolder ? (
            <div className="render-folder-settings">
              <div className="render-keywords">
                <div className="render-keywords-header">
                  <label>🔑 Keywords (auto-detect)</label>
                  <button
                    className="btn-get-comps"
                    onClick={async () => {
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
                    }}
                  >
                    + Selected Comps
                  </button>
                </div>
                <div className="render-keyword-tags">
                  {folder.renderKeywords?.map((kw, idx) => (
                    <span
                      key={idx}
                      className="keyword-tag"
                      onClick={() => {
                        const newKeywords = folder.renderKeywords?.filter((_, i) => i !== idx) || [];
                        onUpdate({ ...folder, renderKeywords: newKeywords });
                      }}
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
                        const newKeywords = [...(folder.renderKeywords || []), value];
                        onUpdate({ ...folder, renderKeywords: newKeywords });
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
                  onChange={(e) => onUpdate({ ...folder, skipOrganization: e.target.checked })}
                />
                <span>Skip organization for items in this folder</span>
              </label>
            </div>
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
                        onUpdateFilters={(filters) => updateFilters(cat.type, filters)}
                        onUpdateSubcategories={(subcats) => updateSubcategories(cat.type, subcats)}
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
                      className={`drop-zone-end ${dragOverCategory === "END" ? "active" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCategory("END" as CategoryType);
                      }}
                      onDragLeave={() => setDragOverCategory(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCategory(null);
                        if (!draggedCategory) return;
                        const categories = folder.categories || [];
                        const draggedIdx = categories.findIndex((c) => c.type === draggedCategory);
                        if (draggedIdx === -1) return;
                        const newCategories = [...categories];
                        const [removed] = newCategories.splice(draggedIdx, 1);
                        newCategories.push(removed);
                        newCategories.forEach((c, i) => { c.order = i; });
                        onUpdate({ ...folder, categories: newCategories });
                        setDraggedCategory(null);
                      }}
                    >
                    </div>
                  )}
                </>
              ) : (
                <div className="no-categories">No categories assigned</div>
              )}

              {!isSystemFolder && (
                <div className="add-category">
                  {ALL_CATEGORIES.filter(
                    (type) => !folder.categories?.some((c) => c.type === type) && !isCategoryDisabled(type)
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

          {/* Label Color Option - 모든 폴더에 적용 */}
          <div className="label-color-section">
            <label className="label-color-option">
              <input
                type="checkbox"
                checked={folder.enableLabelColor || false}
                onChange={(e) => onUpdate({ ...folder, enableLabelColor: e.target.checked })}
              />
              <span>🎨 Apply Label Color</span>
            </label>
            {folder.enableLabelColor && (
              <div className="color-picker">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((colorIdx) => (
                  <button
                    key={colorIdx}
                    className={`color-swatch color-${colorIdx} ${folder.labelColor === colorIdx ? "selected" : ""}`}
                    onClick={() => onUpdate({ ...folder, labelColor: colorIdx })}
                    title={`Label ${colorIdx}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Main App =====
export const App = () => {
  const [bgColor, setBgColor] = useState("#282c34");
  const [config, setConfig] = useState<VersionedConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<"ready" | "organizing" | "success" | "error">("ready");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);
  const [showFolders, setShowFolders] = useState(true);  // 기본값: 펼침
  const [showSettings, setShowSettings] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [renameItems, setRenameItems] = useState<{ id: number; name: string; type: string }[]>([]);
  const [renamePrefix, setRenamePrefix] = useState("");
  const [renameSuffix, setRenameSuffix] = useState("");
  const [renameFind, setRenameFind] = useState("");
  const [renameReplace, setRenameReplace] = useState("");

  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
    refreshStats();

    const saved = localStorage.getItem("ae-folder-organizer-config");
    if (saved) {
      try {
        const parsed: VersionedConfig = JSON.parse(saved);
        if (parsed.version === CONFIG_VERSION) {
          setConfig(parsed);
        } else {
          localStorage.removeItem("ae-folder-organizer-config");
        }
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ae-folder-organizer-config", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category") || types.includes("text/subcategory")) return;

      e.preventDefault();
      dragCounter++;
      setIsDraggingExternal(true);
    };

    const onDragLeave = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category") || types.includes("text/subcategory")) return;

      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDraggingExternal(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category") || types.includes("text/subcategory")) return;
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category") || types.includes("text/subcategory")) return;

      e.preventDefault();
      dragCounter = 0;
      setIsDraggingExternal(false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const refreshStats = async () => {
    try {
      const projectStats = await evalTS("getProjectStats");
      setStats(projectStats);
    } catch (e) {
      console.error("Failed to get project stats:", e);
    }
  };

  const buildConfigForExtendScript = (): OrganizerConfig => {
    const sortedFolders = [...config.folders]
      .filter((f) => f.id !== "system")
      .sort((a, b) => a.order - b.order);

    const systemFolder = config.folders.find((f) => f.id === "system");

    const numberedFolders = sortedFolders.map((folder, index) => ({
      ...folder,
      name: getDisplayFolderName(folder, index),
    }));

    if (systemFolder) {
      numberedFolders.push({
        ...systemFolder,
        name: `99_${systemFolder.name}`,
      });
    }

    return {
      folders: numberedFolders,
      exceptions: config.exceptions,
      renderCompIds: config.renderCompIds || [],
      settings: config.settings,
    };
  };

  const handleOrganize = async () => {
    setStatus("organizing");
    setResult(null);

    try {
      const extendScriptConfig = buildConfigForExtendScript();
      const organizeResult = await evalTS("organizeProject", JSON.stringify(extendScriptConfig));

      if (organizeResult.success) {
        setStatus("success");
        setResult(organizeResult);
        refreshStats();
      } else {
        setStatus("error");
        setResult(organizeResult);
      }
    } catch (e: any) {
      setStatus("error");
      setResult({
        success: false,
        movedItems: [],
        skipped: 0,
        error: e.toString(),
      });
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setStatus("ready");
    setResult(null);
  };

  const updateFolder = (index: number, folder: FolderConfig) => {
    const newFolders = [...config.folders];
    newFolders[index] = folder;
    setConfig({ ...config, folders: newFolders });
  };

  const deleteFolder = (index: number) => {
    const folder = config.folders[index];
    if (folder.isRenderFolder || folder.id === "system") return;

    const newFolders = config.folders.filter((_, i) => i !== index);
    setConfig({ ...config, folders: newFolders });
  };

  const moveFolder = (index: number, direction: -1 | 1) => {
    const folder = config.folders[index];
    if (folder.isRenderFolder || folder.id === "system") return;

    const newFolders = [...config.folders];
    const newIndex = index + direction;

    const targetFolder = newFolders[newIndex];
    if (!targetFolder || targetFolder.isRenderFolder || targetFolder.id === "system") return;

    [newFolders[index], newFolders[newIndex]] = [newFolders[newIndex], newFolders[index]];
    setConfig({ ...config, folders: newFolders });
  };

  const addFolder = () => {
    const normalFolders = config.folders.filter((f) => !f.isRenderFolder && f.id !== "system");
    const order = normalFolders.length + 1;

    const newFolder: FolderConfig = {
      id: generateId(),
      name: "NewFolder",
      order,
      isRenderFolder: false,
      categories: [],
    };

    const systemIdx = config.folders.findIndex((f) => f.id === "system");
    const newFolders = [...config.folders];
    if (systemIdx !== -1) {
      newFolders.splice(systemIdx, 0, newFolder);
    } else {
      newFolders.push(newFolder);
    }

    setConfig({ ...config, folders: newFolders });
  };

  const addException = () => {
    const newException: ExceptionRule = {
      id: generateId(),
      type: "nameContains",
      pattern: "",
      targetFolderId: config.folders[0]?.id || "",
    };
    setConfig({ ...config, exceptions: [...config.exceptions, newException] });
  };

  const updateException = (index: number, exception: ExceptionRule) => {
    const newExceptions = [...config.exceptions];
    newExceptions[index] = exception;
    setConfig({ ...config, exceptions: newExceptions });
  };

  const deleteException = (index: number) => {
    setConfig({ ...config, exceptions: config.exceptions.filter((_, i) => i !== index) });
  };

  const assignedCategories = getAssignedCategories(config.folders);

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      {isDraggingExternal && (
        <div className="drop-overlay" onClick={() => setIsDraggingExternal(false)}>
          <div
            className="normal-drop-zone"
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingExternal(false);
            }}
          >
            <span className="drop-icon">📥</span>
            <span className="drop-text">Drop items here to organize</span>
          </div>
        </div>
      )}

      <div className="container">
        <header className="header">
          <h1>📁 AE Folder Organizer</h1>
          <span className="version">v1.12.4</span>
        </header>

        {stats && config.settings.showStats !== false && (
          <section className="stats-section">
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.comps}</span>
                <span className="stat-label">Comps</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.footage + stats.sequences}</span>
                <span className="stat-label">Footage</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.images}</span>
                <span className="stat-label">Images</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.audio}</span>
                <span className="stat-label">Audio</span>
              </div>
            </div>
          </section>
        )}

        <section className="folders-section">
          <h2 onClick={() => setShowFolders(!showFolders)} style={{ cursor: 'pointer' }}>
            {showFolders ? "▼" : "▶"} Folder Structure
          </h2>
          {showFolders && (
            <>
              <div className="folder-list">
                {config.folders.map((folder, index) => {
                  const normalFolders = config.folders.filter((f) => !f.isRenderFolder && f.id !== "system");
                  const isFirstNormal = !folder.isRenderFolder && folder.id !== "system" &&
                    normalFolders.indexOf(folder) === 0;
                  const isLastNormal = !folder.isRenderFolder && folder.id !== "system" &&
                    normalFolders.indexOf(folder) === normalFolders.length - 1;

                  return (
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      onUpdate={(f) => updateFolder(index, f)}
                      onDelete={() => deleteFolder(index)}
                      onMoveUp={() => moveFolder(index, -1)}
                      onMoveDown={() => moveFolder(index, 1)}
                      assignedCategories={assignedCategories}
                      isFirst={isFirstNormal}
                      isLast={isLastNormal}
                      folders={config.folders}
                    />
                  );
                })}
              </div>
              <button className="btn-add" onClick={addFolder}>
                + Add Folder
              </button>
            </>
          )}
        </section>

        <section className="exceptions-section">
          <h2 onClick={() => setShowExceptions(!showExceptions)}>
            {showExceptions ? "▼" : "▶"} Exceptions
          </h2>
          {showExceptions && (
            <>
              <div className="exception-list">
                {config.exceptions.map((ex, index) => (
                  <div key={ex.id} className="exception-item">
                    <select
                      value={ex.type}
                      onChange={(e) =>
                        updateException(index, { ...ex, type: e.target.value as "nameContains" | "extension" })
                      }
                    >
                      <option value="nameContains">Name contains</option>
                      <option value="extension">Extension</option>
                    </select>
                    <input
                      type="text"
                      value={ex.pattern}
                      onChange={(e) => updateException(index, { ...ex, pattern: e.target.value })}
                      placeholder={ex.type === "extension" ? ".fbx" : "_temp"}
                    />
                    <span>→</span>
                    <select
                      value={ex.targetFolderId}
                      onChange={(e) => updateException(index, { ...ex, targetFolderId: e.target.value })}
                    >
                      {config.folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <button onClick={() => deleteException(index)} className="delete">✕</button>
                  </div>
                ))}
              </div>
              <button className="btn-add" onClick={addException}>+ Add Exception</button>
            </>
          )}
        </section>

        <section className="action-section">
          <button className="btn-reset" onClick={handleReset}>
            Reset to Default
          </button>
          <button
            className={`btn-organize ${status === "organizing" ? "loading" : ""}`}
            onClick={handleOrganize}
            disabled={status === "organizing"}
          >
            {status === "organizing" ? "Organizing..." : "🗂️ ORGANIZE ALL"}
          </button>
        </section>

        {
          result && (
            <section className={`result-section ${result.success ? "success" : "error"}`}>
              {result.success ? (
                <>
                  <h3>✅ Organization Complete!</h3>
                  <div className="result-stats">
                    {result.movedItems.map((item) => (
                      <p key={item.folderId}>
                        📁 {item.folderName}: <strong>{item.count}</strong>
                      </p>
                    ))}
                    <p>⏭️ Skipped: <strong>{result.skipped}</strong></p>
                  </div>
                </>
              ) : (
                <>
                  <h3>❌ Error</h3>
                  <p>{result.error}</p>
                </>
              )}
            </section>
          )
        }

        {/* Batch Rename Section */}
        <section className="batch-rename-section">
          <h2 onClick={() => setShowBatchRename(!showBatchRename)}>
            {showBatchRename ? "▼" : "▶"} 🔤 Batch Rename
          </h2>
          {showBatchRename && (
            <div className="batch-rename-content">
              <button
                className="btn-get-selection"
                onClick={async () => {
                  try {
                    const items = await evalTS("getSelectedItems");
                    setRenameItems(items || []);
                  } catch (e) {
                    console.error("Failed to get selected items:", e);
                  }
                }}
              >
                📂 Get Selected Items ({renameItems.length})
              </button>

              {renameItems.length > 0 && (
                <>
                  <div className="rename-options">
                    <div className="rename-row">
                      <label>Prefix:</label>
                      <input
                        type="text"
                        value={renamePrefix}
                        onChange={(e) => setRenamePrefix(e.target.value)}
                        placeholder="vfx_"
                      />
                    </div>
                    <div className="rename-row">
                      <label>Suffix:</label>
                      <input
                        type="text"
                        value={renameSuffix}
                        onChange={(e) => setRenameSuffix(e.target.value)}
                        placeholder="_v02"
                      />
                    </div>
                    <div className="rename-row">
                      <label>Find:</label>
                      <input
                        type="text"
                        value={renameFind}
                        onChange={(e) => setRenameFind(e.target.value)}
                        placeholder="old"
                      />
                    </div>
                    <div className="rename-row">
                      <label>Replace:</label>
                      <input
                        type="text"
                        value={renameReplace}
                        onChange={(e) => setRenameReplace(e.target.value)}
                        placeholder="new"
                      />
                    </div>
                  </div>

                  <div className="rename-preview">
                    <h4>Preview ({renameItems.length} items)</h4>
                    <div className="preview-list">
                      {renameItems.slice(0, 10).map((item) => {
                        let newName = item.name;
                        if (renameFind) newName = newName.split(renameFind).join(renameReplace);
                        newName = renamePrefix + newName + renameSuffix;
                        return (
                          <div key={item.id} className="preview-item">
                            <span className="old-name">{item.name}</span>
                            <span className="arrow">→</span>
                            <span className="new-name">{newName}</span>
                          </div>
                        );
                      })}
                      {renameItems.length > 10 && <div className="preview-more">...and {renameItems.length - 10} more</div>}
                    </div>
                  </div>

                  <button
                    className="btn-apply-rename"
                    onClick={async () => {
                      const requests = renameItems.map((item) => {
                        let newName = item.name;
                        if (renameFind) newName = newName.split(renameFind).join(renameReplace);
                        newName = renamePrefix + newName + renameSuffix;
                        return { id: item.id, newName };
                      });
                      try {
                        const result = await evalTS("batchRenameItems", requests);
                        if (result.success) {
                          alert(`Renamed ${result.renamed} items! (Ctrl+Z to undo)`);
                          setRenameItems([]);
                        } else {
                          alert(`Renamed ${result.renamed} items with errors: ${result.errors.join(", ")}`);
                        }
                      } catch (e) {
                        console.error("Rename failed:", e);
                      }
                    }}
                  >
                    ✓ Apply Rename
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Settings Section */}
        <section className="settings-section">
          <h2 onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? "▼" : "▶"} Settings
          </h2>
          {showSettings && (
            <div className="settings-list">
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={config.settings.showStats !== false}
                  onChange={(e) => setConfig({
                    ...config,
                    settings: { ...config.settings, showStats: e.target.checked }
                  })}
                />
                <span>Show source overview</span>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={config.settings.deleteEmptyFolders}
                  onChange={(e) => setConfig({
                    ...config,
                    settings: { ...config.settings, deleteEmptyFolders: e.target.checked }
                  })}
                />
                <span>Delete empty folders after organizing</span>
              </label>
              <div className="config-actions">
                <button
                  className="btn-export"
                  onClick={() => {
                    const dataStr = JSON.stringify(config, null, 2);
                    const blob = new Blob([dataStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "ae-folder-organizer-config.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  📤 Export Config
                </button>
                <button
                  className="btn-import"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".json";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          try {
                            const imported = JSON.parse(evt.target?.result as string);
                            if (imported.folders && imported.exceptions) {
                              setConfig(imported);
                              alert("Config imported successfully!");
                            } else {
                              alert("Invalid config file format");
                            }
                          } catch {
                            alert("Failed to parse config file");
                          }
                        };
                        reader.readAsText(file);
                      }
                    };
                    input.click();
                  }}
                >
                  📥 Import Config
                </button>
              </div>
            </div>
          )}
        </section>
      </div >
    </div >
  );
};
