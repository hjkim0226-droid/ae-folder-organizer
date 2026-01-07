/**
 * Snap Organizer - Internationalization (i18n)
 * Supports English, Korean, Japanese, Chinese (Simplified & Traditional)
 */

export type Language = "en" | "ko" | "ja" | "zh" | "zh-TW";

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

const ja: Translations = {
  // Header
  scanProject: "プロジェクトをスキャン",
  version: "v",

  // Stats
  comps: "コンポ",
  sequences: "シーケンス",
  footage: "フッテージ",
  clips: "クリップ",
  images: "画像",
  audio: "オーディオ",

  // Health Check
  missing: "欠落",
  unused: "未使用",
  isolate: "隔離",

  // Sections
  folderStructure: "フォルダ構造",
  exceptions: "例外ルール",
  batchRename: "一括リネーム",
  settings: "設定",

  // Folder Actions
  addFolder: "フォルダを追加",
  addCategory: "カテゴリを追加",
  addSubcategory: "サブカテゴリを追加",
  addFilter: "フィルタを追加",
  renderKeywords: "レンダーキーワード",

  // Exceptions
  addException: "例外を追加",
  nameContains: "名前に含む",
  extension: "拡張子",

  // Batch Rename
  getSelectedItems: "選択項目を取得",
  prefix: "接頭辞",
  suffix: "接尾辞",
  find: "検索",
  replace: "置換",
  preview: "プレビュー",
  applyRename: "リネーム適用",
  items: "件",
  andMore: "他",

  // Settings
  showSourceOverview: "ソース統計を表示",
  deleteEmptyFolders: "整理後に空フォルダを削除",
  applyLabelColor: "フォルダにラベル色を適用",
  language: "言語",
  resetToDefault: "デフォルトに戻す",
  exportConfig: "設定をエクスポート",
  importConfig: "設定をインポート",

  // Actions
  organizeAll: "すべて整理",
  organizing: "整理中...",

  // Results
  organizationComplete: "整理完了！",
  skipped: "スキップ",
  error: "エラー",

  // Alerts
  movedItems: "{count}件を「{folder}」フォルダに移動しました。",
  undoHint: "(Ctrl+Zで元に戻す)",
  renameSuccess: "{count}件のリネーム完了！",
  configImported: "設定をインポートしました！",

  // Categories
  catComps: "コンポ",
  catFootage: "フッテージ",
  catImages: "画像",
  catAudio: "オーディオ",
  catSolids: "平面",

  // Folder Settings
  keywordsAutoDetect: "キーワード（自動検出）",
  selectedComps: "選択中のコンポ",
  noKeywords: "キーワードなし",
  addKeywordPlaceholder: "キーワード追加（Enter）",
  skipOrganization: "このフォルダ内の項目をスキップ",
  enableLabelColor: "ラベル色",
  sub: "サブ",

  // Isolate Options
  isolateMissing: "欠落フッテージを隔離",
  isolateUnused: "未使用アセットを隔離",
};

const zh: Translations = {
  // Header
  scanProject: "扫描项目",
  version: "v",

  // Stats
  comps: "合成",
  sequences: "序列",
  footage: "素材",
  clips: "剪辑",
  images: "图片",
  audio: "音频",

  // Health Check
  missing: "缺失",
  unused: "未使用",
  isolate: "隔离",

  // Sections
  folderStructure: "文件夹结构",
  exceptions: "例外规则",
  batchRename: "批量重命名",
  settings: "设置",

  // Folder Actions
  addFolder: "添加文件夹",
  addCategory: "添加类别",
  addSubcategory: "添加子类别",
  addFilter: "添加筛选器",
  renderKeywords: "渲染关键词",

  // Exceptions
  addException: "添加例外",
  nameContains: "名称包含",
  extension: "扩展名",

  // Batch Rename
  getSelectedItems: "获取选中项",
  prefix: "前缀",
  suffix: "后缀",
  find: "查找",
  replace: "替换",
  preview: "预览",
  applyRename: "应用重命名",
  items: "项",
  andMore: "等",

  // Settings
  showSourceOverview: "显示素材统计",
  deleteEmptyFolders: "整理后删除空文件夹",
  applyLabelColor: "为文件夹应用标签颜色",
  language: "语言",
  resetToDefault: "恢复默认",
  exportConfig: "导出配置",
  importConfig: "导入配置",

  // Actions
  organizeAll: "整理全部",
  organizing: "整理中...",

  // Results
  organizationComplete: "整理完成！",
  skipped: "已跳过",
  error: "错误",

  // Alerts
  movedItems: "已将 {count} 项移动到「{folder}」文件夹。",
  undoHint: "（Ctrl+Z 撤销）",
  renameSuccess: "已重命名 {count} 项！",
  configImported: "配置导入成功！",

  // Categories
  catComps: "合成",
  catFootage: "素材",
  catImages: "图片",
  catAudio: "音频",
  catSolids: "纯色",

  // Folder Settings
  keywordsAutoDetect: "关键词（自动检测）",
  selectedComps: "选中的合成",
  noKeywords: "无关键词",
  addKeywordPlaceholder: "添加关键词（回车）",
  skipOrganization: "跳过此文件夹内的项目",
  enableLabelColor: "标签颜色",
  sub: "子",

  // Isolate Options
  isolateMissing: "隔离缺失素材",
  isolateUnused: "隔离未使用资源",
};

