/**
 * useBatchRename Hook
 * Manages batch rename workflow
 */

import { useState, useCallback, useMemo } from "react";
import { evalTS } from "../../js/lib/utils/bolt";
import type { ItemInfo, RenameRequest, RenameResult } from "../../domain/types";

interface RenamePreview {
  id: number;
  original: string;
  preview: string;
}

interface UseBatchRenameReturn {
  // State
  items: ItemInfo[];
  prefix: string;
  suffix: string;
  findText: string;
  replaceText: string;
  isLoading: boolean;
  error: string | null;
  result: RenameResult | null;

  // Actions
  setPrefix: (value: string) => void;
  setSuffix: (value: string) => void;
  setFindText: (value: string) => void;
  setReplaceText: (value: string) => void;
  fetchSelectedItems: () => Promise<void>;
  applyRename: () => Promise<void>;
  reset: () => void;

  // Computed
  previews: RenamePreview[];
  hasChanges: boolean;
}

export function useBatchRename(): UseBatchRenameReturn {
  const [items, setItems] = useState<ItemInfo[]>([]);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenameResult | null>(null);

  /**
   * Generate preview of renamed items
   */
  const previews = useMemo((): RenamePreview[] => {
    return items.map((item) => {
      let newName = item.name;

      // Apply find/replace
      if (findText) {
        newName = newName.split(findText).join(replaceText);
      }

      // Apply prefix
      if (prefix) {
        newName = prefix + newName;
      }

      // Apply suffix
      if (suffix) {
        // Insert suffix before extension
        const dotIndex = newName.lastIndexOf(".");
        if (dotIndex > 0) {
          newName =
            newName.substring(0, dotIndex) +
            suffix +
            newName.substring(dotIndex);
        } else {
          newName = newName + suffix;
        }
      }

      return {
        id: item.id,
        original: item.name,
        preview: newName,
      };
    });
  }, [items, prefix, suffix, findText, replaceText]);

  /**
   * Check if any changes would be made
   */
  const hasChanges = useMemo(() => {
    return previews.some((p) => p.original !== p.preview);
  }, [previews]);

  /**
   * Fetch selected items from host app
   */
  const fetchSelectedItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const selectedItems = await evalTS("getSelectedItems");
      // Filter out folders
      const nonFolders = selectedItems.filter(
        (item: ItemInfo) => !item.isFolder
      );
      setItems(nonFolders);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Apply rename to all items with changes
   */
  const applyRename = useCallback(async () => {
    const requests: RenameRequest[] = previews
      .filter((p) => p.original !== p.preview)
      .map((p) => ({
        id: p.id,
        newName: p.preview,
      }));

    if (requests.length === 0) {
      setError("No changes to apply");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const renameResult = await evalTS("batchRenameItems", requests);
      setResult(renameResult);

      if (renameResult.success) {
        // Refresh items after successful rename
        await fetchSelectedItems();
        // Reset inputs
        setPrefix("");
        setSuffix("");
        setFindText("");
        setReplaceText("");
      } else if (renameResult.errors && renameResult.errors.length > 0) {
        setError(renameResult.errors.join(", "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [previews, fetchSelectedItems]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setItems([]);
    setPrefix("");
    setSuffix("");
    setFindText("");
    setReplaceText("");
    setError(null);
    setResult(null);
  }, []);

  return {
    items,
    prefix,
    suffix,
    findText,
    replaceText,
    isLoading,
    error,
    result,
    setPrefix,
    setSuffix,
    setFindText,
    setReplaceText,
    fetchSelectedItems,
    applyRename,
    reset,
    previews,
    hasChanges,
  };
}
