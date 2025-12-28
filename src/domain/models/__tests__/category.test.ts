/**
 * Category Model Tests
 */

import {
  getAssignedCategories,
  findDuplicateKeywords,
  determineCategory,
  determineCategoryFromFilename,
  sortCategories,
  recalculateCategoryOrders,
  isValidCategoryType,
} from '../category';
import type { FolderConfig, CategoryConfig } from '../../types';

describe('getAssignedCategories', () => {
  it('should return empty map for no folders', () => {
    const result = getAssignedCategories([]);
    expect(result.size).toBe(0);
  });

  it('should map enabled categories to folder IDs', () => {
    const folders: FolderConfig[] = [
      {
        id: 'source',
        name: 'Source',
        order: 0,
        isRenderFolder: false,
        categories: [
          { type: 'Footage', enabled: true, order: 0, createSubfolders: false },
          { type: 'Audio', enabled: true, order: 1, createSubfolders: false },
        ],
      },
    ];
    const result = getAssignedCategories(folders);
    expect(result.get('Footage')).toBe('source');
    expect(result.get('Audio')).toBe('source');
  });

  it('should skip disabled categories', () => {
    const folders: FolderConfig[] = [
      {
        id: 'source',
        name: 'Source',
        order: 0,
        isRenderFolder: false,
        categories: [
          { type: 'Footage', enabled: false, order: 0, createSubfolders: false },
        ],
      },
    ];
    const result = getAssignedCategories(folders);
    expect(result.has('Footage')).toBe(false);
  });

  it('should skip categories with filters (allow duplicates)', () => {
    const folders: FolderConfig[] = [
      {
        id: 'source',
        name: 'Source',
        order: 0,
        isRenderFolder: false,
        categories: [
          {
            type: 'Footage',
            enabled: true,
            order: 0,
            createSubfolders: false,
            filters: [{ type: 'ext', value: 'mp4' }],
          },
        ],
      },
    ];
    const result = getAssignedCategories(folders);
    expect(result.has('Footage')).toBe(false);
  });
});

describe('findDuplicateKeywords', () => {
  it('should return empty map for no categories', () => {
    const result = findDuplicateKeywords(undefined);
    expect(result.size).toBe(0);
  });

  it('should return empty map for unique keywords', () => {
    const categories: CategoryConfig[] = [
      { type: 'Footage', enabled: true, order: 0, createSubfolders: false, keywords: ['video'] },
      { type: 'Audio', enabled: true, order: 1, createSubfolders: false, keywords: ['audio'] },
    ];
    const result = findDuplicateKeywords(categories);
    expect(result.size).toBe(0);
  });

  it('should detect duplicate keywords', () => {
    const categories: CategoryConfig[] = [
      { type: 'Footage', enabled: true, order: 0, createSubfolders: false, keywords: ['vfx'] },
      { type: 'Images', enabled: true, order: 1, createSubfolders: false, keywords: ['vfx'] },
    ];
    const result = findDuplicateKeywords(categories);
    expect(result.get('Footage')).toContain('vfx');
    expect(result.get('Images')).toContain('vfx');
  });

  it('should be case-insensitive', () => {
    const categories: CategoryConfig[] = [
      { type: 'Footage', enabled: true, order: 0, createSubfolders: false, keywords: ['VFX'] },
      { type: 'Images', enabled: true, order: 1, createSubfolders: false, keywords: ['vfx'] },
    ];
    const result = findDuplicateKeywords(categories);
    expect(result.size).toBe(2);
  });
});