const zhTW: Translations = {
  // Header
  scanProject: "掃描專案",
  version: "v",

  // Stats
  comps: "合成",
  sequences: "序列",
  footage: "素材",
  clips: "剪輯",
  images: "圖片",
  audio: "音訊",

  // Health Check
  missing: "遺失",
  unused: "未使用",
  isolate: "隔離",

  // Sections
  folderStructure: "資料夾結構",
  exceptions: "例外規則",
  batchRename: "批次重新命名",
  settings: "設定",

  // Folder Actions
  addFolder: "新增資料夾",
  addCategory: "新增類別",
  addSubcategory: "新增子類別",
  addFilter: "新增篩選器",
  renderKeywords: "算圖關鍵字",

  // Exceptions
  addException: "新增例外",
  nameContains: "名稱包含",
  extension: "副檔名",

  // Batch Rename
  getSelectedItems: "取得選取項目",
  prefix: "前綴",
  suffix: "後綴",
  find: "尋找",
  replace: "取代",
  preview: "預覽",
  applyRename: "套用重新命名",
  items: "項",
  andMore: "等",

  // Settings
  showSourceOverview: "顯示素材統計",
  deleteEmptyFolders: "整理後刪除空資料夾",
  applyLabelColor: "為資料夾套用標籤顏色",
  language: "語言",
  resetToDefault: "重設為預設值",
  exportConfig: "匯出設定",
  importConfig: "匯入設定",

  // Actions
  organizeAll: "整理全部",
  organizing: "整理中...",

  // Results
  organizationComplete: "整理完成！",
  skipped: "已略過",
  error: "錯誤",

  // Alerts
  movedItems: "已將 {count} 項移至「{folder}」資料夾。",
  undoHint: "（Ctrl+Z 復原）",
  renameSuccess: "已重新命名 {count} 項！",
  configImported: "設定匯入成功！",

  // Categories
  catComps: "合成",
  catFootage: "素材",
  catImages: "圖片",
  catAudio: "音訊",
  catSolids: "純色",

  // Folder Settings
  keywordsAutoDetect: "關鍵字（自動偵測）",
  selectedComps: "選取的合成",
  noKeywords: "無關鍵字",
  addKeywordPlaceholder: "新增關鍵字（Enter）",
  skipOrganization: "略過此資料夾內的項目",
  enableLabelColor: "標籤顏色",
  sub: "子",

  // Isolate Options
  isolateMissing: "隔離遺失素材",
  isolateUnused: "隔離未使用資源",
};

export const translations: Record<Language, Translations> = {
  en,
  ko,
  ja,
  zh,
  "zh-TW": zhTW,
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
    if (lang.startsWith("ja")) {
      return "ja";
    }
    // Check Traditional Chinese first (zh-TW, zh-HK, zh-Hant)
    if (lang === "zh-TW" || lang === "zh-HK" || lang === "zh-MO" || lang.includes("Hant")) {
      return "zh-TW";
    }
    // Simplified Chinese (zh-CN, zh-SG, zh-Hans, or just zh)
    if (lang.startsWith("zh")) {
      return "zh";
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
