import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';

export interface ChallanPdfItem {
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceSnapshot: Prisma.Decimal | string | number;
  quantity: number;
}

export interface ChallanPdfCustomer {
  name: string;
  mobile: string;
  email: string | null;
  businessName: string;
  gstNumber: string | null;
  address: string;
}

export interface ChallanPdfInput {
  challanNumber: string;
  status: string;
  totalQuantity: number;
  createdAt: Date;
  createdBy: { name: string };
  customer: ChallanPdfCustomer;
  items: ChallanPdfItem[];
}

const MARGIN = 48;
const COLORS = {
  ink: '#1a1a1a',
  muted: '#4a4a4a',
  line: '#c8c8c8',
  accent: '#1f3d2f',
  tableHeader: '#f3f3f3',
};

const COL = {
  no: 28,
  product: 170,
  sku: 90,
  qty: 50,
  price: 70,
  total: 70,
};

function money(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function formatMoney(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function challanPdfFilename(challanNumber: string): string {
  const safe = challanNumber.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `sales-challan-${safe}.pdf`;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Builds a professional A4 Sales Challan PDF from historical line snapshots.
 * Returns a Buffer so the controller can set headers and stream without temp files.
 */
export async function buildChallanPdfBuffer(challan: ChallanPdfInput): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    // Keep streams uncompressed so automated tests can assert snapshot text.
    compress: false,
    info: {
      Title: `Sales Challan ${challan.challanNumber}`,
      Author: 'Mini ERP + CRM Operations Portal',
      Subject: 'Sales Challan / Delivery Document',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentWidth = doc.page.width - MARGIN * 2;
  const tableWidth = COL.no + COL.product + COL.sku + COL.qty + COL.price + COL.total;
  const bottomLimit = () => doc.page.height - MARGIN - 40;

  let cursorY = MARGIN;

  function newPageWithContinuation(): void {
    doc.addPage();
    cursorY = MARGIN;
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font('Helvetica')
      .text(`Sales Challan ${challan.challanNumber} (continued)`, MARGIN, cursorY, {
        width: contentWidth,
      });
    cursorY = doc.y + 8;
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(MARGIN, cursorY)
      .lineTo(MARGIN + contentWidth, cursorY)
      .stroke();
    cursorY += 14;
  }

  function ensureSpace(needed: number): void {
    if (cursorY + needed > bottomLimit()) {
      newPageWithContinuation();
    }
  }

  function drawTableHeader(): void {
    ensureSpace(28);
    doc.rect(MARGIN, cursorY, tableWidth, 22).fill(COLORS.tableHeader);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(8);
    const textY = cursorY + 7;
    let x = MARGIN + 4;
    doc.text('#', x, textY, { width: COL.no - 6 });
    x += COL.no;
    doc.text('Product', x, textY, { width: COL.product - 6 });
    x += COL.product;
    doc.text('SKU', x, textY, { width: COL.sku - 6 });
    x += COL.sku;
    doc.text('Qty', x, textY, { width: COL.qty - 6, align: 'right' });
    x += COL.qty;
    doc.text('Unit Price', x, textY, { width: COL.price - 6, align: 'right' });
    x += COL.price;
    doc.text('Line Total', x, textY, { width: COL.total - 6, align: 'right' });
    cursorY += 22;
  }

  // —— HEADER ——
  doc
    .fillColor(COLORS.accent)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('MINI ERP & CRM', MARGIN, cursorY, { width: contentWidth });
  cursorY = doc.y + 2;
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9)
    .text('Operations Portal', MARGIN, cursorY, { width: contentWidth });
  cursorY = doc.y + 14;
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('SALES CHALLAN', MARGIN, cursorY, { width: contentWidth });
  cursorY = doc.y + 2;
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9)
    .text('Sales Challan / Delivery Document', MARGIN, cursorY, { width: contentWidth });
  cursorY = doc.y + 12;
  doc
    .strokeColor(COLORS.accent)
    .lineWidth(1.25)
    .moveTo(MARGIN, cursorY)
    .lineTo(MARGIN + contentWidth, cursorY)
    .stroke();
  cursorY += 16;

  // —— DOCUMENT INFO ——
  ensureSpace(70);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Document', MARGIN, cursorY);
  cursorY = doc.y + 8;

  const colGap = 24;
  const colWidth = (contentWidth - colGap) / 2;
  const infoTop = cursorY;
  let leftY = infoTop;
  let rightY = infoTop;

  for (const [label, value] of [
    ['Challan Number', challan.challanNumber],
    ['Date', formatDate(challan.createdAt)],
  ] as const) {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, MARGIN, leftY);
    leftY = doc.y + 1;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text(value, MARGIN, leftY, {
      width: colWidth,
    });
    leftY = doc.y + 8;
  }

  for (const [label, value] of [
    ['Status', challan.status],
    ['Created By', challan.createdBy.name],
  ] as const) {
    const x = MARGIN + colWidth + colGap;
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, x, rightY);
    rightY = doc.y + 1;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text(value, x, rightY, {
      width: colWidth,
    });
    rightY = doc.y + 8;
  }
  cursorY = Math.max(leftY, rightY) + 4;

  // —— CUSTOMER ——
  ensureSpace(80);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(MARGIN, cursorY)
    .lineTo(MARGIN + contentWidth, cursorY)
    .stroke();
  cursorY += 12;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Customer', MARGIN, cursorY);
  cursorY = doc.y + 8;

  const customerLines: Array<[string, string]> = [['Name', challan.customer.name]];
  if (challan.customer.businessName.trim()) {
    customerLines.push(['Business', challan.customer.businessName.trim()]);
  }
  customerLines.push(['Mobile', challan.customer.mobile]);
  if (challan.customer.email?.trim()) {
    customerLines.push(['Email', challan.customer.email.trim()]);
  }
  if (challan.customer.gstNumber?.trim()) {
    customerLines.push(['GST Number', challan.customer.gstNumber.trim()]);
  }
  if (challan.customer.address.trim()) {
    customerLines.push(['Address', challan.customer.address.trim()]);
  }

  for (const [label, value] of customerLines) {
    ensureSpace(28);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, MARGIN, cursorY);
    cursorY = doc.y + 1;
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10).text(value, MARGIN, cursorY, {
      width: contentWidth,
    });
    cursorY = doc.y + 6;
  }

  // —— ITEMS ——
  cursorY += 6;
  ensureSpace(40);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(MARGIN, cursorY)
    .lineTo(MARGIN + contentWidth, cursorY)
    .stroke();
  cursorY += 12;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Line items', MARGIN, cursorY);
  cursorY = doc.y + 10;

  drawTableHeader();

  let subtotal = new Prisma.Decimal(0);
  let summedQty = 0;

  if (challan.items.length === 0) {
    ensureSpace(30);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text('No line items on this challan.', MARGIN + 4, cursorY + 8, {
        width: tableWidth - 8,
      });
    cursorY += 28;
  } else {
    challan.items.forEach((item, index) => {
      const unit = money(item.unitPriceSnapshot);
      const lineTotal = unit.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);
      summedQty += item.quantity;

      const productText = truncate(item.productNameSnapshot, 90);
      const skuText = truncate(item.skuSnapshot, 32);
      doc.font('Helvetica').fontSize(9);
      const productHeight = Math.min(
        48,
        Math.max(
          12,
          doc.heightOfString(productText, {
            width: COL.product - 8,
          }),
        ),
      );
      const rowHeight = Math.max(22, productHeight + 10);

      if (cursorY + rowHeight > bottomLimit()) {
        newPageWithContinuation();
        drawTableHeader();
      }

      const rowTop = cursorY;
      doc
        .strokeColor(COLORS.line)
        .lineWidth(0.4)
        .moveTo(MARGIN, rowTop + rowHeight)
        .lineTo(MARGIN + tableWidth, rowTop + rowHeight)
        .stroke();

      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9);
      const textY = rowTop + 6;
      let x = MARGIN + 4;
      doc.text(String(index + 1), x, textY, { width: COL.no - 6 });
      x += COL.no;
      doc.text(productText, x, textY, { width: COL.product - 8 });
      x += COL.product;
      doc.text(skuText, x, textY, { width: COL.sku - 6 });
      x += COL.sku;
      doc.text(String(item.quantity), x, textY, { width: COL.qty - 6, align: 'right' });
      x += COL.qty;
      doc.text(formatMoney(unit), x, textY, { width: COL.price - 6, align: 'right' });
      x += COL.price;
      doc.text(formatMoney(lineTotal), x, textY, { width: COL.total - 6, align: 'right' });

      cursorY = rowTop + rowHeight;
    });
  }

  // —— TOTALS ——
  ensureSpace(70);
  cursorY += 10;
  const totalsX = MARGIN + tableWidth - 200;
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .moveTo(totalsX, cursorY)
    .lineTo(MARGIN + tableWidth, cursorY)
    .stroke();
  cursorY += 10;

  const displayQty = challan.totalQuantity || summedQty;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Total quantity', totalsX, cursorY, {
    width: 110,
  });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(String(displayQty), totalsX + 110, cursorY, { width: 90, align: 'right' });
  cursorY = doc.y + 8;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Total amount', totalsX, cursorY, {
    width: 110,
  });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(formatMoney(subtotal), totalsX + 110, cursorY, { width: 90, align: 'right' });

  // Stamp footers on every buffered page before ending the document.
  // Temporarily clear margins: PDFKit auto-paginates when y exceeds page.maxY(),
  // so drawing in the bottom margin would otherwise spawn empty trailing pages.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const page = doc.page;
    const previousMargins = { ...page.margins };
    page.margins = { top: 0, left: 0, bottom: 0, right: 0 };

    const footerY = page.height - 28;
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(MARGIN, footerY - 10)
      .lineTo(MARGIN + contentWidth, footerY - 10)
      .stroke();
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font('Helvetica')
      .text('Generated from Mini ERP + CRM Operations Portal', MARGIN, footerY, {
        width: contentWidth * 0.68,
        align: 'left',
        lineBreak: false,
      });
    doc.text(`Page ${i + 1} of ${range.count}`, MARGIN + contentWidth * 0.68, footerY, {
      width: contentWidth * 0.32,
      align: 'right',
      lineBreak: false,
    });

    page.margins = previousMargins;
  }

  doc.end();

  const buffer = await done;
  return {
    buffer,
    filename: challanPdfFilename(challan.challanNumber),
  };
}
