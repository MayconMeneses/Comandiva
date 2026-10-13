import { GRANTABLE_MASTER_AREAS, type MasterPermissionArea } from "@shared/permissions";

export { GRANTABLE_MASTER_AREAS, MASTER_AREA_LABELS, type MasterPermissionArea } from "@shared/permissions";

export function parseMasterPermissions(raw: string | null | undefined): MasterPermissionArea[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((area): area is MasterPermissionArea => GRANTABLE_MASTER_AREAS.includes(area));
  } catch {
    return [];
  }
}

export function serializeMasterPermissions(areas: MasterPermissionArea[] | null | undefined): string | null {
  if (!areas || !areas.length) return null;
  const unique = [...new Set(areas)].filter(area => GRANTABLE_MASTER_AREAS.includes(area));
  return unique.length ? JSON.stringify(unique) : null;
}
