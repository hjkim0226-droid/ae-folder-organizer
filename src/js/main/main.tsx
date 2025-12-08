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
}

interface CategoryConfig {
  type: CategoryType;
  enabled: boolean;
  order: number;
  createSubfolders: boolean;
  detectSequences?: boolean;
  keywords?: string[];  // When keywords exist, filter by keywords instead of format
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
      renderKeywords: ["_render", "_final", "_output", "_export", "RENDER_", "[RENDER]"],
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
  },
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

const getDisplayFolderName = (folder: FolderConfig, index: number): string => {
  if (folder.id === "system") {
    return `99_${folder.name}`;
  }
  const prefix = index.toString().padStart(2, "0");
  return `${prefix}_${folder.name}`;
};

// ===== Draggable Category Component =====
const DraggableCategory = ({
  category,
  onDelete,
  onToggleSubfolders,
  onUpdateKeywords,
  isDragOver,
  dragHandlers,
}: {
  category: CategoryConfig;
  onDelete: () => void;
  onToggleSubfolders: () => void;
  onUpdateKeywords: (keywords: string[]) => void;
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
  const hasKeywords = category.keywords && category.keywords.length > 0;

  return (
    <div className={`category-item-wrapper ${isDragOver ? "drag-over" : ""}`}>
      <div
        className="category-item"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          dragHandlers.onDragStart(e, category.type);
        }}
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
        onDragEnd={dragHandlers.onDragEnd}
      >
        <span
          className="category-name"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: "pointer" }}
        >
          {isExpanded ? "▼" : "▶"} {category.type}
          {hasKeywords && <span className="keyword-badge">🔑</span>}
        </span>
        <div className="category-drag-handle">⋮⋮</div>
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

      {isExpanded && (
        <div className="category-keywords">
          <label>Keywords (filter by name):</label>
          <input
            type="text"
            placeholder="_temp, _draft, project_"
            value={category.keywords?.join(", ") || ""}
            onChange={(e) => {
              const keywords = e.target.value
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean);
              onUpdateKeywords(keywords);
            }}
          />
          <small>When keywords are set, only items matching keywords go here</small>
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
    onUpdate({
      ...folder,
      categories: [
        ...categories,
        { type, enabled: true, order: maxOrder + 1, createSubfolders: false, detectSequences: type === "Footage" || type === "Images" },
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

  const updateKeywords = (type: CategoryType, keywords: string[]) => {
    const categories = folder.categories || [];
    onUpdate({
      ...folder,
      categories: categories.map((c) =>
        c.type === type ? { ...c, keywords } : c
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
                  {sortedCategories.map((cat) => (
                    <DraggableCategory
                      key={cat.type}
                      category={cat}
                      onDelete={() => deleteCategory(cat.type)}
                      onToggleSubfolders={() => toggleSubfolders(cat.type)}
                      onUpdateKeywords={(keywords) => updateKeywords(cat.type, keywords)}
                      isDragOver={dragOverCategory === cat.type}
                      dragHandlers={{
                        ...categoryDragHandlers,
                        onDragOver: (e) => {
                          categoryDragHandlers.onDragOver(e);
                          setDragOverCategory(cat.type);
                        },
                      }}
                    />
                  ))}
                  {/* Drop zone for moving to end */}
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
                      <span>Drop here (end)</span>
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
  const [isRenderDrop, setIsRenderDrop] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      if (types.includes("text/category")) return;

      e.preventDefault();
      dragCounter++;
      setIsDraggingExternal(true);
    };

    const onDragLeave = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category")) return;

      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDraggingExternal(false);
        setIsRenderDrop(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category")) return;
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      const types = e.dataTransfer?.types || [];
      if (types.includes("text/category")) return;

      e.preventDefault();
      dragCounter = 0;
      setIsDraggingExternal(false);
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
            className={`render-drop-zone ${isRenderDrop ? "active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsRenderDrop(true); }}
            onDragLeave={() => setIsRenderDrop(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsRenderDrop(false);
              setIsDraggingExternal(false);
              // Show hint to add render keyword manually
              alert('To mark a comp as Render:\n1. Add a keyword like "_render" to the comp name\n2. Or add the keyword to the Render folder settings');
            }}
          >
            <span className="zone-icon">🎬</span>
            <span className="zone-text">Drop here for Render Comp</span>
          </div>

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
          <span className="version">v1.1</span>
        </header>

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
                  checked={config.settings.deleteEmptyFolders}
                  onChange={(e) => setConfig({
                    ...config,
                    settings: { ...config.settings, deleteEmptyFolders: e.target.checked }
                  })}
                />
                <span>Delete empty folders after organizing</span>
              </label>
            </div>
          )}
        </section>

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
