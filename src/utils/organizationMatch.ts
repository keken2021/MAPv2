/** True when two organization names are the same after trimming and ignoring case. Use it to decide who a person is (ADR 0037). */
export function sameOrganization(a?: string, b?: string): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  return Boolean(left) && left === right;
}
