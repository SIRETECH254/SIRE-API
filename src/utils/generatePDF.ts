import PDFDocument from 'pdfkit';
import { WritableStreamBuffer } from 'stream-buffers';

type PDFKitDocument = InstanceType<typeof PDFDocument>;

const THEME_COLOR = '#7b1c1c';
const TEXT_COLOR = '#222222';
const MUTED_COLOR = '#666666';
const LIGHT_ROW = '#f5f5f5';
const BORDER_COLOR = '#d9d9d9';

const formatMoney = (value: number, forceNegative: boolean = false): string => {
    const amount = Number(value || 0);
    const formatted = `$${Math.abs(amount).toFixed(2)}`;
    return forceNegative || amount < 0 ? `-${formatted}` : formatted;
};

const formatDate = (value?: any): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString();
};

const drawSectionTitle = (doc: PDFKitDocument, text: string, x: number, y: number, width: number): number => {
    doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(THEME_COLOR)
        .text(text, x, y, { width });
    return y + 14;
};

const drawLines = (doc: PDFKitDocument, lines: string[], x: number, y: number, width: number): number => {
    let currentY = y;
    lines.filter(Boolean).forEach((line) => {
        doc.font('Helvetica')
            .fontSize(10)
            .fillColor(TEXT_COLOR)
            .text(line, x, currentY, { width });
        currentY += 14;
    });
    return currentY;
};

const drawKeyValueRows = (
    doc: PDFKitDocument,
    rows: Array<{ label: string; value: string }>,
    x: number,
    y: number,
    width: number
): number => {
    const labelWidth = Math.round(width * 0.55);
    const valueWidth = width - labelWidth;
    let currentY = y;

    rows.forEach((row) => {
        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(THEME_COLOR)
            .text(row.label, x, currentY, { width: labelWidth });
        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(TEXT_COLOR)
            .text(row.value, x + labelWidth, currentY, { width: valueWidth, align: 'right' });
        currentY += 14;
    });

    return currentY;
};

const drawItemsTable = (
    doc: PDFKitDocument,
    items: any[],
    startY: number,
    contentX: number,
    contentWidth: number
): number => {
    const headerHeight = 24;
    const rowHeight = 22;
    const qtyWidth = 50;
    const unitWidth = 90;
    const amountWidth = 90;
    const descWidth = contentWidth - qtyWidth - unitWidth - amountWidth;

    const columns = [
        { key: 'qty', label: 'QTY', width: qtyWidth, align: 'right' as const },
        { key: 'desc', label: 'Description', width: descWidth, align: 'left' as const },
        { key: 'unit', label: 'Unit Price', width: unitWidth, align: 'right' as const },
        { key: 'amount', label: 'Amount', width: amountWidth, align: 'right' as const }
    ];

    const drawHeader = (y: number) => {
        doc.rect(contentX, y, contentWidth, headerHeight).fill(THEME_COLOR);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
        let x = contentX;
        columns.forEach((col) => {
            doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: col.align });
            x += col.width;
        });
    };

    drawHeader(startY);
    let rowY = startY + headerHeight;

    if (items && items.length > 0) {
        items.forEach((item: any, index: number) => {
            if (rowY + rowHeight > doc.page.height - 90) {
                doc.addPage();
                rowY = 50;
                drawHeader(rowY);
                rowY += headerHeight;
            }

            if (index % 2 === 0) {
                doc.rect(contentX, rowY, contentWidth, rowHeight).fill(LIGHT_ROW);
            }

            const quantity = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const total = Number(item.total || quantity * unitPrice);

            doc.font('Helvetica').fontSize(9).fillColor(TEXT_COLOR);
            let x = contentX;
            doc.text(quantity.toFixed(0), x + 4, rowY + 6, { width: qtyWidth - 8, align: 'right' });
            x += qtyWidth;
            doc.text(item.description || 'N/A', x + 4, rowY + 6, { width: descWidth - 8 });
            x += descWidth;
            doc.text(formatMoney(unitPrice), x + 4, rowY + 6, { width: unitWidth - 8, align: 'right' });
            x += unitWidth;
            doc.text(formatMoney(total), x + 4, rowY + 6, { width: amountWidth - 8, align: 'right' });

            rowY += rowHeight;
        });
    }

    return rowY;
};

