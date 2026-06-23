// src/utils/recoverInvalidTags.test.ts
import { describe, it, expect } from 'vitest';
import { recoverInvalidTags } from './recoverInvalidTags';
import type { Tag, Task } from '../store/useTaskStore';

const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 't1',
  name: '标签',
  parentId: null,
  colorType: 'emoji',
  emoji: '📁',
  level: 0,
  order: 0,
  ...overrides,
});

describe('recoverInvalidTags', () => {
  it('返回空数组当 tags 不是数组', () => {
    expect(recoverInvalidTags([], null as any)).toEqual([]);
  });

  it('正常标签不变', () => {
    const tags = [
      makeTag({ id: 'a', name: 'A', parentId: null, level: 0 }),
      makeTag({ id: 'b', name: 'B', parentId: 'a', level: 1 }),
    ];
    const result = recoverInvalidTags([], tags);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });

  it('修复 self-parentId（指向自己）', () => {
    const tags = [
      makeTag({ id: 'a', name: 'A', parentId: 'a', level: 0 }),
    ];
    const result = recoverInvalidTags([], tags);
    const fixed = result.find(t => t.id === 'a')!;
    expect(fixed.parentId).toBe('missing-parent');
    expect(fixed.level).toBe(1);
  });

  it('修复孤儿标签（父标签不存在）', () => {
    const tags = [
      makeTag({ id: 'a', name: 'A', parentId: 'nonexistent', level: 0 }),
    ];
    const result = recoverInvalidTags([], tags);
    const fixed = result.find(t => t.id === 'a')!;
    expect(fixed.parentId).toBe('missing-parent');
    expect(fixed.level).toBe(1);
  });

  it('有孤儿标签时自动创建已丢失标签', () => {
    const tags = [
      makeTag({ id: 'a', name: 'A', parentId: 'nonexistent' }),
    ];
    const result = recoverInvalidTags([], tags);
    const placeholder = result.find(t => t.id === 'missing-parent');
    expect(placeholder).toBeDefined();
    expect(placeholder!.emoji).toBe('⚠️');
  });

  it('不重复创建已丢失标签', () => {
    const tags = [
      makeTag({ id: 'missing-parent', name: '已丢失标签', parentId: null }),
      makeTag({ id: 'a', name: 'A', parentId: 'nonexistent' }),
    ];
    const result = recoverInvalidTags([], tags);
    const placeholders = result.filter(t => t.id === 'missing-parent');
    expect(placeholders).toHaveLength(1);
  });

  it('按 level 和 order 排序', () => {
    const tags = [
      makeTag({ id: 'b', name: 'B', parentId: null, level: 0, order: 1 }),
      makeTag({ id: 'a', name: 'A', parentId: null, level: 0, order: 0 }),
      makeTag({ id: 'c', name: 'C', parentId: 'a', level: 1, order: 0 }),
    ];
    const result = recoverInvalidTags([], tags);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('c');
  });

  it('修复根标签 level 始终为 0', () => {
    const tags = [
      makeTag({ id: 'a', name: 'A', parentId: null, level: 5 }),
    ];
    const result = recoverInvalidTags([], tags);
    expect(result[0].level).toBe(0);
  });
});
