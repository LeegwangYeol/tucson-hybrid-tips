/**
 * Virtual Headless Browser Environment Simulator for E2E Testing
 * Provides localStorage mock with error injection, event simulation, and reference oracles.
 */

class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.disabled = false;
    this.throwOnAccess = false;
    this.quotaExceeded = false;
  }

  getItem(key) {
    if (this.disabled || this.throwOnAccess) {
      throw new Error('SecurityError: The operation is insecure.');
    }
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    if (this.disabled || this.throwOnAccess) {
      throw new Error('SecurityError: The operation is insecure.');
    }
    if (this.quotaExceeded) {
      const err = new Error('QuotaExceededError: DOMException');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    if (this.disabled || this.throwOnAccess) {
      throw new Error('SecurityError: The operation is insecure.');
    }
    this.store.delete(String(key));
  }

  clear() {
    if (this.disabled || this.throwOnAccess) {
      throw new Error('SecurityError: The operation is insecure.');
    }
    this.store.clear();
  }

  get length() {
    return this.store.size;
  }
}

/**
 * Reference Oracle for Tailgate Height Simulator
 * Authoritative specification logic from PROJECT.md & survey_explorer_web_ux
 */
class SimulatorOracle {
  static PRESETS = {
    full: 2150,     // 완전 열림 (~2150mm)
    level3: 1920,   // 3단계 (~1920mm)
    level2: 1780,   // 2단계 (~1780mm)
    level1: 1620    // 1단계 (~1620mm)
  };

  static calculate(ceilingHeightCm, tailgateHeightMm) {
    const numCeiling = Number(ceilingHeightCm);
    const numTailgate = Number(tailgateHeightMm);

    // Fail-safe boundary: if input is invalid or NaN, default to DANGER
    if (!Number.isFinite(numCeiling) || !Number.isFinite(numTailgate)) {
      return {
        ceilingMm: 0,
        tailgateHeightMm: 0,
        clearance: -Infinity,
        status: 'COLLISION_DANGER',
        badgeType: 'danger'
      };
    }

    const ceilingMm = Math.round(numCeiling * 10);
    const clearance = ceilingMm - Math.round(numTailgate);

    let status = 'SAFE';
    let badgeType = 'safe';

    if (clearance < 0) {
      status = 'COLLISION_DANGER';
      badgeType = 'danger';
    } else if (clearance < 150) {
      status = 'WARNING';
      badgeType = 'warning';
    }

    return {
      ceilingMm,
      tailgateHeightMm: Math.round(numTailgate),
      clearance,
      status,
      badgeType
    };
  }
}

/**
 * Reference Oracle for 7-Step Prevention Checklist
 * Authoritative specification logic from PROJECT.md & survey_explorer_web_ux
 */
class ChecklistOracle {
  static STORAGE_KEY = 'tucson_trunk_prevention_checklist_v1';
  static TOTAL_ITEMS = 7;

  static calculateScore(checkedIndices) {
    const safeArray = Array.isArray(checkedIndices) ? checkedIndices : [];
    const validIndices = Array.from(new Set(safeArray)).filter(
      idx => typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < ChecklistOracle.TOTAL_ITEMS
    );
    const count = validIndices.length;
    const percentage = Math.round((count / ChecklistOracle.TOTAL_ITEMS) * 100);

    let level = 'HIGH_RISK';
    let title = '고위험군 (파손 위험도 90%)';
    let icon = '🚨';
    let color = 'var(--nline-red)';

    if (count >= 6) {
      level = 'SAFE';
      title = '철벽 방어 완료 (100% 안전)';
      icon = '🛡️';
      color = 'var(--success-emerald)';
    } else if (count >= 3) {
      level = 'WARNING';
      title = '주의 등급 (보완 필요)';
      icon = '⚠️';
      color = 'var(--warning-amber)';
    }

    return {
      count,
      total: ChecklistOracle.TOTAL_ITEMS,
      percentage,
      level,
      title,
      icon,
      color,
      checkedIndices: validIndices.sort((a, b) => a - b)
    };
  }

  static serialize(checkedIndices) {
    return JSON.stringify({
      version: 1,
      checked: checkedIndices,
      timestamp: Date.now()
    });
  }

  static deserialize(jsonString) {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.checked)) return parsed.checked;
      return [];
    } catch {
      return [];
    }
  }
}

module.exports = {
  MockLocalStorage,
  SimulatorOracle,
  ChecklistOracle
};
