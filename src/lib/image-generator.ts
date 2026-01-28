import { toPng } from 'html-to-image'

export async function generateSummaryImage(element: HTMLElement): Promise<string> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#1a1a2e',
  })
  return dataUrl
}

export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
