#!/usr/bin/env node

import sharp from "sharp";
import { readdir, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const INPUT_DIR = join(import.meta.dirname, "..", "public", "cats");
const OUTPUT_DIR = join(import.meta.dirname, "..", "public", "cats-compressed");
const MAX_SIZE = 200; // Max dimension in pixels
const QUALITY = 80; // JPEG quality

async function main() {
  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const files = await readdir(INPUT_DIR);
  const imageFiles = files.filter(
    (f) =>
      !f.startsWith(".") &&
      (f.endsWith(".jpg") ||
        f.endsWith(".jpeg") ||
        f.endsWith(".png") ||
        f.endsWith(".gif"))
  );

  console.log(`Processing ${imageFiles.length} images...`);

  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const inputPath = join(INPUT_DIR, file);
    const outputFilename = `cat-${String(i + 1).padStart(3, "0")}.jpg`;
    const outputPath = join(OUTPUT_DIR, outputFilename);

    try {
      await sharp(inputPath, { animated: false }) // Don't animate gifs
        .resize(MAX_SIZE, MAX_SIZE, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: QUALITY })
        .toFile(outputPath);

      processed++;
      console.log(`  ${file} -> ${outputFilename}`);
    } catch (err) {
      console.error(`  Failed to process ${file}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nProcessed: ${processed}, Skipped: ${skipped}`);

  // Get new total size
  const { stdout } = await import("node:child_process").then((cp) =>
    new Promise((resolve, reject) => {
      cp.exec(`du -sh "${OUTPUT_DIR}"`, (err, stdout) => {
        if (err) reject(err);
        else resolve({ stdout });
      });
    })
  );
  console.log(`New size: ${stdout.trim()}`);

  // Replace old directory with new
  console.log("\nReplacing old cats directory...");
  await rm(INPUT_DIR, { recursive: true });
  const { rename } = await import("node:fs/promises");
  await rename(OUTPUT_DIR, INPUT_DIR);

  console.log("Done! Images compressed and renamed.");
}

main().catch(console.error);