const drawTotals = (
    doc: PDFKitDocument,
    startY: number,
    contentX: number,
    contentWidth: number,
    totals: {
        subtotal: number;
        tax?: number;
        discount?: number;
        total: number;
    }
): number => {
    const blockWidth = 200;
    const labelWidth = 110;
    const valueWidth = blockWidth - labelWidth;
    const totalsX = contentX + contentWidth - blockWidth;
    let currentY = startY;

    doc.moveTo(totalsX, currentY - 6)
        .lineTo(totalsX + blockWidth, currentY - 6)
        .strokeColor(BORDER_COLOR)
        .stroke();

    const rows: Array<{ label: string; value: string }> = [
        { label: 'Subtotal', value: formatMoney(totals.subtotal) }
    ];
    if (totals.tax && totals.tax > 0) {
        rows.push({ label: 'Tax', value: formatMoney(totals.tax) });
    }
    if (totals.discount && totals.discount > 0) {
        rows.push({ label: 'Discount', value: formatMoney(totals.discount, true) });
    }

    rows.forEach((row) => {
        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(TEXT_COLOR)
            .text(row.label, totalsX, currentY, { width: labelWidth });
        doc.text(row.value, totalsX + labelWidth, currentY, { width: valueWidth, align: 'right' });
        currentY += 14;
    });

    doc.moveTo(totalsX, currentY + 2)
        .lineTo(totalsX + blockWidth, currentY + 2)
        .strokeColor(BORDER_COLOR)
        .stroke();

    currentY += 8;

    doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(THEME_COLOR)
        .text('Total', totalsX, currentY, { width: labelWidth });
    doc.text(formatMoney(totals.total), totalsX + labelWidth, currentY, {
        width: valueWidth,
        align: 'right'
    });

    return currentY + 18;
};

const renderDocument = (
    doc: PDFKitDocument,
    options: {
        title: 'QUOTATION' | 'INVOICE';
        numberLabel: string;
        numberValue: string;
        dateLabel: string;
        dateValue: string;
        dueLabel: string;
        dueValue: string;
        client?: any;
        projectTitle?: string;
        projectNumber?: string;
        quotationNumber?: string;
        items?: any[];
        subtotal: number;
        tax?: number;
        discount?: number;
        total: number;
        notes?: string;
    }
): void => {
    const margin = 50;
    const contentWidth = doc.page.width - margin * 2;
    const columnGap = 20;
    const columnWidth = (contentWidth - columnGap) / 2;
    const leftX = margin;
    const rightX = margin + columnWidth + columnGap;

    const headerY = 40;
    doc.font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(TEXT_COLOR)
        .text('SIRE Tech', leftX, headerY, { width: columnWidth });
    doc.font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED_COLOR)
        .text('Business Management Solutions', leftX, headerY + 18, { width: columnWidth });

    doc.font('Helvetica-Bold')
        .fontSize(26)
        .fillColor(THEME_COLOR)
        .text(options.title, rightX, headerY, { width: columnWidth, align: 'right' });

    const metaY = headerY + 60;
    const metaRows = [
        { label: options.numberLabel, value: options.numberValue },
        { label: options.dateLabel, value: options.dateValue },
        { label: options.dueLabel, value: options.dueValue }
    ];

    let rightY = drawKeyValueRows(doc, metaRows, rightX, metaY, columnWidth);

    if (options.projectTitle) {
        rightY += 10;
        rightY = drawSectionTitle(doc, 'Project', rightX, rightY, columnWidth);
        rightY = drawLines(doc, [options.projectTitle], rightX, rightY, columnWidth);
        if (options.projectNumber) {
            rightY = drawLines(doc, [`Project #: ${options.projectNumber}`], rightX, rightY, columnWidth);
        }
        if (options.quotationNumber) {
            rightY = drawLines(doc, [`Quotation #: ${options.quotationNumber}`], rightX, rightY, columnWidth);
        }
    }

    let leftY = metaY;
    leftY = drawSectionTitle(doc, 'Bill To', leftX, leftY, columnWidth);
    if (options.client) {
        const client = options.client;
        const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
        const addressParts: string[] = [];
        if (client.address) addressParts.push(client.address);
        if (client.city) addressParts.push(client.city);
        if (client.country) addressParts.push(client.country);
        const lines = [
            name,
            client.company || '',
            client.email || '',
            client.phone || '',
            addressParts.join(', ')
        ];
        leftY = drawLines(doc, lines, leftX, leftY, columnWidth);
    }

    const tableStartY = Math.max(leftY, rightY) + 20;
    const tableEndY = drawItemsTable(doc, options.items || [], tableStartY, margin, contentWidth);

    const totalsEndY = drawTotals(doc, tableEndY + 14, margin, contentWidth, {
        subtotal: options.subtotal,
        tax: Number(options.tax || 0),
        discount: Number(options.discount || 0),
        total: options.total
    });

    if (options.notes) {
        let notesY = totalsEndY + 20;
        notesY = drawSectionTitle(doc, 'Notes', leftX, notesY, contentWidth);
        drawLines(doc, [options.notes], leftX, notesY, contentWidth);
    }
};

