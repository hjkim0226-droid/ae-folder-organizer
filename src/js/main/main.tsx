import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeBackgroundColor, evalTS } from "../lib/utils/bolt";
import "./main.scss";

// ===== Types =====

interface FolderConfig {
  id: string;
  name: string;           // Base name without number prefix (e.g., "Render")
  order: number;
  isRenderFolder: boolean;
  renderKeywords?: string[];
  skipOrganization?: boolean;  // Items in this folder skip further organization
  categories?: CategoryConfig[];
}

interface CategoryConfig {
  type: CategoryType;
  enabled: boolean;
  order: number;          // For drag-drop ordering within folder
  createSubfolders: boolean;
  detectSequences?: boolean;
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
  renderCompIds: number[];  // IDs of comps designated as render comps
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
const CONFIG_VERSION = 3;

interface VersionedConfig extends OrganizerConfig {
  version?: number;
}

// ===== Default Config =====
const DEFAULT_CONFIG: VersionedConfig = {
  version: CONFIG_VERSION,
  folders: [
    {
      id: "render",
      name: "Render",  // Will become "00_Render" automatically
      order: 0,
      isRenderFolder: true,
      renderKeywords: ["_render", "_final", "_output", "_export", "RENDER_", "[RENDER]"],
      skipOrganization: true,
      categories: [],
    },
    {
      id: "source",
      name: "Source",  // Will become "01_Source"
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
      name: "System",  // Will become "99_System"
      order: 99,
      isRenderFolder: false,
      categories: [
        { type: "Solids", enabled: true, order: 0, createSubfolders: false },
      ],
    },
  ],
  exceptions: [],
  renderCompIds: [],
};

const ALL_CATEGORIES: CategoryType[] = ["Comps", "Footage", "Images", "Audio", "Solids"];

// ===== Helper Functions =====
const generateId = () => Math.random().toString(36).substring(2, 9);

const getAssignedCategories = (folders: FolderConfig[]): Map<CategoryType, string> => {
  const assigned = new Map<CategoryType, string>();
  folders.forEach((folder) => {
    folder.categories?.forEach((cat) => {
      if (cat.enabled) {
        assigned.set(cat.type, folder.id);
      }
    });
  });
  return assigned;
};

// Get display name with auto numbering
const getDisplayFolderName = (folder: FolderConfig, index: number, totalFolders: number): string => {
  // Special case: System folder always at end
  if (folder.id === "system") {
    return `99_${folder.name}`;
  }
  const prefix = index.toString().padStart(2, "0");
  return `${prefix}_${folder.name}`;
};

// ===== Draggable Category Component =====
const DraggableCategory = ({
  category,
  folderId,
  onToggle,
  onToggleSubfolders,
  isDisabled,
  assignedTo,
  dragHandlers,
}: {
  category: CategoryConfig;
  folderId: string;
  onToggle: () => void;
  onToggleSubfolders: () => void;
  isDisabled: boolean;
  assignedTo?: string;
  dragHandlers: {
    onDragStart: (e: React.DragEvent, type: CategoryType) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, type: CategoryType) => void;
  };
}) => {
  return (
    <div
      className={`category-item ${isDisabled ? "disabled" : ""}`}
      draggable={!isDisabled && category.enabled}
      onDragStart={(e) => dragHandlers.onDragStart(e, category.type)}
      onDragOver={dragHandlers.onDragOver}
      onDrop={(e) => dragHandlers.onDrop(e, category.type)}
    >
      <div className="category-drag-handle">⋮⋮</div>
      <label className="category-checkbox">
        <input
          type="checkbox"
          checked={category.enabled}
          disabled={isDisabled}
          onChange={onToggle}
        />
        <span>{category.type}</span>
        {isDisabled && assignedTo && (
          <span className="assigned-hint">(in {assignedTo})</span>
        )}
      </label>
      {category.enabled && (
        <label className="subfolder-option">
          <input
            type="checkbox"
            checked={category.createSubfolders}
            onChange={onToggleSubfolders}
          />
          <span>Subfolders</span>
        </label>
      )}
    </div>
  );
};

