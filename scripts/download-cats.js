#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API_URL = 'https://api.thecatapi.com/v1/images/search?limit=10'
const TARGET_COUNT = 100
const OUTPUT_DIR = join(import.meta.dirname, '..', 'public', 'cats')

async function fetchCatImages() {
  const response = await fetch(API_URL)
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  return response.json()
}

async function downloadImage(url, filepath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(filepath, buffer)
}

async function main() {
  // Create output directory if it doesn't exist
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
    console.log(`Created directory: ${OUTPUT_DIR}`)
  }

  const downloadedIds = new Set()
  let batchNumber = 0

  console.log(`Downloading ${TARGET_COUNT} unique cat images...`)

  while (downloadedIds.size < TARGET_COUNT) {
    batchNumber++
    console.log(`\nBatch ${batchNumber}: Fetching images... (${downloadedIds.size}/${TARGET_COUNT} downloaded)`)

    try {
      const images = await fetchCatImages()

      for (const image of images) {
        if (downloadedIds.size >= TARGET_COUNT) break

        // Skip if we already have this image
        if (downloadedIds.has(image.id)) {
          console.log(`  Skipping duplicate: ${image.id}`)
          continue
        }

        // Extract file extension from URL
        const urlPath = new URL(image.url).pathname
        const extension = urlPath.split('.').pop() || 'jpg'
        const filename = `${image.id}.${extension}`
        const filepath = join(OUTPUT_DIR, filename)

        try {
          await downloadImage(image.url, filepath)
          downloadedIds.add(image.id)
          console.log(`  Downloaded: ${filename} (${downloadedIds.size}/${TARGET_COUNT})`)
        } catch (err) {
          console.error(`  Failed to download ${image.id}: ${err.message}`)
        }
      }

      // Small delay between batches to be nice to the API
      if (downloadedIds.size < TARGET_COUNT) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (err) {
      console.error(`Batch ${batchNumber} failed: ${err.message}`)
      // Wait a bit longer before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log(`\nDone! Downloaded ${downloadedIds.size} unique cat images.`)
}

main().catch(console.error)
