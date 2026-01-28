const CAT_COUNT = 100;

export function getRandomCatUrl(excludeUrls: string[] = []): string {
  const excludeSet = new Set(excludeUrls);

  // Build list of available indices
  const available: number[] = [];
  for (let i = 1; i <= CAT_COUNT; i++) {
    const url = `/cats/cat-${String(i).padStart(3, "0")}.jpg`;
    if (!excludeSet.has(url)) {
      available.push(i);
    }
  }

  // Fallback to any if all are taken
  const index =
    available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : Math.floor(Math.random() * CAT_COUNT) + 1;

  return `/cats/cat-${String(index).padStart(3, "0")}.jpg`;
}
