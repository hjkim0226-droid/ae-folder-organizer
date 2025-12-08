import { useEffect, useState, useCallback } from "react";
import { subscribeBackgroundColor, evalTS } from "../lib/utils/bolt";
import "./main.scss";

// ===== Types =====

interface FolderConfig {
  id: string;
  name: string;
  order: number;
  isRenderFolder: boolean;
  renderKeywords?: string[];
  categories?: CategoryConfig[];
}

interface CategoryConfig {
  type: CategoryType;
  enabled: boolean;
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

// ===== Default Config =====

const DEFAULT_CONFIG: OrganizerConfig = {
  folders: [
    {
      id: "render",
      name: "00_Render",
      order: 0,
      isRenderFolder: true,
      renderKeywords: ["_render", "_final", "_output", "_export", "RENDER_", "[RENDER]"],
      categories: [],
    },
    {
      id: "source",
      name: "01_Source",
      order: 1,
      isRenderFolder: false,
      categories: [
        { type: "Footage", enabled: true, createSubfolders: false, detectSequences: true },
        { type: "Images", enabled: true, createSubfolders: false, detectSequences: true },
        { type: "Audio", enabled: true, createSubfolders: false },
        { type: "Comps", enabled: true, createSubfolders: false },
      ],
    },
    {
      id: "system",
      name: "99_System",
      order: 99,
      isRenderFolder: false,
      categories: [
        { type: "Solids", enabled: true, createSubfolders: false },
      ],
    },
  ],
  exceptions: [],
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

// ===== Components =====

const FolderItem = ({
  folder,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  assignedCategories,
  isFirst,
  isLast,
}: {
  folder: FolderConfig;
  onUpdate: (folder: FolderConfig) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  assignedCategories: Map<CategoryType, string>;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleCategory = (type: CategoryType) => {
    const categories = folder.categories || [];
    const existing = categories.find((c) => c.type === type);

    if (existing) {
      // Toggle off
      onUpdate({
        ...folder,
        categories: categories.filter((c) => c.type !== type),
      });
    } else {
      // Toggle on
      onUpdate({
        ...folder,
        categories: [
          ...categories,
          { type, enabled: true, createSubfolders: false, detectSequences: type === "Footage" || type === "Images" },
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

  return (
    <div className="folder-item">
      <div className="folder-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="folder-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="folder-emoji">📁</span>
        <input
          type="text"
          className="folder-name"
          value={folder.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ ...folder, name: e.target.value })}
        />
        <div className="folder-actions">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst}>↑</button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast}>↓</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="delete">✕</button>
        </div>
      </div>

      {isExpanded && (
        <div className="folder-content">
          {folder.isRenderFolder ? (
            <div className="render-keywords">
              <label>Keywords:</label>
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
          ) : (
            <div className="category-list">
              {ALL_CATEGORIES.map((type) => {
                const disabled = isCategoryDisabled(type);
                const enabled = isCategoryEnabled(type);
                const assignedTo = assignedCategories.get(type);
                const catConfig = folder.categories?.find((c) => c.type === type);

                return (
                  <div key={type} className={`category-item ${disabled ? "disabled" : ""}`}>
                    <label className="category-checkbox">
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={disabled}
                        onChange={() => toggleCategory(type)}
                      />
                      <span>{type}</span>
                      {disabled && assignedTo && (
                        <span className="assigned-hint">
                          (in {DEFAULT_CONFIG.folders.find((f) => f.id === assignedTo)?.name || assignedTo})
                        </span>
                      )}
                    </label>
                    {enabled && catConfig && (
                      <label className="subfolder-option">
                        <input
                          type="checkbox"
                          checked={catConfig.createSubfolders}
                          onChange={() => toggleSubfolders(type)}
                        />
                        <span>Create subfolders</span>
                      </label>
                    )}
                  </div>
                );
              })}
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
  const [config, setConfig] = useState<OrganizerConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<"ready" | "organizing" | "success" | "error">("ready");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);

  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
    refreshStats();

    // Load saved config
    const saved = localStorage.getItem("ae-folder-organizer-config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
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
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      // Note: CEP drag-drop from AE project panel requires special handling
      // For now, this handles the visual feedback
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

  const handleOrganize = async () => {
    setStatus("organizing");
    setResult(null);

    try {
      const organizeResult = await evalTS("organizeProject", JSON.stringify(config));

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
    const newFolders = config.folders.filter((_, i) => i !== index);
    setConfig({ ...config, folders: newFolders });
  };

  const moveFolder = (index: number, direction: -1 | 1) => {
    const newFolders = [...config.folders];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newFolders.length) return;

    [newFolders[index], newFolders[newIndex]] = [newFolders[newIndex], newFolders[index]];

    // Update order numbers
    newFolders.forEach((f, i) => {
      f.order = i;
      f.name = f.name.replace(/^\d+_/, `${i.toString().padStart(2, "0")}_`);
    });

    setConfig({ ...config, folders: newFolders });
  };

  const addFolder = () => {
    const order = config.folders.length;
    const newFolder: FolderConfig = {
      id: generateId(),
      name: `${order.toString().padStart(2, "0")}_NewFolder`,
      order,
      isRenderFolder: false,
      categories: [],
    };
    setConfig({ ...config, folders: [...config.folders, newFolder] });
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

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      {/* Drag Overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-content">
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
          <h2 onClick={() => { }}>▼ Folder Structure</h2>
          <div className="folder-list">
            {config.folders.map((folder, index) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                onUpdate={(f) => updateFolder(index, f)}
                onDelete={() => deleteFolder(index)}
                onMoveUp={() => moveFolder(index, -1)}
                onMoveDown={() => moveFolder(index, 1)}
                assignedCategories={assignedCategories}
                isFirst={index === 0}
                isLast={index === config.folders.length - 1}
              />
            ))}
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
                      {config.folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
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
