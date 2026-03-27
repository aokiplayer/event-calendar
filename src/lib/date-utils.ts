/**
 * "YYYY-MM-DD" → その日の UTC 00:00:00 の ISO 文字列
 * new Date("2026-03-15") はローカルTZで解釈されるため、
 * UTC+9 では "2026-03-14T15:00:00.000Z" になってしまう。
 * これを避けるために明示的に UTC として扱う。
 */
export function dateInputToUTC(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

/**
 * ISO 文字列 → "YYYY-MM-DD"（UTC日付）
 */
export function utcToDateInput(isoStr: string): string {
  return isoStr.slice(0, 10);
}

/**
 * FullCalendar の endStr（exclusive）→ inclusive な "YYYY-MM-DD"
 * FullCalendar は end を exclusive で返すので1日引く
 */
export function exclusiveToInclusiveDate(isoStr: string): string {
  const d = new Date(isoStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * DB の endDate（inclusive）→ FullCalendar 用の exclusive ISO 文字列
 */
export function inclusiveToExclusiveDate(isoStr: string): string {
  const d = new Date(isoStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
