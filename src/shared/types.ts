/**
 * AE Folder Organizer - Type Definitions
 */

// ===== Folder Configuration =====

export interface FolderConfig {
    id: string;
    name: string;           // "00_Render"
    order: number;          // 순서 (0, 1, 2...)
    isRenderFolder: boolean;
    renderKeywords?: string[];
    categories?: CategoryConfig[];
}

export interface CategoryConfig {
    type: CategoryType;
    enabled: boolean;
    order?: number;
    createSubfolders: boolean;  // 확장자별 세분 폴더
    detectSequences?: boolean;  // 시퀀스 감지 (Footage/Images만)
    subcategories?: SubcategoryConfig[];  // 소분류 카테고리 레이어
}

export interface SubcategoryConfig {
    id: string;
    name: string;              // 폴더명 (e.g., "VFX")
    order: number;
    filterType: "extension" | "keyword" | "all";
    extensions?: string[];     // filterType === "extension" 일 때
    keywords?: string[];       // filterType === "keyword" 일 때
    keywordRequired?: boolean; // true면 키워드 없으면 분류 안함 (폴더만 생성)
}

export type CategoryType = "Comps" | "Footage" | "Images" | "Audio" | "Solids";

// ===== Exception Rules =====

export interface ExceptionRule {
    id: string;
    type: "nameContains" | "extension";
    pattern: string;           // "_temp" 또는 "fbx"
    targetFolderId: string;    // 이동할 폴더 ID
    targetCategory?: CategoryType;
}

// ===== Organizer Config (전체 설정) =====

export interface OrganizerConfig {
    folders: FolderConfig[];
    exceptions: ExceptionRule[];
}

// ===== Organize Result =====

export interface OrganizeResult {
    success: boolean;
    movedItems: {
        folderId: string;
        folderName: string;
        count: number;
    }[];
    skipped: number;
    error?: string;
}

// ===== Project Stats =====

export interface ProjectStats {
    totalItems: number;
    comps: number;
    footage: number;
    images: number;
    audio: number;
    sequences: number;
    solids: number;
    folders: number;
}

// ===== Default Configuration =====

export const DEFAULT_FOLDERS: FolderConfig[] = [
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
];

export const DEFAULT_CONFIG: OrganizerConfig = {
    folders: DEFAULT_FOLDERS,
    exceptions: [],
};

// ===== Extension Categories =====

export const EXTENSION_CATEGORIES = {
    Video: ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mxf", "prores"],
    Images: ["jpg", "jpeg", "png", "psd", "tif", "tiff", "gif", "bmp", "ai", "eps", "svg"],
    Sequences: ["exr", "dpx", "tga", "cin", "hdr"],  // 시퀀스용 확장자
    Audio: ["mp3", "wav", "aac", "m4a", "aif", "aiff", "ogg", "flac"],
} as const;

// ===== Helper: Generate Folder Name with Numbering =====

export const generateFolderName = (baseName: string, order: number): string => {
    const prefix = order.toString().padStart(2, "0");
    return `${prefix}_${baseName}`;
};

// ===== Helper: Generate Unique ID =====

export const generateId = (): string => {
    return Math.random().toString(36).substring(2, 9);
};
