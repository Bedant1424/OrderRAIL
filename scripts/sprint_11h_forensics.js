import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

const publicQrStand = path.join(ROOT_DIR, 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');
const brandingAssetQrStand = path.join(ROOT_DIR, 'branding', 'cheesecorner', 'assets', 'qr', 'qr-stand.png');
const distQrStand = path.join(ROOT_DIR, 'dist', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');

console.log("=== SPRINT 11H TEMPLATE SOURCE FORENSIC AUDIT ===");

function checkFile(label, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[${label}] NOT FOUND at: ${filePath}`);
    return null;
  }
  const stat = fs.statSync(filePath);
  console.log(`[${label}] Size: ${stat.size} bytes | Modified: ${stat.mtime.toISOString()}`);
  return stat;
}

const publicStat = checkFile("public/branding/cheesecorner/qr/qr-stand.png", publicQrStand);
const brandingStat = checkFile("branding/cheesecorner/assets/qr/qr-stand.png", brandingAssetQrStand);
const distStat = checkFile("dist/branding/cheesecorner/qr/qr-stand.png", distQrStand);

// Search for any other qr-stand or template images across the repo
function findFiles(dir, matchStr, list = []) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
      findFiles(fullPath, matchStr, list);
    } else if (entry.isFile() && entry.name.toLowerCase().includes(matchStr.toLowerCase())) {
      list.push({ path: fullPath, size: fs.statSync(fullPath).size, mtime: fs.statSync(fullPath).mtime });
    }
  }
  return list;
}

console.log("\nSearching for all files containing 'qr-stand' or 'qr-template' across workspace:");
const allQrFiles = findFiles(ROOT_DIR, 'qr-stand');
console.log(JSON.stringify(allQrFiles, null, 2));

// Inspect src/branding/cheesecorner/config.ts
const configPath = path.join(ROOT_DIR, 'src', 'branding', 'cheesecorner', 'config.ts');
if (fs.existsSync(configPath)) {
  const configText = fs.readFileSync(configPath, 'utf8');
  console.log("\n--- config.ts snippet ---");
  const lines = configText.split('\n').filter(l => l.includes('qr') || l.includes('Url') || l.includes('Template'));
  console.log(lines.join('\n'));
}

// Inspect src/pages/owner/OwnerTablesPage.tsx
const ownerTablesPath = path.join(ROOT_DIR, 'src', 'pages', 'owner', 'OwnerTablesPage.tsx');
if (fs.existsSync(ownerTablesPath)) {
  const ownerTablesText = fs.readFileSync(ownerTablesPath, 'utf8');
  console.log("\n--- OwnerTablesPage.tsx TEMPLATE_LAYOUT snippet ---");
  const lines = ownerTablesText.split('\n').filter(l => l.includes('TEMPLATE_LAYOUT') || l.includes('templateUrl'));
  console.log(lines.join('\n'));
}
