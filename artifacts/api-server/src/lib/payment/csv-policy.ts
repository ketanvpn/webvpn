const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r]/u;

/** Prevent exported user/provider text from becoming a spreadsheet formula. */
export const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  const safe = SPREADSHEET_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return /[,"\r\n]/u.test(safe)
    ? `"${safe.replace(/"/gu, '""')}"`
    : safe;
};
