// src/utils/tagUtils.test.ts
import { describe, it, expect } from 'vitest';
import { getTagDisplay, getTagColorClass, getTagDisplayName } from './tagUtils';
import type { Tag } from '../store/useTaskStore';

const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 't1',
  name: '测试标签',
  parentId: null,
  colorType: 'emoji',
  emoji: '📁',
  level: 0,
  order: 0,
  ...overrides,
});

describe('getTagDisplay', () => {
  it('返回 emoji（emoji 类型）', () => {
    const tag = makeTag({ colorType: 'emoji', emoji: '💻' });
    expect(getTagDisplay(tag)).toBe('💻');
  });

  it('返回默认 emoji（emoji 但无 emoji 值）', () => {
    const tag = makeTag({ colorType: 'emoji', emoji: undefined });
    expect(getTagDisplay(tag)).toBe('📌');
  });

  it('返回 ●（color 类型）', () => {
    const tag = makeTag({ colorType: 'color', color: 'red' });
    expect(getTagDisplay(tag)).toBe('●');
  });
});

describe('getTagColorClass', () => {
  it('返回正确的颜色类（已知颜色）', () => {
    const tag = makeTag({ colorType: 'color', color: 'red' });
    expect(getTagColorClass(tag)).toContain('bg-red-100');
  });

  it('返回默认颜色类（未知颜色）', () => {
    const tag = makeTag({ colorType: 'color', color: 'unknown' as any });
    expect(getTagColorClass(tag)).toContain('bg-zinc-100');
  });

  it('返回默认类（emoji 类型）', () => {
    const tag = makeTag({ colorType: 'emoji' });
    expect(getTagColorClass(tag)).toContain('bg-zinc-100');
  });

  it('所有 10 种颜色都有类', () => {
    const colors = ['red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'blue', 'indigo', 'purple', 'pink'];
    for (const color of colors) {
      const tag = makeTag({ colorType: 'color', color: color as any });
      expect(getTagColorClass(tag)).not.toBe('');
    }
  });
});

describe('getTagDisplayName', () => {
  const tags: Tag[] = [
    makeTag({ id: 'work', name: '工作', parentId: null }),
    makeTag({ id: 'dev', name: '开发', parentId: 'work', level: 1 }),
    makeTag({ id: 'fe', name: '前端', parentId: 'dev', level: 2 }),
    makeTag({ id: 'personal', name: '个人', parentId: null }),
  ];

  it('返回根标签名称', () => {
    expect(getTagDisplayName('work', tags)).toBe('工作');
  });

  it('返回完整路径名（父子关系）', () => {
    expect(getTagDisplayName('dev', tags)).toBe('工作 / 开发');
  });

  it('返回完整路径名（三级）', () => {
    expect(getTagDisplayName('fe', tags)).toBe('工作 / 开发 / 前端');
  });

  it('返回 tagId 当标签不存在时', () => {
    expect(getTagDisplayName('nonexistent', tags)).toBe('nonexistent');
  });
});
