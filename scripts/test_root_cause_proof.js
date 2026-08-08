import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'pages', 'owner', 'OwnerTablesPage.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const hasTemplateLayout = content.includes('const TEMPLATE_LAYOUT =');
const hasQrArtworkLayoutDef = content.includes('const QR_ARTWORK_LAYOUT =');
const usesQrArtworkLayoutSrc = content.includes('templateImg.src = QR_ARTWORK_LAYOUT.templateUrl');

console.log("=== SPRINT 11E REGRESSION ROOT CAUSE ANALYSIS ===");
console.log("const TEMPLATE_LAYOUT defined:", hasTemplateLayout);
console.log("const QR_ARTWORK_LAYOUT defined:", hasQrArtworkLayoutDef);
console.log("templateImg.src uses QR_ARTWORK_LAYOUT.templateUrl:", usesQrArtworkLayoutSrc);

if (hasTemplateLayout && !hasQrArtworkLayoutDef && usesQrArtworkLayoutSrc) {
  console.log("ROOT CAUSE CONFIRMED: Mismatched identifier reference!");
  console.log("The layout object was renamed to TEMPLATE_LAYOUT in Sprint 11D, but line 120 still assigns templateImg.src = QR_ARTWORK_LAYOUT.templateUrl.");
  console.log("Since QR_ARTWORK_LAYOUT is undefined, accessing .templateUrl throws an uncaught TypeError, leaving the artwork Promise permanently unfulfilled.");
}
