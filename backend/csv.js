// Minimal, safe CSV parser: no eval, size/row limits, quoted fields supported.
const MAX_BYTES = 100 * 1024;
const MAX_ROWS = 500;

function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseInventoryCsv(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('CSV is empty.');
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('CSV is too large (limit 100 KB).');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row.');
  if (lines.length - 1 > MAX_ROWS) throw new Error(`Too many rows (limit ${MAX_ROWS}).`);
  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const col = (names) => header.findIndex((h) => names.includes(h));
  const iStore = col(['storeid', 'store_id', 'store']);
  const iProd = col(['productid', 'product_id', 'product']);
  const iQty = col(['qty', 'stock', 'quantity']);
  if (iStore < 0 || iProd < 0 || iQty < 0) throw new Error('Header must contain storeId, productId and qty columns.');
  return lines.slice(1).map((line, idx) => {
    const cells = parseLine(line);
    return { line: idx + 2, storeId: cells[iStore], productId: cells[iProd], qty: cells[iQty] };
  });
}

module.exports = { parseInventoryCsv };