/**
 * Generate PDF for Quotation
 * @param quotation - Quotation document with populated references
 * @returns Promise<Buffer> - PDF buffer
 */
export const generateQuotationPDF = async (quotation: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = new WritableStreamBuffer();

            doc.pipe(stream);

            renderDocument(doc, {
                title: 'QUOTATION',
                numberLabel: 'Quotation #',
                numberValue: quotation.quotationNumber || 'N/A',
                dateLabel: 'Date',
                dateValue: formatDate(quotation.createdAt || Date.now()),
                dueLabel: 'Valid until',
                dueValue: formatDate(quotation.validUntil),
                client: quotation.client,
                projectTitle: quotation.project?.title,
                projectNumber: quotation.project?.projectNumber,
                items: quotation.items || [],
                subtotal: Number(quotation.subtotal || 0),
                tax: Number(quotation.tax || 0),
                discount: Number(quotation.discount || 0),
                total: Number(quotation.totalAmount || 0),
                notes: quotation.notes
            });

            doc.end();

            stream.on('finish', () => {
                const buffer = stream.getContents() as Buffer;
                resolve(buffer);
            });

            stream.on('error', (error: Error) => {
                reject(error);
            });
        } catch (error: any) {
            reject(error);
        }
    });
};

/**
 * Generate PDF for Invoice
 * @param invoice - Invoice document with populated references
 * @returns Promise<Buffer> - PDF buffer
 */
export const generateInvoicePDF = async (invoice: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = new WritableStreamBuffer();

            doc.pipe(stream);

            renderDocument(doc, {
                title: 'INVOICE',
                numberLabel: 'Invoice #',
                numberValue: invoice.invoiceNumber || 'N/A',
                dateLabel: 'Invoice date',
                dateValue: formatDate(invoice.createdAt || Date.now()),
                dueLabel: 'Due date',
                dueValue: formatDate(invoice.dueDate),
                client: invoice.client,
                projectTitle: invoice.projectTitle,
                quotationNumber: invoice.quotation?.quotationNumber,
                items: invoice.items || [],
                subtotal: Number(invoice.subtotal || 0),
                tax: Number(invoice.tax || 0),
                discount: Number(invoice.discount || 0),
                total: Number(invoice.totalAmount || 0),
                notes: invoice.notes
            });

            doc.end();

            stream.on('finish', () => {
                const buffer = stream.getContents() as Buffer;
                resolve(buffer);
            });

            stream.on('error', (error: Error) => {
                reject(error);
            });
        } catch (error: any) {
            reject(error);
        }
    });
};
