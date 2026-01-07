/**
 * Snap Organizer - Internationalization (i18n)
 * Supports English and Korean
 */

export type Language = "en" | "ko";

export interface Translations {
  // Header
  scanProject: string;
  version: string;

  // Stats
  comps: string;
  sequences: string;
  footage: string;
  clips: string;
  images: string;
  audio: string;

  // Health Check
  missing: string;
  unused: string;
  isolate: string;

  // Sections
  folderStructure: string;
  exceptions: string;
  batchRename: string;
  settings: string;

  // Folder Actions
  addFolder: string;
  addCategory: string;
  addSubcategory: string;
  addFilter: string;
  renderKeywords: string;

  // Exceptions
  addException: string;
  nameContains: string;
  extension: string;

  // Batch Rename
  getSelectedItems: string;
  prefix: string;
  suffix: string;
  find: string;
  replace: string;
  preview: string;
  applyRename: string;
  items: string;
  andMore: string;

  // Settings
  showSourceOverview: string;
  deleteEmptyFolders: string;
  applyLabelColor: string;
  language: string;
  resetToDefault: string;
  exportConfig: string;
  importConfig: string;

  // Actions
  organizeAll: string;
  organizing: string;

  // Results
  organizationComplete: string;
  skipped: string;
  error: string;

  // Alerts
  movedItems: string;
  undoHint: string;
  renameSuccess: string;
  configImported: string;

  // Categories
  catComps: string;
  catFootage: string;
  catImages: string;
  catAudio: string;
  catSolids: string;

  // Folder Settings
  keywordsAutoDetect: string;
  selectedComps: string;
  noKeywords: string;
  addKeywordPlaceholder: string;
  skipOrganization: string;
  enableLabelColor: string;
  sub: string;

  // Isolate Options
  isolateMissing: string;
  isolateUnused: string;
}

const en: Translations = {
  // Header
  scanProject: "Scan Project",
  version: "v",

  // Stats
  comps: "Comps",
  sequences: "Sequences",
  footage: "Footage",
  clips: "Clips",
  images: "Images",
  audio: "Audio",

  // Health Check
  missing: "Missing",
  unused: "Unused",
  isolate: "Isolate",

  // Sections
  folderStructure: "Folder Structure",
  exceptions: "Exceptions",
  batchRename: "Batch Rename",
  settings: "Settings",

  // Folder Actions
  addFolder: "Add Folder",
  addCategory: "Add Category",
  addSubcategory: "Add Subcategory",
  addFilter: "Add Filter",
  renderKeywords: "Render Keywords",

  // Exceptions
  addException: "Add Exception",
  nameContains: "Name contains",
  extension: "Extension",

  // Batch Rename
  getSelectedItems: "Get Selected Items",
  prefix: "Prefix",
  suffix: "Suffix",
  find: "Find",
  replace: "Replace",
  preview: "Preview",
  applyRename: "Apply Rename",
  items: "items",
  andMore: "and more",

  // Settings
  showSourceOverview: "Show source overview",
  deleteEmptyFolders: "Delete empty folders after organizing",
  applyLabelColor: "Apply label color to folders",
  language: "Language",
  resetToDefault: "Reset to Default",
  exportConfig: "Export Config",
  importConfig: "Import Config",

  // Actions
  organizeAll: "ORGANIZE ALL",
  organizing: "Organizing...",

  // Results
  organizationComplete: "Organization Complete!",
  skipped: "Skipped",
  error: "Error",

  // Alerts
  movedItems: "Moved {count} items to \"{folder}\" folder.",
  undoHint: "(Ctrl+Z to undo)",
  renameSuccess: "Renamed {count} items!",
  configImported: "Config imported successfully!",

  // Categories
  catComps: "Comps",
  catFootage: "Footage",
  catImages: "Images",
  catAudio: "Audio",
  catSolids: "Solids",

  // Folder Settings
  keywordsAutoDetect: "Keywords (auto-detect)",
  selectedComps: "Selected Comps",
  noKeywords: "No keywords",
  addKeywordPlaceholder: "Add keyword (Enter to add)",
  skipOrganization: "Skip organization for items in this folder",
  enableLabelColor: "Label Color",
  sub: "Sub",

  // Isolate Options
  isolateMissing: "Isolate Missing Footage",
  isolateUnused: "Isolate Unused Assets",
};

const ko: Translations = {
  // Header
  scanProject: "프로젝트 스캔",
  version: "v",

  // Stats
  comps: "컴프",
  sequences: "시퀀스",
  footage: "푸티지",
  clips: "클립",
  images: "이미지",
  audio: "오디오",

  // Health Check
  missing: "누락",
  unused: "미사용",
  isolate: "격리",

  // Sections
  folderStructure: "폴더 구조",
  exceptions: "예외 규칙",
  batchRename: "일괄 이름 변경",
  settings: "설정",

  // Folder Actions
  addFolder: "폴더 추가",
  addCategory: "카테고리 추가",
  addSubcategory: "서브카테고리 추가",
  addFilter: "필터 추가",
  renderKeywords: "렌더 키워드",

  // Exceptions
  addException: "예외 추가",
  nameContains: "이름 포함",
  extension: "확장자",

  // Batch Rename
  getSelectedItems: "선택 항목 가져오기",
  prefix: "접두사",
  suffix: "접미사",
  find: "찾기",
  replace: "바꾸기",
  preview: "미리보기",
  applyRename: "이름 변경 적용",
  items: "개",
  andMore: "외",

  // Settings
  showSourceOverview: "소스 통계 표시",
  deleteEmptyFolders: "정리 후 빈 폴더 삭제",
  applyLabelColor: "폴더에 라벨 색상 적용",
  language: "언어",
  resetToDefault: "기본값으로 초기화",
  exportConfig: "설정 내보내기",
  importConfig: "설정 가져오기",

  // Actions
  organizeAll: "폴더 정리",
  organizing: "정리 중...",

  // Results
  organizationComplete: "정리 완료!",
  skipped: "건너뜀",
  error: "오류",

  // Alerts
  movedItems: "{count}개 항목을 \"{folder}\" 폴더로 이동했습니다.",
  undoHint: "(Ctrl+Z로 실행 취소)",
  renameSuccess: "{count}개 항목 이름 변경 완료!",
  configImported: "설정을 가져왔습니다!",

  // Categories
  catComps: "컴프",
  catFootage: "푸티지",
  catImages: "이미지",
  catAudio: "오디오",
  catSolids: "솔리드",

  // Folder Settings
  keywordsAutoDetect: "키워드 (자동 감지)",
  selectedComps: "선택된 컴프",
  noKeywords: "키워드 없음",
  addKeywordPlaceholder: "키워드 추가 (Enter)",
  skipOrganization: "이 폴더 내 항목 정리 건너뛰기",
  enableLabelColor: "라벨 색상",
  sub: "서브",

  // Isolate Options
  isolateMissing: "미싱 푸티지 격리",
  isolateUnused: "미사용 에셋 격리",
};

export const translations: Record<Language, Translations> = {
  en,
  ko,
};

/**
 * Detect system language
 */
export function detectLanguage(): Language {
  if (typeof navigator !== "undefined") {
    const lang = navigator.language || (navigator as any).userLanguage || "en";
    if (lang.startsWith("ko")) {
      return "ko";
    }
  }
  return "en";
}

/**
 * Get translation with interpolation
 */
export function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}
