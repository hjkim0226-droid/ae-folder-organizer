/**
 * Config Model Tests
 */

import {
  generateId,
  validateConfig,
  getDisplayFolderName,
  sortFolders,
  recalculateFolderOrders,
  trimStr,
  getFileExtension,
} from '../config';
import type { FolderConfig, VersionedConfig } from '../../types';

describe('generateId', () => {
  it('should generate a 7-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(7);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should only contain alphanumeric characters', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

describe('validateConfig', () => {
  it('should return false for null', () => {
    expect(validateConfig(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(validateConfig(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(validateConfig('string')).toBe(false);
    expect(validateConfig(123)).toBe(false);
  });

  it('should return false for missing folders', () => {
    expect(validateConfig({ exceptions: [], settings: {} })).toBe(false);
  });

  it('should return false for missing exceptions', () => {
    expect(validateConfig({ folders: [], settings: {} })).toBe(false);
  });

  it('should return false for missing settings', () => {
    expect(validateConfig({ folders: [], exceptions: [] })).toBe(false);
  });

  it('should return false for invalid folder structure', () => {
    const config = {
      folders: [{ notId: 'test', notName: 'test' }],
      exceptions: [],
      settings: {},
    };
    expect(validateConfig(config)).toBe(false);
  });

  it('should return true for valid config', () => {
    const config: VersionedConfig = {
      folders: [
        { id: 'test', name: 'Test', order: 0, isRenderFolder: false },
      ],
      exceptions: [],
      settings: {
        deleteEmptyFolders: true,
        showStats: true,
        applyFolderLabelColor: false,
      },
    };
    expect(validateConfig(config)).toBe(true);
  });
});

describe('getDisplayFolderName', () => {
  it('should prefix with order number', () => {
    const folder: FolderConfig = {
      id: 'source',
      name: 'Source',
      order: 1,
      isRenderFolder: false,
    };
    expect(getDisplayFolderName(folder, 1)).toBe('01_Source');
  });

  it('should pad single digit with zero', () => {
    const folder: FolderConfig = {
      id: 'render',
      name: 'Render',
      order: 0,
      isRenderFolder: true,
    };
    expect(getDisplayFolderName(folder, 0)).toBe('00_Render');
  });

  it('should always use 99 for system folder', () => {
    const folder: FolderConfig = {
      id: 'system',
      name: 'System',
      order: 99,
      isRenderFolder: false,
    };
    expect(getDisplayFolderName(folder, 2)).toBe('99_System');
  });
});

describe('sortFolders', () => {
  it('should sort by order', () => {
    const folders: FolderConfig[] = [
      { id: 'b', name: 'B', order: 2, isRenderFolder: false },
      { id: 'a', name: 'A', order: 0, isRenderFolder: false },
      { id: 'c', name: 'C', order: 1, isRenderFolder: false },
    ];
    const sorted = sortFolders(folders);
    expect(sorted.map(f => f.id)).toEqual(['a', 'c', 'b']);
  });

  it('should always put system folder last', () => {
    const folders: FolderConfig[] = [
      { id: 'system', name: 'System', order: 99, isRenderFolder: false },
      { id: 'source', name: 'Source', order: 1, isRenderFolder: false },
      { id: 'render', name: 'Render', order: 0, isRenderFolder: true },
    ];
    const sorted = sortFolders(folders);
    expect(sorted[sorted.length - 1].id).toBe('system');
  });

  it('should not mutate original array', () => {
    const folders: FolderConfig[] = [
      { id: 'b', name: 'B', order: 1, isRenderFolder: false },
      { id: 'a', name: 'A', order: 0, isRenderFolder: false },
    ];
    const original = [...folders];
    sortFolders(folders);
    expect(folders).toEqual(original);
  });
});

describe('recalculateFolderOrders', () => {
  it('should assign sequential orders', () => {
    const folders: FolderConfig[] = [
      { id: 'a', name: 'A', order: 5, isRenderFolder: false },
      { id: 'b', name: 'B', order: 10, isRenderFolder: false },
    ];
    const result = recalculateFolderOrders(folders);
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
  });

  it('should set system folder order to 99', () => {
    const folders: FolderConfig[] = [
      { id: 'a', name: 'A', order: 0, isRenderFolder: false },
      { id: 'system', name: 'System', order: 1, isRenderFolder: false },
    ];
    const result = recalculateFolderOrders(folders);
    expect(result[1].order).toBe(99);
  });
});

describe('trimStr', () => {
  it('should trim leading whitespace', () => {
    expect(trimStr('  hello')).toBe('hello');
  });

  it('should trim trailing whitespace', () => {
    expect(trimStr('hello  ')).toBe('hello');
  });

  it('should trim both ends', () => {
    expect(trimStr('  hello  ')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(trimStr('')).toBe('');
  });

  it('should handle tabs and newlines', () => {
    expect(trimStr('\t\nhello\n\t')).toBe('hello');
  });
});

describe('getFileExtension', () => {
  it('should extract simple extension', () => {
    expect(getFileExtension('video.mp4')).toBe('mp4');
  });

  it('should return lowercase extension', () => {
    expect(getFileExtension('video.MP4')).toBe('mp4');
  });

  it('should return empty string for no extension', () => {
    expect(getFileExtension('noextension')).toBe('');
  });

  it('should handle multiple dots', () => {
    expect(getFileExtension('file.name.ext.jpg')).toBe('jpg');
  });

  it('should handle sequence patterns with brackets', () => {
    expect(getFileExtension('frame.[####].exr')).toBe('exr');
  });

  it('should handle sequence patterns with numbers', () => {
    expect(getFileExtension('frame.0001.exr')).toBe('exr');
  });
});
