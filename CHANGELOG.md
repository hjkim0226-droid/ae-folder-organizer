# Changelog

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
