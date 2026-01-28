import { toPng } from 'html-to-image'

export async function generateSummaryImage(element: HTMLElement): Promise<string> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#e0d8f0',
    cacheBust: true,
  })
  return dataUrl
}

export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function shareImage(dataUrl: string, filename: string, title: string, text: string): Promise<boolean> {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const file = new File([blob], filename, { type: 'image/png' })

    // Check if Web Share API with files is available
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title,
        text,
        files: [file],
      })
      return true
    }

    // Fallback: download
    downloadImage(dataUrl, filename)
    return false
  } catch (error) {
    // User cancelled or error - fallback to download
    if ((error as Error).name !== 'AbortError') {
      downloadImage(dataUrl, filename)
    }
    return false
  }
}
