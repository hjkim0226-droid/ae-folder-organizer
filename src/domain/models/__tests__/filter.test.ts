/**
 * Filter Model Tests
 */

import {
  matchesFilter,
  matchesAnyFilter,
  getSubcategoryFilters,
  matchesSubcategory,
  findMatchingSubcategory,
  matchesExceptionRule,
  findMatchingException,
  isRenderComp,
  generateOthersFolderName,
  isValidFilterValue,
  normalizeFilterValue,
  parseFilterInput,
} from '../filter';
import type { SubcategoryConfig, SubcategoryFilter, ExceptionRule } from '../../types';

describe('matchesFilter', () => {
  describe('extension filter', () => {
    it('should match exact extension', () => {
      const filter: SubcategoryFilter = { type: 'ext', value: 'mp4' };
      expect(matchesFilter('video.mp4', filter)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const filter: SubcategoryFilter = { type: 'ext', value: 'mp4' };
      expect(matchesFilter('video.MP4', filter)).toBe(true);
    });

    it('should handle extension with dot', () => {
      const filter: SubcategoryFilter = { type: 'ext', value: '.mp4' };
      expect(matchesFilter('video.mp4', filter)).toBe(true);
    });

    it('should not match wrong extension', () => {
      const filter: SubcategoryFilter = { type: 'ext', value: 'mp4' };
      expect(matchesFilter('video.mov', filter)).toBe(false);
    });
  });

  describe('prefix filter', () => {
    it('should match name starting with prefix', () => {
      const filter: SubcategoryFilter = { type: 'prefix', value: 'VFX_' };
      expect(matchesFilter('VFX_explosion.mp4', filter)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const filter: SubcategoryFilter = { type: 'prefix', value: 'vfx_' };
      expect(matchesFilter('VFX_explosion.mp4', filter)).toBe(true);
    });

    it('should not match if prefix not at start', () => {
      const filter: SubcategoryFilter = { type: 'prefix', value: 'VFX' };
      expect(matchesFilter('myVFX_file.mp4', filter)).toBe(false);
    });
  });

  describe('keyword filter', () => {
    it('should match name containing keyword', () => {
      const filter: SubcategoryFilter = { type: 'keyword', value: 'fire' };
      expect(matchesFilter('fire_explosion.mp4', filter)).toBe(true);
    });

    it('should match keyword in middle', () => {
      const filter: SubcategoryFilter = { type: 'keyword', value: 'fire' };
      expect(matchesFilter('vfx_fire_effect.mp4', filter)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const filter: SubcategoryFilter = { type: 'keyword', value: 'fire' };
      expect(matchesFilter('FIRE_effect.mp4', filter)).toBe(true);
    });

    it('should not match if keyword not present', () => {
      const filter: SubcategoryFilter = { type: 'keyword', value: 'fire' };
      expect(matchesFilter('water_effect.mp4', filter)).toBe(false);
    });
  });
});

describe('matchesAnyFilter', () => {
  it('should return true if any filter matches', () => {
    const filters: SubcategoryFilter[] = [
      { type: 'ext', value: 'mp4' },
      { type: 'ext', value: 'mov' },
    ];
    expect(matchesAnyFilter('video.mov', filters)).toBe(true);
  });

  it('should return false if no filter matches', () => {
    const filters: SubcategoryFilter[] = [
      { type: 'ext', value: 'mp4' },
      { type: 'ext', value: 'mov' },
    ];
    expect(matchesAnyFilter('video.avi', filters)).toBe(false);
  });

  it('should return false for empty filters', () => {
    expect(matchesAnyFilter('video.mp4', [])).toBe(false);
  });
});

describe('getSubcategoryFilters', () => {
  it('should return new filters if present', () => {
    const subcat: SubcategoryConfig = {
      id: '1',
      name: 'Test',
      order: 0,
      filters: [{ type: 'ext', value: 'mp4' }],
    };
    const filters = getSubcategoryFilters(subcat);
    expect(filters).toHaveLength(1);
    expect(filters[0].type).toBe('ext');
  });

  it('should convert legacy extensions to filters', () => {
    const subcat: SubcategoryConfig = {
      id: '1',
      name: 'Test',
      order: 0,
      filterType: 'extension',
      extensions: ['mp4', 'mov'],
    };
    const filters = getSubcategoryFilters(subcat);
    expect(filters).toHaveLength(2);
    expect(filters[0]).toEqual({ type: 'ext', value: 'mp4' });
    expect(filters[1]).toEqual({ type: 'ext', value: 'mov' });
  });

  it('should convert legacy keywords to filters', () => {
    const subcat: SubcategoryConfig = {
      id: '1',
      name: 'Test',
      order: 0,
      filterType: 'keyword',
      keywords: ['fire', 'explosion'],
    };
    const filters = getSubcategoryFilters(subcat);
    expect(filters).toHaveLength(2);
    expect(filters[0]).toEqual({ type: 'keyword', value: 'fire' });
    expect(filters[1]).toEqual({ type: 'keyword', value: 'explosion' });
  });

  it('should return empty array for no filters', () => {
    const subcat: SubcategoryConfig = {
      id: '1',
      name: 'Test',
      order: 0,
    };
    const filters = getSubcategoryFilters(subcat);
    expect(filters).toHaveLength(0);
  });
});

describe('matchesSubcategory', () => {
  it('should return true if file matches subcategory filters', () => {
    const subcat: SubcategoryConfig = {
      id: '1',
      name: 'MP4',
      order: 0,
      filters: [{ type: 'ext', value: 'mp4' }],
    };
    expect(matchesSubcategory('video.mp4', subcat)).toBe(true);
  });

  it('should return false if no filters defined', () => {
    const subcat: SubcategoryConfig = {
      id: '1',
      name: 'Empty',
      order: 0,
    };
    expect(matchesSubcategory('video.mp4', subcat)).toBe(false);
  });
});

describe('findMatchingSubcategory', () => {
  const subcategories: SubcategoryConfig[] = [
    {
      id: '1',
      name: 'MP4',
      order: 0,
      filters: [{ type: 'ext', value: 'mp4' }],
    },
    {
      id: '2',
      name: 'VFX',
      order: 1,
      filters: [{ type: 'keyword', value: 'vfx' }],
    },
  ];

  it('should return first matching subcategory', () => {
    const result = findMatchingSubcategory('video.mp4', subcategories);
    expect(result?.id).toBe('1');
  });

  it('should return null if no match', () => {
    const result = findMatchingSubcategory('audio.wav', subcategories);
    expect(result).toBeNull();
  });

  it('should respect order', () => {
    const result = findMatchingSubcategory('vfx_shot.mp4', subcategories);
    // mp4 matches first (order 0)
    expect(result?.id).toBe('1');
  });
});

describe('matchesExceptionRule', () => {
  describe('nameContains rule', () => {
    it('should match if name contains pattern', () => {
      const rule: ExceptionRule = {
        id: '1',
        type: 'nameContains',
        pattern: '_temp',
        targetFolderId: 'trash',
      };
      expect(matchesExceptionRule('file_temp_01.mp4', rule)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const rule: ExceptionRule = {
        id: '1',
        type: 'nameContains',
        pattern: '_TEMP',
        targetFolderId: 'trash',
      };
      expect(matchesExceptionRule('file_temp_01.mp4', rule)).toBe(true);
    });
  });

  describe('extension rule', () => {
    it('should match by extension', () => {
      const rule: ExceptionRule = {
        id: '1',
        type: 'extension',
        pattern: 'fbx',
        targetFolderId: '3d',
      };
      expect(matchesExceptionRule('model.fbx', rule)).toBe(true);
    });

    it('should handle pattern with dot', () => {
      const rule: ExceptionRule = {
        id: '1',
        type: 'extension',
        pattern: '.fbx',
        targetFolderId: '3d',
      };
      expect(matchesExceptionRule('model.fbx', rule)).toBe(true);
    });
  });
});

describe('findMatchingException', () => {
  const exceptions: ExceptionRule[] = [
    { id: '1', type: 'nameContains', pattern: '_temp', targetFolderId: 'trash' },
    { id: '2', type: 'extension', pattern: 'fbx', targetFolderId: '3d' },
  ];

  it('should return first matching exception', () => {
    const result = findMatchingException('file_temp.mp4', exceptions);
    expect(result?.id).toBe('1');
  });

  it('should return null if no match', () => {
    const result = findMatchingException('normal_file.mp4', exceptions);
    expect(result).toBeNull();
  });
});

describe('isRenderComp', () => {
  it('should return true if name contains render keyword', () => {
    expect(isRenderComp('MainComp_render', ['_render', '_final'])).toBe(true);
  });

  it('should return true for any matching keyword', () => {
    expect(isRenderComp('MainComp_final', ['_render', '_final'])).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isRenderComp('MainComp_RENDER', ['_render'])).toBe(true);
  });

  it('should return false for no match', () => {
    expect(isRenderComp('MainComp_draft', ['_render', '_final'])).toBe(false);
  });

  it('should return false for empty keywords', () => {
    expect(isRenderComp('MainComp_render', [])).toBe(false);
  });

  it('should trim keywords', () => {
    expect(isRenderComp('MainComp_render', ['  _render  '])).toBe(true);
  });
});

describe('generateOthersFolderName', () => {
  it('should return _Others', () => {
    expect(generateOthersFolderName()).toBe('_Others');
  });
});

describe('isValidFilterValue', () => {
  it('should return true for non-empty string', () => {
    expect(isValidFilterValue('mp4')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidFilterValue('')).toBe(false);
  });

  it('should return false for whitespace only', () => {
    expect(isValidFilterValue('   ')).toBe(false);
  });
});

describe('normalizeFilterValue', () => {
  it('should trim and lowercase', () => {
    expect(normalizeFilterValue('  MP4  ')).toBe('mp4');
  });
});

describe('parseFilterInput', () => {
  it('should parse comma-separated values', () => {
    const filters = parseFilterInput('mp4, mov, avi', 'ext');
    expect(filters).toHaveLength(3);
    expect(filters[0]).toEqual({ type: 'ext', value: 'mp4' });
  });

  it('should remove dots from extension values', () => {
    const filters = parseFilterInput('.mp4, .mov', 'ext');
    expect(filters[0].value).toBe('mp4');
    expect(filters[1].value).toBe('mov');
  });

  it('should keep dots for keyword type', () => {
    const filters = parseFilterInput('.hidden, temp', 'keyword');
    expect(filters[0].value).toBe('.hidden');
  });

  it('should filter empty values', () => {
    const filters = parseFilterInput('mp4, , mov', 'ext');
    expect(filters).toHaveLength(2);
  });
});
