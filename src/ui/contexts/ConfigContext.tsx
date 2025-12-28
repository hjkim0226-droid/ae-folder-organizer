/**
 * Config Context
 * Manages folder organizer configuration with localStorage persistence
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type {
  VersionedConfig,
  FolderConfig,
  CategoryConfig,
  SubcategoryConfig,
  ExceptionRule,
  CategoryType,
} from "../../domain/types";
import {
  DEFAULT_CONFIG,
  CONFIG_VERSION,
  generateId,
  validateConfig,
  sortFolders,
  recalculateFolderOrders,
} from "../../domain";

// ===== Storage Key =====

const STORAGE_KEY = "ae-folder-organizer-config";

// ===== Context Types =====

interface ConfigContextValue {
  config: VersionedConfig;
  isLoaded: boolean;

  // Folder CRUD
  addFolder: (folder?: Partial<FolderConfig>) => void;
  updateFolder: (folderId: string, updates: Partial<FolderConfig>) => void;
  deleteFolder: (folderId: string) => void;
  moveFolder: (folderId: string, newIndex: number) => void;

  // Category CRUD
  addCategory: (folderId: string, categoryType: CategoryType) => void;
  updateCategory: (
    folderId: string,
    categoryType: CategoryType,
    updates: Partial<CategoryConfig>
  ) => void;
  deleteCategory: (folderId: string, categoryType: CategoryType) => void;
  moveCategory: (
    folderId: string,
    categoryType: CategoryType,
    newIndex: number
  ) => void;

  // Subcategory CRUD
  addSubcategory: (
    folderId: string,
    categoryType: CategoryType,
    subcat?: Partial<SubcategoryConfig>
  ) => void;
  updateSubcategory: (
    folderId: string,
    categoryType: CategoryType,
    subcatId: string,
    updates: Partial<SubcategoryConfig>
  ) => void;
  deleteSubcategory: (
    folderId: string,
    categoryType: CategoryType,
    subcatId: string
  ) => void;
  moveSubcategory: (
    folderId: string,
    categoryType: CategoryType,
    subcatId: string,
    newIndex: number
  ) => void;

  // Exception CRUD
  addException: (exception?: Partial<ExceptionRule>) => void;
  updateException: (exceptionId: string, updates: Partial<ExceptionRule>) => void;
  deleteException: (exceptionId: string) => void;

  // Settings
  updateSettings: (updates: Partial<VersionedConfig["settings"]>) => void;

  // Bulk operations
  setConfig: (config: VersionedConfig) => void;
  resetConfig: () => void;
  exportConfig: () => string;
  importConfig: (jsonString: string) => boolean;
}

// ===== Default Context =====

const defaultContext: ConfigContextValue = {
  config: DEFAULT_CONFIG,
  isLoaded: false,
  addFolder: () => {},
  updateFolder: () => {},
  deleteFolder: () => {},
  moveFolder: () => {},
  addCategory: () => {},
  updateCategory: () => {},
  deleteCategory: () => {},
  moveCategory: () => {},
  addSubcategory: () => {},
  updateSubcategory: () => {},
  deleteSubcategory: () => {},
  moveSubcategory: () => {},
  addException: () => {},
  updateException: () => {},
  deleteException: () => {},
  updateSettings: () => {},
  setConfig: () => {},
  resetConfig: () => {},
  exportConfig: () => "",
  importConfig: () => false,
};

// ===== Context =====

const ConfigContext = createContext<ConfigContextValue>(defaultContext);

// ===== Provider Component =====

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfigState] = useState<VersionedConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (validateConfig(parsed)) {
          // Migrate if needed
          if (!parsed.version || parsed.version < CONFIG_VERSION) {
            parsed.version = CONFIG_VERSION;
          }
          setConfigState(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save config to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {
        console.error("Failed to save config:", e);
      }
    }
  }, [config, isLoaded]);

  // ===== Folder Operations =====

  const addFolder = useCallback((folder?: Partial<FolderConfig>) => {
    setConfigState((prev) => {
      const newFolder: FolderConfig = {
        id: generateId(),
        name: folder?.name || "New Folder",
        order: prev.folders.length,
        isRenderFolder: folder?.isRenderFolder || false,
        categories: folder?.categories || [],
        ...folder,
      };
      return {
        ...prev,
        folders: [...prev.folders, newFolder],
      };
    });
  }, []);

  const updateFolder = useCallback(
    (folderId: string, updates: Partial<FolderConfig>) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) =>
          f.id === folderId ? { ...f, ...updates } : f
        ),
      }));
    },
    []
  );

  const deleteFolder = useCallback((folderId: string) => {
    setConfigState((prev) => ({
      ...prev,
      folders: recalculateFolderOrders(
        prev.folders.filter((f) => f.id !== folderId)
      ),
    }));
  }, []);

  const moveFolder = useCallback((folderId: string, newIndex: number) => {
    setConfigState((prev) => {
      const folders = [...prev.folders];
      const currentIndex = folders.findIndex((f) => f.id === folderId);
      if (currentIndex === -1) return prev;

      const [folder] = folders.splice(currentIndex, 1);
      folders.splice(newIndex, 0, folder);

      return {
        ...prev,
        folders: recalculateFolderOrders(folders),
      };
    });
  }, []);

  // ===== Category Operations =====

  const addCategory = useCallback(
    (folderId: string, categoryType: CategoryType) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          const categories = f.categories || [];
          const newCategory: CategoryConfig = {
            type: categoryType,
            enabled: true,
            order: categories.length,
            createSubfolders: false,
          };
          return {
            ...f,
            categories: [...categories, newCategory],
          };
        }),
      }));
    },
    []
  );

  const updateCategory = useCallback(
    (
      folderId: string,
      categoryType: CategoryType,
      updates: Partial<CategoryConfig>
    ) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          return {
            ...f,
            categories: f.categories?.map((c) =>
              c.type === categoryType ? { ...c, ...updates } : c
            ),
          };
        }),
      }));
    },
    []
  );

  const deleteCategory = useCallback(
    (folderId: string, categoryType: CategoryType) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          return {
            ...f,
            categories: f.categories?.filter((c) => c.type !== categoryType),
          };
        }),
      }));
    },
    []
  );

  const moveCategory = useCallback(
    (folderId: string, categoryType: CategoryType, newIndex: number) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId || !f.categories) return f;
          const categories = [...f.categories];
          const currentIndex = categories.findIndex(
            (c) => c.type === categoryType
          );
          if (currentIndex === -1) return f;

          const [category] = categories.splice(currentIndex, 1);
          categories.splice(newIndex, 0, category);

          return {
            ...f,
            categories: categories.map((c, i) => ({ ...c, order: i })),
          };
        }),
      }));
    },
    []
  );

  // ===== Subcategory Operations =====

  const addSubcategory = useCallback(
    (
      folderId: string,
      categoryType: CategoryType,
      subcat?: Partial<SubcategoryConfig>
    ) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          return {
            ...f,
            categories: f.categories?.map((c) => {
              if (c.type !== categoryType) return c;
              const subcategories = c.subcategories || [];
              const newSubcat: SubcategoryConfig = {
                id: generateId(),
                name: subcat?.name || "New Subcategory",
                order: subcategories.length,
                ...subcat,
              };
              return {
                ...c,
                subcategories: [...subcategories, newSubcat],
              };
            }),
          };
        }),
      }));
    },
    []
  );

  const updateSubcategory = useCallback(
    (
      folderId: string,
      categoryType: CategoryType,
      subcatId: string,
      updates: Partial<SubcategoryConfig>
    ) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          return {
            ...f,
            categories: f.categories?.map((c) => {
              if (c.type !== categoryType) return c;
              return {
                ...c,
                subcategories: c.subcategories?.map((s) =>
                  s.id === subcatId ? { ...s, ...updates } : s
                ),
              };
            }),
          };
        }),
      }));
    },
    []
  );

  const deleteSubcategory = useCallback(
    (folderId: string, categoryType: CategoryType, subcatId: string) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          return {
            ...f,
            categories: f.categories?.map((c) => {
              if (c.type !== categoryType) return c;
              return {
                ...c,
                subcategories: c.subcategories?.filter((s) => s.id !== subcatId),
              };
            }),
          };
        }),
      }));
    },
    []
  );

  const moveSubcategory = useCallback(
    (
      folderId: string,
      categoryType: CategoryType,
      subcatId: string,
      newIndex: number
    ) => {
      setConfigState((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => {
          if (f.id !== folderId) return f;
          return {
            ...f,
            categories: f.categories?.map((c) => {
              if (c.type !== categoryType || !c.subcategories) return c;
              const subcats = [...c.subcategories];
              const currentIndex = subcats.findIndex((s) => s.id === subcatId);
              if (currentIndex === -1) return c;

              const [subcat] = subcats.splice(currentIndex, 1);
              subcats.splice(newIndex, 0, subcat);

              return {
                ...c,
                subcategories: subcats.map((s, i) => ({ ...s, order: i })),
              };
            }),
          };
        }),
      }));
    },
    []
  );

  // ===== Exception Operations =====

  const addException = useCallback((exception?: Partial<ExceptionRule>) => {
    setConfigState((prev) => {
      const newException: ExceptionRule = {
        id: generateId(),
        type: exception?.type || "nameContains",
        pattern: exception?.pattern || "",
        targetFolderId: exception?.targetFolderId || prev.folders[0]?.id || "",
        ...exception,
      };
      return {
        ...prev,
        exceptions: [...prev.exceptions, newException],
      };
    });
  }, []);

  const updateException = useCallback(
    (exceptionId: string, updates: Partial<ExceptionRule>) => {
      setConfigState((prev) => ({
        ...prev,
        exceptions: prev.exceptions.map((e) =>
          e.id === exceptionId ? { ...e, ...updates } : e
        ),
      }));
    },
    []
  );

  const deleteException = useCallback((exceptionId: string) => {
    setConfigState((prev) => ({
      ...prev,
      exceptions: prev.exceptions.filter((e) => e.id !== exceptionId),
    }));
  }, []);

  // ===== Settings Operations =====

  const updateSettings = useCallback(
    (updates: Partial<VersionedConfig["settings"]>) => {
      setConfigState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...updates },
      }));
    },
    []
  );

  // ===== Bulk Operations =====

  const setConfig = useCallback((newConfig: VersionedConfig) => {
    setConfigState(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_CONFIG);
  }, []);

  const exportConfig = useCallback((): string => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfig = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (validateConfig(parsed)) {
        setConfigState(parsed);
        return true;
      }
    } catch (e) {
      console.error("Failed to import config:", e);
    }
    return false;
  }, []);

  const value: ConfigContextValue = {
    config,
    isLoaded,
    addFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    addCategory,
    updateCategory,
    deleteCategory,
    moveCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    moveSubcategory,
    addException,
    updateException,
    deleteException,
    updateSettings,
    setConfig,
    resetConfig,
    exportConfig,
    importConfig,
  };

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

// ===== Hook =====

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return context;
}

// ===== Exports =====

export { ConfigContext };
export type { ConfigContextValue };
