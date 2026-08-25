export function minorToDisplay(value: number) {
  return (value / 100).toFixed(2);
}

export function majorToMinor(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function formatProductType(value: string) {
  return value.replace(/_/g, " ");
}
