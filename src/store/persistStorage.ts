// src/store/persistStorage.ts — 按用户隔离的 localStorage key
// 每个用户的数据存储在 funflow-storage-<userId> 下，互不干扰

let _uid: string | null = null;

// 模块加载时尝试从 Supabase session 中同步读取 userId
// 这样在 Zustand persist 初始化前就能确定用户范围
try {
  const authKey = Object.keys(localStorage).find(
    (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
  );
  if (authKey) {
    const raw = JSON.parse(localStorage.getItem(authKey)!);
    _uid = raw?.user?.id ?? null;
  }
} catch {
  // 未登录或 token 解析失败 → _uid 保持 null
}

export function setPersistUserId(id: string | null) {
  _uid = id;
}

export function getPersistUserId() {
  return _uid;
}

function key(base: string) {
  return _uid ? `${base}-${_uid}` : base;
}

/**
 * Zustand persist 自定义 storage 适配器。
 *
 * 自动追加 userId 后缀实现数据隔离，同时兼容旧版无后缀 key：
 * 首次访问用户 scoped key 时若不存在，会从旧 key 读取并迁移。
 */
export const scopedStorage: Storage = {
  getItem(name) {
    const k = key(name);
    let v = localStorage.getItem(k);

    // 懒迁移：scoped key 不存在时，从旧 unscoped key 读并写入 scoped key
    if (v === null && _uid) {
      const legacy = localStorage.getItem(name);
      if (legacy !== null) {
        localStorage.setItem(k, legacy);
        v = legacy;
        console.log(`📦 迁移持久化数据: ${name} → ${k}`);
      }
    }

    return v;
  },

  setItem(name, value) {
    localStorage.setItem(key(name), value);
  },

  removeItem(name) {
    localStorage.removeItem(key(name));
  },

  clear() {
    // 不清除，避免影响其它用户或系统 key
  },

  get length() {
    return localStorage.length;
  },

  key(index) {
    return localStorage.key(index);
  },
};
