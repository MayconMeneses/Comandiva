import { GRANTABLE_STAFF_AREAS, type StaffPermissionArea } from "@shared/permissions";

export { GRANTABLE_STAFF_AREAS, STAFF_AREA_LABELS, type StaffPermissionArea } from "@shared/permissions";

export function parseStaffPermissions(raw: string | null | undefined): StaffPermissionArea[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((area): area is StaffPermissionArea => GRANTABLE_STAFF_AREAS.includes(area));
  } catch {
    return [];
  }
}

export function serializeStaffPermissions(areas: StaffPermissionArea[] | null | undefined): string | null {
  if (!areas || !areas.length) return null;
  const unique = [...new Set(areas)].filter(area => GRANTABLE_STAFF_AREAS.includes(area));
  return unique.length ? JSON.stringify(unique) : null;
}
