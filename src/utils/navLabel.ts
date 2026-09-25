/** 分頁與它的子頁面都算「在這個分頁」（/my-exams/sources/:id 也顯示「自製考卷」）。 */
export function isNavItemActive(to: string, pathname: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function findNavLabel(
  items: readonly { to: string; label: string }[],
  pathname: string,
): string | undefined {
  return items.find((item) => isNavItemActive(item.to, pathname))?.label;
}
