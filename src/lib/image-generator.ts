import { toPng } from 'html-to-image'

// Pre-fetch and convert images to data URLs to avoid CORS issues
async function inlineImages(element: HTMLElement): Promise<void> {
  const images = element.querySelectorAll('img')

  await Promise.all(
    Array.from(images).map(async (img) => {
      const src = img.src
      if (!src || src.startsWith('data:')) return

      try {
        // Use fetch with no-cors mode won't work for reading blob, so we try direct fetch
        const response = await fetch(src, { mode: 'cors' })
        if (!response.ok) throw new Error('Fetch failed')

        const blob = await response.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        img.src = dataUrl
      } catch (error) {
        // If CORS fetch fails, try creating a canvas to draw the image
        // This works if the image is already loaded in the browser
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || 100
          canvas.height = img.naturalHeight || 100
          const ctx = canvas.getContext('2d')
          if (ctx && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0)
            img.src = canvas.toDataURL('image/png')
          }
        } catch {
          // If canvas also fails, the image will be skipped
          console.warn('Failed to inline image:', src)
        }
      }
    })
  )
}

export async function generateSummaryImage(element: HTMLElement): Promise<string> {
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = 'absolute'
  clone.style.left = '-9999px'
  document.body.appendChild(clone)

  try {
    // Inline images to avoid CORS issues
    await inlineImages(clone)

    // Wait a bit for images to settle
    await new Promise((resolve) => setTimeout(resolve, 100))

    const dataUrl = await toPng(clone, {
      pixelRatio: 2,
      backgroundColor: '#E7E2FE',
      cacheBust: true,
      skipFonts: true,
      includeQueryParams: true,
    })
    return dataUrl
  } finally {
    document.body.removeChild(clone)
  }
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
