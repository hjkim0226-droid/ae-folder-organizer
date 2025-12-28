/**
 * AE Folder Organizer - Main Application
 * CEP Extension for organizing After Effects / Premiere Pro project items
 */

import { useEffect, useState } from "react";
import { subscribeBackgroundColor, evalTS } from "../lib/utils/bolt";
import "./main.scss";

// Domain Layer
import {
  getAssignedCategories,
  generateId,
  validateConfig,
  getDisplayFolderName,
  sortFolders,
} from "../../domain";
import { CONFIG_VERSION, DEFAULT_CONFIG } from "../../domain/constants";
import type {
  ExceptionRule,
  FolderConfig,
  OrganizeResult,
  ProjectStats,
  VersionedConfig
} from "../../domain/types";

// UI Layer
import {
  HostAppProvider,
  useHostApp,
  ConfigProvider,
  useConfig
} from "../../ui/contexts";
import { FolderItem } from "../../ui/components";

// ===== App Content Component =====
// This is the main app content that uses contexts

function AppContent() {
  const { terms, hostApp } = useHostApp();
  const { config, setConfig, updateSettings, exportConfig, importConfig, resetConfig, addFolder: configAddFolder } = useConfig();
  const t = terms;

  // Local UI state
  const [bgColor, setBgColor] = useState("#282c34");
  const [status, setStatus] = useState<"ready" | "organizing" | "success" | "error">("ready");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);
  const [showFolders, setShowFolders] = useState(true);
  const [showHeader, setShowHeader] = useState(false);  // 헤더 아코디언 (닫힘 기본)
  const [showSettings, setShowSettings] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [renameItems, setRenameItems] = useState<{ id: number; name: string; type: string }[]>([]);
  const [renamePrefix, setRenamePrefix] = useState("");
  const [renameSuffix, setRenameSuffix] = useState("");
  const [renameFind, setRenameFind] = useState("");
  const [renameReplace, setRenameReplace] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Error notification
  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Initialize
  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
    refreshStats();
  }, []);

  // External drag & drop handling
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
      dragCounter = Math.max(0, dragCounter - 1);
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

  // ===== Actions =====

  const refreshStats = async () => {
    try {
      const projectStats = await evalTS("getProjectStats");
      setStats(projectStats);
    } catch (e) {
      console.error("Failed to get project stats:", e);
    }
  };

  const buildConfigForExtendScript = () => {
    const sortedFolders = sortFolders(config.folders);

    return {
      folders: sortedFolders.map((folder, index) => ({
        ...folder,
        name: getDisplayFolderName(folder, index),
      })),
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
    } catch (e: unknown) {
      setStatus("error");
      setResult({
        success: false,
        movedItems: [],
        skipped: 0,
        error: String(e),
      });
    }
  };

  const handleReset = () => {
    resetConfig();
    setStatus("ready");
    setResult(null);
  };

  // ===== Folder Management =====

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

  // ===== Exception Management =====

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

  // ===== Computed =====

  const assignedCategories = getAssignedCategories(config.folders);

  // ===== Render =====

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
        {/* Organize Button - Always at Top */}
        <section className="action-section top-action">
          <button
            className={`btn-organize ${status === "organizing" ? "loading" : ""}`}
            onClick={handleOrganize}
            disabled={status === "organizing"}
          >
            {status === "organizing" ? "Organizing..." : "🗂️ ORGANIZE ALL"}
          </button>
        </section>

        {/* Result - Show immediately after action */}
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

        {errorMessage && (
          <div className="error-toast" onClick={() => setErrorMessage(null)}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Header Accordion - Collapsed by default */}
        <section className="header-section">
          <h2 onClick={() => setShowHeader(!showHeader)} style={{ cursor: 'pointer' }}>
            {showHeader ? "▼" : "▶"} 📁 Snap Organizer <span className="version">v1.13.0</span>
          </h2>
          {showHeader && stats && (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.comps}</span>
                <span className="stat-label">{hostApp === "ppro" ? "Sequences" : "Comps"}</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.footage + stats.sequences}</span>
                <span className="stat-label">{hostApp === "ppro" ? "Clips" : "Footage"}</span>
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
          )}
        </section>

        <section className="folders-section">
          <h2 onClick={() => setShowFolders(!showFolders)} style={{ cursor: 'pointer' }}>
            {showFolders ? "▼" : "▶"} {t.folder} Structure
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
                + Add {t.folder}
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
                    showError("Failed to get selected items");
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
                        const renameResult = await evalTS("batchRenameItems", requests);
                        if (renameResult.success) {
                          alert(`Renamed ${renameResult.renamed} items! (Ctrl+Z to undo)`);
                          setRenameItems([]);
                        } else {
                          alert(`Renamed ${renameResult.renamed} items with errors: ${renameResult.errors.join(", ")}`);
                        }
                      } catch (e) {
                        showError("Rename failed");
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
                  onChange={(e) => updateSettings({ showStats: e.target.checked })}
                />
                <span>Show source overview</span>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={config.settings.deleteEmptyFolders}
                  onChange={(e) => updateSettings({ deleteEmptyFolders: e.target.checked })}
                />
                <span>Delete empty folders after organizing</span>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={config.settings.applyFolderLabelColor || false}
                  onChange={(e) => updateSettings({ applyFolderLabelColor: e.target.checked })}
                />
                <span>Apply label color to folders</span>
              </label>
              <div className="config-actions">
                <button className="btn-reset" onClick={handleReset}>
                  🔄 Reset to Default
                </button>
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
                            if (!validateConfig(imported)) {
                              showError("Invalid config file format");
                              return;
                            }
                            imported.version = CONFIG_VERSION;
                            setConfig(imported);
                            alert("Config imported successfully!");
                          } catch {
                            showError("Failed to parse config file");
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
      </div>
    </div>
  );
}

// ===== Main App with Providers =====

export const App = () => {
  return (
    <HostAppProvider>
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </HostAppProvider>
  );
};
