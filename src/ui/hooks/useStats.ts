/**
 * useStats Hook
 * Fetches and manages project statistics
 */

import { useState, useCallback, useEffect } from "react";
import { evalTS } from "../../js/lib/utils/bolt";
import type { ProjectStats } from "../../domain/types";

interface UseStatsReturn {
  stats: ProjectStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_STATS: ProjectStats = {
  totalItems: 0,
  comps: 0,
  footage: 0,
  images: 0,
  audio: 0,
  sequences: 0,
  solids: 0,
  folders: 0,
  missingFootage: 0,
  unusedItems: 0,
};

export function useStats(autoRefresh = true): UseStatsReturn {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch project statistics from host app
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const projectStats = await evalTS("getProjectStats");
      setStats(projectStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStats(DEFAULT_STATS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh on mount
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

  return {
    stats,
    isLoading,
    error,
    refresh,
  };
}