// ===== Folder Item Component =====
const FolderItem = ({
  folder,
  displayIndex,
  totalFolders,
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
  displayIndex: number;
  totalFolders: number;
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

  const displayName = getDisplayFolderName(folder, displayIndex, totalFolders);

  const toggleCategory = (type: CategoryType) => {
    const categories = folder.categories || [];
    const existing = categories.find((c) => c.type === type);

    if (existing) {
      onUpdate({
        ...folder,
        categories: categories.filter((c) => c.type !== type),
      });
    } else {
      const maxOrder = Math.max(0, ...categories.map((c) => c.order));
      onUpdate({
        ...folder,
        categories: [
          ...categories,
          { type, enabled: true, order: maxOrder + 1, createSubfolders: false, detectSequences: type === "Footage" || type === "Images" },
        ],
      });
    }
  };

  const isCategoryEnabled = (type: CategoryType) => {
    return folder.categories?.some((c) => c.type === type && c.enabled) || false;
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

  // Drag handlers for category reordering
  const categoryDragHandlers = {
    onDragStart: (e: React.DragEvent, type: CategoryType) => {
      setDraggedCategory(type);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (e: React.DragEvent, targetType: CategoryType) => {
      e.preventDefault();
      if (!draggedCategory || draggedCategory === targetType) return;

      const categories = folder.categories || [];
      const draggedIdx = categories.findIndex((c) => c.type === draggedCategory);
      const targetIdx = categories.findIndex((c) => c.type === targetType);

      if (draggedIdx === -1 || targetIdx === -1) return;

      const newCategories = [...categories];
      const [removed] = newCategories.splice(draggedIdx, 1);
      newCategories.splice(targetIdx, 0, removed);

      // Update order numbers
      newCategories.forEach((c, i) => {
        c.order = i;
      });

      onUpdate({ ...folder, categories: newCategories });
      setDraggedCategory(null);
    },
  };

  const sortedCategories = [...(folder.categories || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="folder-item">
      <div className="folder-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="folder-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="folder-emoji">📁</span>
        <span className="folder-display-name">{displayName}</span>
        <input
          type="text"
          className="folder-name-input"
          value={folder.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ ...folder, name: e.target.value })}
          placeholder="Folder name"
        />
        <div className="folder-actions">
          {!folder.isRenderFolder && (
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
              <label className="skip-org-option">
                <input
                  type="checkbox"
                  checked={folder.skipOrganization !== false}
                  onChange={(e) => onUpdate({ ...folder, skipOrganization: e.target.checked })}
                />
                <span>Skip organization for items in this folder</span>
              </label>
              <div className="render-keywords">
                <label>Keywords (auto-detect):</label>
                <input
                  type="text"
                  value={folder.renderKeywords?.join(", ") || ""}
                  onChange={(e) =>
                    onUpdate({
                      ...folder,
                      renderKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                    })
                  }
                  placeholder="_render, _final, _output"
                />
              </div>
            </div>
          ) : (
            <div className="category-list">
              {sortedCategories.length > 0 ? (
                sortedCategories.map((cat) => {
                  const disabled = isCategoryDisabled(cat.type);
                  const assignedTo = assignedCategories.get(cat.type);
                  const assignedFolderName = folders.find((f) => f.id === assignedTo)?.name;

                  return (
                    <DraggableCategory
                      key={cat.type}
                      category={cat}
                      folderId={folder.id}
                      onToggle={() => toggleCategory(cat.type)}
                      onToggleSubfolders={() => toggleSubfolders(cat.type)}
                      isDisabled={disabled}
                      assignedTo={assignedFolderName}
                      dragHandlers={categoryDragHandlers}
                    />
                  );
                })
              ) : (
                <div className="no-categories">No categories assigned</div>
              )}

              {/* Available categories to add */}
              <div className="add-category">
                {ALL_CATEGORIES.filter(
                  (type) => !folder.categories?.some((c) => c.type === type) && !isCategoryDisabled(type)
                ).map((type) => (
                  <button
                    key={type}
                    className="btn-add-category"
                    onClick={() => toggleCategory(type)}
                  >
                    + {type}
                  </button>
                ))}
              </div>
            </div>
          )}
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
  const [isDragging, setIsDragging] = useState(false);
  const [isRenderDrop, setIsRenderDrop] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);

  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
    refreshStats();

    // Load saved config (with version check)
    const saved = localStorage.getItem("ae-folder-organizer-config");
    if (saved) {
      try {
        const parsed: VersionedConfig = JSON.parse(saved);
        if (parsed.version === CONFIG_VERSION) {
          setConfig(parsed);
        } else {
          console.log("Config version mismatch, using default config");
          localStorage.removeItem("ae-folder-organizer-config");
        }
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    }
  }, []);

  // Save config on change
  useEffect(() => {
    localStorage.setItem("ae-folder-organizer-config", JSON.stringify(config));
  }, [config]);

  // Drag and drop handlers
  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
        setIsRenderDrop(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      setIsRenderDrop(false);
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

  // Build config with auto-numbered folder names for ExtendScript
  const buildConfigForExtendScript = (): OrganizerConfig => {
    const sortedFolders = [...config.folders]
      .filter((f) => f.id !== "system")
      .sort((a, b) => a.order - b.order);

    const systemFolder = config.folders.find((f) => f.id === "system");

    const numberedFolders = sortedFolders.map((folder, index) => ({
      ...folder,
      name: getDisplayFolderName(folder, index, sortedFolders.length),
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
    if (folder.isRenderFolder) return; // Can't delete Render folder

    const newFolders = config.folders.filter((_, i) => i !== index);
    // Reorder remaining folders
    newFolders.forEach((f, i) => {
      if (!f.isRenderFolder && f.id !== "system") {
        f.order = i;
      }
    });
    setConfig({ ...config, folders: newFolders });
  };

  const moveFolder = (index: number, direction: -1 | 1) => {
    const folder = config.folders[index];
    if (folder.isRenderFolder || folder.id === "system") return;

    const newFolders = [...config.folders];
    const newIndex = index + direction;

    // Don't move past render folder (index 0) or system folder
    const targetFolder = newFolders[newIndex];
    if (!targetFolder || targetFolder.isRenderFolder || targetFolder.id === "system") return;

    [newFolders[index], newFolders[newIndex]] = [newFolders[newIndex], newFolders[index]];

    // Update order numbers (skip render and system)
    let orderNum = 1;
    newFolders.forEach((f) => {
      if (!f.isRenderFolder && f.id !== "system") {
        f.order = orderNum++;
      }
    });

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

    // Insert before system folder
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
    const newExceptions = config.exceptions.filter((_, i) => i !== index);
    setConfig({ ...config, exceptions: newExceptions });
  };

  const assignedCategories = getAssignedCategories(config.folders);

  // Get display indices (excluding system folder from count)
  const getNormalFolderIndex = (folderIndex: number): number => {
    let count = 0;
    for (let i = 0; i < folderIndex; i++) {
      const f = config.folders[i];
      if (!f.isRenderFolder && f.id !== "system") {
        count++;
      }
    }
    return config.folders[folderIndex].isRenderFolder ? 0 : count + 1;
  };

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      {/* Drag Overlay */}
      {isDragging && (
        <div className="drop-overlay">
          {/* Render Comp Drop Zone */}
          <div
            className={`render-drop-zone ${isRenderDrop ? "active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsRenderDrop(true); }}
            onDragLeave={() => setIsRenderDrop(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsRenderDrop(false);
              // Handle render comp drop
              console.log("Dropped to Render zone");
            }}
          >
            <span className="zone-icon">🎬</span>
            <span className="zone-text">Drop here for Render Comp</span>
          </div>

          {/* Normal Drop Zone */}
          <div className="normal-drop-zone">
            <span className="drop-icon">📥</span>
            <span className="drop-text">Drop items here to organize</span>
          </div>
        </div>
      )}

      <div className="container">
        {/* Header */}
        <header className="header">
          <h1>📁 AE Folder Organizer</h1>
          <span className="version">v1.1</span>
        </header>

        {/* Stats */}
        {stats && (
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

        {/* Folder Structure */}
        <section className="folders-section">
          <h2>▼ Folder Structure</h2>
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
                  displayIndex={getNormalFolderIndex(index)}
                  totalFolders={normalFolders.length}
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
        </section>

        {/* Exceptions */}
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
                      {config.folders.map((f, i) => (
                        <option key={f.id} value={f.id}>
                          {getDisplayFolderName(f, getNormalFolderIndex(i), config.folders.length)}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => deleteException(index)} className="delete">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-add" onClick={addException}>
                + Add Exception
              </button>
            </>
          )}
        </section>

        {/* Actions */}
        <section className="action-section">
          <button
            className={`btn-organize ${status === "organizing" ? "loading" : ""}`}
            onClick={handleOrganize}
            disabled={status === "organizing"}
          >
            {status === "organizing" ? "Organizing..." : "🗂️ ORGANIZE ALL"}
          </button>
          <button className="btn-reset" onClick={handleReset}>
            Reset to Default
          </button>
        </section>

        {/* Result */}
        {result && (
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
        )}
      </div>
    </div>
  );
};
