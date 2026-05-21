// src/utils/recoverInvalidTags.ts

import { Tag, Task } from '../store/useTaskStore';

/**
 * 修复异常标签数据
 *
 * 修复内容：
 * 1. 父标签不存在的孤儿标签
 * 2. parentId 指向自己的标签
 * 3. level 自动修复
 * 4. 自动创建“已丢失标签”占位父标签
 */
export function recoverInvalidTags(
  tasks: Task[],
  tags: Tag[]
): Tag[] {

  if (!Array.isArray(tags)) {
    return [];
  }

  // =========================
  // 建立索引
  // =========================

  const tagMap = new Map<string, Tag>();

  tags.forEach(tag => {
    tagMap.set(tag.id, tag);
  });

  // =========================
  // 占位标签
  // =========================

  const PLACEHOLDER_ID = 'missing-parent';

  const placeholderTag: Tag = {
    id: PLACEHOLDER_ID,
    name: '已丢失标签',
    parentId: null,
    colorType: 'emoji',
    emoji: '⚠️',
    level: 0,
    order: 999999,
  };

  // =========================
  // 是否已有占位标签
  // =========================

  const hasPlaceholder = tags.some(
    tag => tag.id === PLACEHOLDER_ID
  );

  // =========================
  // 修复标签
  // =========================

  let hasOrphanTag = false;

  const repairedTags: Tag[] = tags.map(tag => {

    // 根标签
    if (!tag.parentId) {
      return {
        ...tag,
        level: 0,
      };
    }

    // 自己指向自己
    if (tag.parentId === tag.id) {

      console.warn(
        `标签 ${tag.name}(${tag.id}) 的 parentId 指向自己，已修复`
      );

      hasOrphanTag = true;

      return {
        ...tag,
        parentId: PLACEHOLDER_ID,
        level: 1,
      };
    }

    // 父标签不存在
    const parentExists = tagMap.has(tag.parentId);

    if (!parentExists) {

      console.warn(
        `标签 ${tag.name}(${tag.id}) 的父标签不存在，已修复`
      );

      hasOrphanTag = true;

      return {
        ...tag,
        parentId: PLACEHOLDER_ID,
        level: 1,
      };
    }

    // 正常标签
    const parentTag = tagMap.get(tag.parentId);

    return {
      ...tag,
      level: (parentTag?.level || 0) + 1,
    };
  });

  // =========================
  // 自动添加占位标签
  // =========================

  if (hasOrphanTag && !hasPlaceholder) {
    repairedTags.push(placeholderTag);
  }

  // =========================
  // 排序
  // =========================

  repairedTags.sort((a, b) => {

    // level 小的优先
    if (a.level !== b.level) {
      return a.level - b.level;
    }

    // order 小的优先
    return a.order - b.order;
  });

  // =========================
  // 日志
  // =========================

  console.log(
    `标签修复完成：${repairedTags.length} 个标签`
  );

  return repairedTags;
}