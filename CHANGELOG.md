# Changelog

## [v1.13.0] - 2026-01-03
### Added
- **전체 기능 문서화** - docs/FEATURES.md 생성
- **개발자 가이드** - docs/DEVELOPMENT.md 생성
- **README 개선** - 문서 링크 및 프로젝트 구조 추가

### Improved
- 문서 구조 정리 및 한국어/영어 혼용 개선

## [v1.12.6] - 2025-12-31
### Fixed
- 버전 동기화 및 안정성 개선

## [v1.11.0] - 2025-12-24
### Added
- **라벨 컬러 시스템** - 폴더/카테고리/서브카테고리별 라벨 컬러 지정
- AE 라벨 컬러 1-16 지원
- 라벨 컬러 우선순위: 서브카테고리 > 카테고리 > 폴더

### Improved
- 설정 파일 버전 5로 업그레이드

## [v1.10.2] - 2025-12-09
### Fixed
- **Main category filter deletion** - Single filter can now be deleted properly
- **Subcategory drag indicator** - Now shows line between items (same as main category)

### Improved
- **Section order** - Batch Rename and Settings moved below Organize button
- **Subcategory validation**:
  - Second+ subcategory shows "Filter Required" when previous has filters
  - Only first subcategory can be "All Items"
  - Prevents multiple "All Items" in same level

## [v1.10.1] - 2025-12-09
### Improved
- **Category layout** - Name on left, checkbox/X button now right-aligned
- **Subcategory drag** - No longer triggers drop overlay
- **Unified filter system** - New tag-based filters for both main categories and subcategories:
  - `.mp4` → Extension filter (blue/purple tag)
  - `prefix:VFX_` → Prefix filter (yellow tag)
  - `fire` → Keyword filter (cyan/yellow tag)

## [v1.10.0] - 2025-12-09
### Added
- **Batch Rename** - New tool for renaming multiple selected items at once
  - Prefix/Suffix addition
  - Find and Replace
  - Real-time preview of changes
  - Undo support via After Effects (Ctrl+Z)

## [v1.1.5] - 2025-12-08
### Fixed
- **Category subfolders now created** - Comps, Footage, Images, Audio subfolders are created inside parent folder
- Nested subfolder support (e.g., Footage/_MP4 when Sub is checked)

## [v1.1.4] - 2025-12-08
### Fixed
- **Classification bug** - Items in organized folders can now be re-organized
- **Drop zone freeze** - Overlay now closes properly on drop
- **Category name position** - Moved to leftmost position

### Improved
- Drag indicator now shows as a blue line between items
- Render folder settings order: Keywords first, Skip option below

## [v1.1.3] - 2025-12-08
### Added
- **Settings section** - New settings menu below Exceptions
- **Delete empty folders** - Auto-delete empty folders after organizing (default: on)
- **Category drag highlight** - Visual indicator when dragging categories

## [v1.1.2] - 2025-12-08
### Fixed
- Drop zone only triggers on external drags (not internal category drags)
- Removed unnecessary folder numbering display
- Category delete changed from checkbox to X button
- System folder always uses 99 numbering

## [v1.1.1] - 2025-12-08
### Added
- **Auto-numbering** - Folders automatically numbered (00_, 01_, 99_)
- **Category drag-drop** - Reorder categories within folders
- **Render drop zone** - Dedicated zone for render comps
- **Render folder protection** - Cannot be deleted
- **Skip organization option** - Exclude items in Render folder

## [v1.1.0] - 2025-12-08
### Added
- Custom folder hierarchy with unlimited folders
- Category-based classification (Comps, Footage, Images, Audio, Solids)
- Exclusive category assignment (one folder per category)
- Exception rules system
- Sequence detection for Footage/Images
- Config persistence with localStorage

## [v1.0.0] - 2025-12-08
### Initial Release
- Basic folder organization (Render, Data)
- Render comp detection by keywords
- Project statistics display
- ZXP packaging support
