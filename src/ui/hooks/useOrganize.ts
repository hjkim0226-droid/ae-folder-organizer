/**
 * useOrganize Hook
 * Handles project organization workflow
 */

import { useState, useCallback } from "react";
import { evalTS } from "../../js/lib/utils/bolt";
import { useConfig } from "../contexts/ConfigContext";
import type { OrganizeResult, OrganizeStatus } from "../../domain/types";
import { sortFolders, getDisplayFolderName } from "../../domain";

interface UseOrganizeReturn {
  status: OrganizeStatus;
  result: OrganizeResult | null;
  errorMessage: string | null;
  organize: (itemIds?: number[]) => Promise<void>;
  organizeSelected: () => Promise<void>;
  clearResult: () => void;
}

export function useOrganize(): UseOrganizeReturn {
  const { config } = useConfig();
  const [status, setStatus] = useState<OrganizeStatus>("ready");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Build config for ExtendScript with display names
   */
  const buildExtendScriptConfig = useCallback(() => {
    const sortedFolders = sortFolders(config.folders);

    return {
      ...config,
      folders: sortedFolders.map((folder, index) => ({
        ...folder,
        displayName: getDisplayFolderName(folder, index),
        categories: folder.categories?.map((cat, catIndex) => ({
          ...cat,
          order: cat.order ?? catIndex,
          subcategories: cat.subcategories?.map((sub, subIndex) => ({
            ...sub,
            order: sub.order ?? subIndex,
          })),
        })),
      })),
    };
  }, [config]);

  /**
   * Organize all items in project
   */
  const organize = useCallback(
    async (itemIds?: number[]) => {
      setStatus("organizing");
      setErrorMessage(null);

      try {
        const extendScriptConfig = buildExtendScriptConfig();
        const configJson = JSON.stringify(extendScriptConfig);
        const itemIdsJson = itemIds ? JSON.stringify(itemIds) : undefined;

        const organizeResult = await evalTS(
          "organizeProject",
          configJson,
          itemIdsJson
        );

        if (organizeResult.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(organizeResult.error || "Unknown error");
        }

        setResult(organizeResult);
      } catch (e) {
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : String(e));
        setResult(null);
      }
    },
    [buildExtendScriptConfig]
  );

  /**
   * Organize only selected items
   */
  const organizeSelected = useCallback(async () => {
    try {
      const selectedItems = await evalTS("getSelectedItems");
      if (selectedItems && selectedItems.length > 0) {
        const itemIds = selectedItems.map((item: { id: number }) => item.id);
        await organize(itemIds);
      } else {
        setErrorMessage("No items selected");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [organize]);

  /**
   * Clear result and reset status
   */
  const clearResult = useCallback(() => {
    setStatus("ready");
    setResult(null);
    setErrorMessage(null);
  }, []);

  return {
    status,
    result,
    errorMessage,
    organize,
    organizeSelected,
    clearResult,
  };
}
