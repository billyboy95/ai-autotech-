export function changedBy<T>(before: T[], after: T[], idOf: (item: T) => string): T[] {
  const prev = new Map(before.map((item) => [idOf(item), JSON.stringify(item)]));
  return after.filter((item) => prev.get(idOf(item)) !== JSON.stringify(item));
}
