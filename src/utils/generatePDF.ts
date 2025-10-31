import PDFDocument from 'pdfkit';
import { WritableStreamBuffer } from 'stream-buffers';
import type { IQuotation } from '../types';

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

            // Header Section
            doc.fontSize(24)
                .fillColor('#333333')
                .text('QUOTATION', 50, 50, { align: 'left' });

            doc.fontSize(10)
                .fillColor('#666666')
                .text(`Quotation Number: ${quotation.quotationNumber || 'N/A'}`, 50, 80)
                .text(`Date: ${new Date(quotation.createdAt || Date.now()).toLocaleDateString()}`, 50, 95)
                .text(`Valid Until: ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}`, 50, 110);

            // Client Information Section
            let currentY = 150;
            if (quotation.client) {
                const client = quotation.client;
                doc.fontSize(14)
                    .fillColor('#333333')
                    .text('Bill To:', 50, currentY);

                currentY += 20;
                doc.fontSize(11)
                    .fillColor('#000000')
                    .text(`${client.firstName || ''} ${client.lastName || ''}`, 50, currentY)
                    .text(client.company || '', 50, currentY + 15)
                    .text(client.email || '', 50, currentY + 30)
                    .text(client.phone || '', 50, currentY + 45);

                if (client.address || client.city || client.country) {
                    let addressParts: string[] = [];
                    if (client.address) addressParts.push(client.address);
                    if (client.city) addressParts.push(client.city);
                    if (client.country) addressParts.push(client.country);
                    doc.text(addressParts.join(', '), 50, currentY + 60);
                }
            }

            // Project Information
            if (quotation.project) {
                const project = quotation.project;
                currentY += 100;
                doc.fontSize(14)
                    .fillColor('#333333')
                    .text('Project:', 350, currentY);

                currentY += 20;
                doc.fontSize(11)
                    .fillColor('#000000')
                    .text(project.title || 'N/A', 350, currentY, { width: 200 })
                    .text(`Project #: ${project.projectNumber || 'N/A'}`, 350, currentY + 30);
            }

            // Items Table
            currentY += 120;
            const tableTop = currentY;
            const itemDescX = 50;
            const quantityX = 350;
            const priceX = 420;
            const totalX = 520;

            // Table Header
            doc.fontSize(10)
                .fillColor('#FFFFFF')
                .rect(itemDescX - 5, tableTop - 5, 460, 25)
                .fill('#333333');

            doc.fontSize(10)
                .fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .text('Description', itemDescX, tableTop)
                .text('Qty', quantityX, tableTop)
                .text('Price', priceX, tableTop)
                .text('Total', totalX, tableTop);

            // Table Rows
            let rowY = tableTop + 30;
            doc.font('Helvetica')
                .fillColor('#000000');

            if (quotation.items && quotation.items.length > 0) {
                quotation.items.forEach((item: any, index: number) => {
                    if (rowY > 700) {
                        // Add new page if needed
                        doc.addPage();
                        rowY = 50;
                    }

                    // Alternate row colors
                    if (index % 2 === 0) {
                        doc.rect(itemDescX - 5, rowY - 5, 460, 20)
                            .fill('#F8F8F8');
                    }

                    doc.fontSize(9)
                        .fillColor('#000000')
                        .text(item.description || 'N/A', itemDescX, rowY, { width: 280 })
                        .text((item.quantity || 0).toString(), quantityX, rowY)
                        .text(`$${(item.unitPrice || 0).toFixed(2)}`, priceX, rowY)
                        .text(`$${(item.total || 0).toFixed(2)}`, totalX, rowY);

                    rowY += 25;
                });
            }

            // Totals Section
            const totalsY = rowY + 20;
            doc.fontSize(10)
                .fillColor('#000000');

            // Draw line above totals
            doc.moveTo(itemDescX, totalsY - 10)
                .lineTo(totalX + 50, totalsY - 10)
                .stroke();

            // Subtotal
            doc.text('Subtotal:', priceX - 50, totalsY, { width: 100, align: 'right' });
            doc.text(`$${(quotation.subtotal || 0).toFixed(2)}`, totalX, totalsY);

            // Tax
            if (quotation.tax && quotation.tax > 0) {
                doc.text('Tax:', priceX - 50, totalsY + 20, { width: 100, align: 'right' });
                doc.text(`$${(quotation.tax || 0).toFixed(2)}`, totalX, totalsY + 20);
            }

            // Discount
            if (quotation.discount && quotation.discount > 0) {
                doc.text('Discount:', priceX - 50, totalsY + 40, { width: 100, align: 'right' });
                doc.text(`-$${(quotation.discount || 0).toFixed(2)}`, totalX, totalsY + 40);
            }

            // Total Amount
            const totalAmountY = totalsY + (quotation.tax && quotation.tax > 0 ? 40 : 20) + (quotation.discount && quotation.discount > 0 ? 20 : 0);
            doc.moveTo(itemDescX, totalAmountY - 10)
                .lineTo(totalX + 50, totalAmountY - 10)
                .stroke();

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .fillColor('#000000')
                .text('Total Amount:', priceX - 50, totalAmountY, { width: 100, align: 'right' });
            doc.text(`$${(quotation.totalAmount || 0).toFixed(2)}`, totalX, totalAmountY);

            // Notes Section
            if (quotation.notes) {
                const notesY = totalAmountY + 50;
                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor('#333333')
                    .text('Notes:', 50, notesY);

                doc.fontSize(9)
                    .fillColor('#666666')
                    .text(quotation.notes, 50, notesY + 20, { width: 500 });
            }

            // Status
            const statusY = doc.page.height - 100;
            doc.fontSize(10)
                .fillColor('#666666')
                .text(`Status: ${quotation.status?.toUpperCase() || 'PENDING'}`, 50, statusY);

            // Footer
            doc.fontSize(8)
                .fillColor('#999999')
                .text(
                    `Generated on ${new Date().toLocaleString()}`,
                    50,
                    doc.page.height - 50,
                    { align: 'center', width: 500 }
                );

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

