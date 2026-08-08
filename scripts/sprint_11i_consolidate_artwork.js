import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

const srcPath = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'qr', 'qr-stand.png');
const destPath = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');

console.log("=== SPRINT 11I ARTWORK CONSOLIDATION ===");
console.log("Source path:", srcPath);
console.log("Dest path:", destPath);

if (!fs.existsSync(srcPath)) {
  console.error("ERROR: Source file does not exist!");
  process.exit(1);
}

// Copy file
fs.copyFileSync(srcPath, destPath);

const srcStat = fs.statSync(srcPath);
const destStat = fs.statSync(destPath);

console.log("Source size:", srcStat.size, "bytes");
console.log("Dest size:", destStat.size, "bytes");

if (srcStat.size === destStat.size) {
  console.log("TASK 1 SUCCESS: public/branding/cheesecorner/qr/qr-stand.png successfully updated to latest artwork!");
} else {
  console.error("TASK 1 ERROR: File sizes do not match!");
}
