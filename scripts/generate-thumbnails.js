#!/usr/bin/env node
/**
 * generate-thumbnails.js
 *
 * Generates small thumbnail versions of product images for use in card grids.
 * Output: assets/images/thumbs/<filename>.jpg  (300px wide, 80% quality JPEG)
 *
 * Usage:  node scripts/generate-thumbnails.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'assets', 'images');
const OUT_DIR = path.join(SRC_DIR, 'thumbs');
const THUMB_WIDTH = 300;
const QUALITY = 80;

async function main() {
    // Ensure output directory exists
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const files = fs.readdirSync(SRC_DIR).filter(f =>
        /\.(jpe?g|png|webp)$/i.test(f)
    );

    console.log(`Processing ${files.length} images → ${OUT_DIR}`);

    let processed = 0;
    let skipped = 0;
    let totalSrcBytes = 0;
    let totalOutBytes = 0;

    for (const file of files) {
        const srcPath = path.join(SRC_DIR, file);
        const outPath = path.join(OUT_DIR, file);

        // Skip if thumbnail already exists and is newer than source
        if (fs.existsSync(outPath)) {
            const srcStat = fs.statSync(srcPath);
            const outStat = fs.statSync(outPath);
            if (outStat.mtimeMs >= srcStat.mtimeMs) {
                skipped++;
                continue;
            }
        }

        const srcBytes = fs.statSync(srcPath).size;
        totalSrcBytes += srcBytes;

        await sharp(srcPath)
            .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
            .jpeg({ quality: QUALITY, mozjpeg: true })
            .toFile(outPath);

        const outBytes = fs.statSync(outPath).size;
        totalOutBytes += outBytes;
        processed++;

        const pct = ((1 - outBytes / srcBytes) * 100).toFixed(0);
        console.log(`  ${file}: ${(srcBytes / 1024).toFixed(0)}KB → ${(outBytes / 1024).toFixed(0)}KB (-${pct}%)`);
    }

    console.log(`\nDone: ${processed} generated, ${skipped} skipped (up-to-date)`);
    if (processed > 0) {
        console.log(`Total: ${(totalSrcBytes / 1024).toFixed(0)}KB → ${(totalOutBytes / 1024).toFixed(0)}KB (-${((1 - totalOutBytes / totalSrcBytes) * 100).toFixed(0)}%)`);
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
