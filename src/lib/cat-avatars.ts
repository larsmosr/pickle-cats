const CAT_COUNT = 100;

export function getRandomCatUrl(): string {
  const index = Math.floor(Math.random() * CAT_COUNT) + 1;
  const paddedIndex = String(index).padStart(3, "0");
  return `/cats/cat-${paddedIndex}.jpg`;
}
