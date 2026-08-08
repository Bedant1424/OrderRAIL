import fs from 'fs';
import path from 'path';

const qrPath = path.join(process.cwd(), 'public', 'branding', 'cheesecorner', 'qr', 'qr-stand.png');
console.log("Checking file:", qrPath);
console.log("File exists:", fs.existsSync(qrPath));
if (fs.existsSync(qrPath)) {
  const stat = fs.statSync(qrPath);
  console.log("File size:", stat.size, "bytes");
}
