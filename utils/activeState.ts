export type ActiveLike = {
  active?: boolean | null;
  activo?: boolean | null;
  isActive?: boolean | null;
};

export function resolveActiveState<T extends ActiveLike | null | undefined>(value: T): boolean {
  if (!value) return true;
  if (typeof value.active === "boolean") return value.active;
  if (typeof value.activo === "boolean") return value.activo;
  if (typeof value.isActive === "boolean") return value.isActive;
  return true;
}

export function canonicalizeActiveState<T extends Record<string, any> | null | undefined>(value: T) {
  const active = resolveActiveState(value);
  return {
    active,
    activo: active,
  };
}