describe('determineCategory', () => {
  describe('video extensions', () => {
    it('should return Footage for mp4', () => {
      expect(determineCategory('mp4')).toBe('Footage');
    });

    it('should return Footage for mov', () => {
      expect(determineCategory('mov')).toBe('Footage');
    });

    it('should return Footage for avi', () => {
      expect(determineCategory('avi')).toBe('Footage');
    });

    it('should return Footage for mxf', () => {
      expect(determineCategory('mxf')).toBe('Footage');
    });
  });

  describe('audio extensions', () => {
    it('should return Audio for mp3', () => {
      expect(determineCategory('mp3')).toBe('Audio');
    });

    it('should return Audio for wav', () => {
      expect(determineCategory('wav')).toBe('Audio');
    });

    it('should return Audio for aac', () => {
      expect(determineCategory('aac')).toBe('Audio');
    });
  });

  describe('image extensions', () => {
    it('should return Images for jpg', () => {
      expect(determineCategory('jpg')).toBe('Images');
    });

    it('should return Images for png', () => {
      expect(determineCategory('png')).toBe('Images');
    });

    it('should return Images for psd', () => {
      expect(determineCategory('psd')).toBe('Images');
    });
  });

  describe('sequence handling', () => {
    it('should return Footage for sequences', () => {
      expect(determineCategory('exr', { isSequence: true })).toBe('Footage');
    });

    it('should return Footage for png sequences', () => {
      expect(determineCategory('png', { isSequence: true })).toBe('Footage');
    });

    it('should return Images for single exr', () => {
      expect(determineCategory('exr', { isSequence: false })).toBe('Images');
    });
  });

  describe('unknown extensions', () => {
    it('should return null for unknown extension', () => {
      expect(determineCategory('xyz')).toBe(null);
    });

    it('should return null for empty extension', () => {
      expect(determineCategory('')).toBe(null);
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase extensions', () => {
      expect(determineCategory('MP4')).toBe('Footage');
    });

    it('should handle mixed case', () => {
      expect(determineCategory('Mp4')).toBe('Footage');
    });
  });
});

describe('determineCategoryFromFilename', () => {
  it('should extract extension and determine category', () => {
    expect(determineCategoryFromFilename('video.mp4')).toBe('Footage');
  });

  it('should handle complex filenames', () => {
    expect(determineCategoryFromFilename('my.video.file.mp4')).toBe('Footage');
  });

  it('should handle sequence flag', () => {
    expect(determineCategoryFromFilename('frame.0001.exr', { isSequence: true })).toBe('Footage');
  });
});

describe('sortCategories', () => {
  it('should sort by order', () => {
    const categories: CategoryConfig[] = [
      { type: 'Audio', enabled: true, order: 2, createSubfolders: false },
      { type: 'Footage', enabled: true, order: 0, createSubfolders: false },
      { type: 'Images', enabled: true, order: 1, createSubfolders: false },
    ];
    const sorted = sortCategories(categories);
    expect(sorted.map(c => c.type)).toEqual(['Footage', 'Images', 'Audio']);
  });

  it('should not mutate original array', () => {
    const categories: CategoryConfig[] = [
      { type: 'Audio', enabled: true, order: 1, createSubfolders: false },
      { type: 'Footage', enabled: true, order: 0, createSubfolders: false },
    ];
    const original = [...categories];
    sortCategories(categories);
    expect(categories).toEqual(original);
  });
});

describe('recalculateCategoryOrders', () => {
  it('should assign sequential orders', () => {
    const categories: CategoryConfig[] = [
      { type: 'Audio', enabled: true, order: 5, createSubfolders: false },
      { type: 'Footage', enabled: true, order: 10, createSubfolders: false },
    ];
    const result = recalculateCategoryOrders(categories);
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
  });
});

describe('isValidCategoryType', () => {
  it('should return true for valid types', () => {
    expect(isValidCategoryType('Comps')).toBe(true);
    expect(isValidCategoryType('Footage')).toBe(true);
    expect(isValidCategoryType('Images')).toBe(true);
    expect(isValidCategoryType('Audio')).toBe(true);
    expect(isValidCategoryType('Solids')).toBe(true);
  });

  it('should return false for invalid types', () => {
    expect(isValidCategoryType('Invalid')).toBe(false);
    expect(isValidCategoryType('')).toBe(false);
    expect(isValidCategoryType('comps')).toBe(false); // case-sensitive
  });
});
