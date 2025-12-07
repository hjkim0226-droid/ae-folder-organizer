import { useEffect, useState } from "react";
import { subscribeBackgroundColor, evalTS } from "../lib/utils/bolt";
import "./main.scss";

// Types
interface OrganizerConfig {
  renderFolderName: string;
  dataFolderName: string;
  renderKeywords: string[];
  organizeSubfolders: boolean;
  hideSystemItems: boolean;
}

interface OrganizeResult {
  success: boolean;
  movedToRender: number;
  movedToData: number;
  skipped: number;
  error?: string;
}

interface ProjectStats {
  totalItems: number;
  comps: number;
  footage: number;
  folders: number;
  solids: number;
}

// Default configuration
const DEFAULT_CONFIG: OrganizerConfig = {
  renderFolderName: "01_Render",
  dataFolderName: "02_Data",
  renderKeywords: ["_render", "_final", "_output", "_export", "RENDER_", "[RENDER]"],
  organizeSubfolders: true,
  hideSystemItems: true,
};

export const App = () => {
  const [bgColor, setBgColor] = useState("#282c34");
  const [config, setConfig] = useState<OrganizerConfig>(DEFAULT_CONFIG);
  const [keywordsInput, setKeywordsInput] = useState(DEFAULT_CONFIG.renderKeywords.join(", "));
  const [status, setStatus] = useState<"ready" | "organizing" | "success" | "error">("ready");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);

  // Subscribe to background color changes
  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
  }, []);

  // Fetch project stats on mount
  useEffect(() => {
    refreshStats();
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
      // Update keywords from input
      const keywords = keywordsInput.split(",").map((k) => k.trim()).filter((k) => k);
      const currentConfig = { ...config, renderKeywords: keywords };

      const organizeResult = await evalTS("organizeProject", JSON.stringify(currentConfig));

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
        movedToRender: 0,
        movedToData: 0,
        skipped: 0,
        error: e.toString(),
      });
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setKeywordsInput(DEFAULT_CONFIG.renderKeywords.join(", "));
    setStatus("ready");
    setResult(null);
  };

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      <div className="container">
        {/* Header */}
        <header className="header">
          <h1>📁 AE Folder Organizer</h1>
        </header>

        {/* Project Stats */}
        {stats && (
          <section className="stats-section">
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.comps}</span>
                <span className="stat-label">Comps</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.footage}</span>
                <span className="stat-label">Footage</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.solids}</span>
                <span className="stat-label">Solids</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.folders}</span>
                <span className="stat-label">Folders</span>
              </div>
            </div>
          </section>
        )}

        {/* Settings */}
        <section className="settings-section">
          <h2>Folder Names</h2>
          <div className="input-group">
            <label>Render Folder</label>
            <input
              type="text"
              value={config.renderFolderName}
              onChange={(e) => setConfig({ ...config, renderFolderName: e.target.value })}
            />
          </div>
          <div className="input-group">
            <label>Data Folder</label>
            <input
              type="text"
              value={config.dataFolderName}
              onChange={(e) => setConfig({ ...config, dataFolderName: e.target.value })}
            />
          </div>

          <h2>Render Keywords</h2>
          <div className="input-group">
            <textarea
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="Comma-separated keywords (e.g., _render, _final)"
              rows={2}
            />
            <small>Comps containing these keywords go to Render folder</small>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.organizeSubfolders}
                onChange={(e) => setConfig({ ...config, organizeSubfolders: e.target.checked })}
              />
              Organize Data subfolders (Footage, Images, Audio)
            </label>
          </div>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.hideSystemItems}
                onChange={(e) => setConfig({ ...config, hideSystemItems: e.target.checked })}
              />
              Hide system items (Solids, Nulls)
            </label>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="action-section">
          <button
            className={`btn-organize ${status === "organizing" ? "loading" : ""}`}
            onClick={handleOrganize}
            disabled={status === "organizing"}
          >
            {status === "organizing" ? "Organizing..." : "🗂️ ORGANIZE PROJECT"}
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
                  <p>📁 Moved to Render: <strong>{result.movedToRender}</strong></p>
                  <p>📦 Moved to Data: <strong>{result.movedToData}</strong></p>
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
