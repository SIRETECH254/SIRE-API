import { v2 as cloudinary } from 'cloudinary';
import { generateQuotationPDF } from './generatePDF';
import type { IQuotation } from '../types';

/**
 * Generate PDF for quotation and upload to Cloudinary
 * @param quotation - Quotation document with populated references
 * @returns Promise<string> - PDF URL
 */
export const uploadQuotationPDF = async (quotation: any): Promise<string> => {
    try {
        // Generate PDF
        const pdfBuffer = await generateQuotationPDF(quotation);

        // Upload PDF to Cloudinary as raw file using stream
        // Include .pdf extension in the filename for proper URL generation
        const fileName = `quotation-${quotation.quotationNumber || quotation._id}.pdf`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string; version?: number }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/quotations',
                    resource_type: 'raw',
                    public_id: fileName, // Include .pdf in the filename
                    type: 'upload',
                    overwrite: true,
                    invalidate: true,
                    access_mode: 'public'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else if (result) {
                        resolve({
                            secure_url: result.secure_url || '',
                            url: result.url || '',
                            public_id: result.public_id || '',
                            version: result.version
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(pdfBuffer);
        });

        // Use the secure_url directly from Cloudinary
        // Cloudinary should return the correct URL with .pdf extension since we included it in public_id
        let pdfUrl = uploadResult.secure_url;
        
        // If secure_url is not available, construct it manually using the public_id
        if (!pdfUrl) {
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const publicId = uploadResult.public_id || `sire-tech/quotations/${fileName}`;
            const version = uploadResult.version ? `v${uploadResult.version}/` : '';
            
            // Ensure public_id has .pdf extension
            const finalPublicId = publicId.endsWith('.pdf') ? publicId : `${publicId}.pdf`;
            
            // Construct URL: https://res.cloudinary.com/{cloud_name}/raw/upload/{version}{public_id}
            pdfUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${version}${finalPublicId}`;
        } else {
            // Verify the URL has .pdf extension for browser compatibility
            const urlParts = pdfUrl.split('?');
            const urlWithoutQuery = urlParts[0];
            if (urlWithoutQuery && !urlWithoutQuery.toLowerCase().endsWith('.pdf')) {
                // The secure_url should already have it, but if not, add it
                if (pdfUrl.includes('?')) {
                    pdfUrl = pdfUrl.replace('?', '.pdf?');
                } else {
                    pdfUrl = `${pdfUrl}.pdf`;
                }
            }
        }

        return pdfUrl;
    } catch (error: any) {
        console.error('Error uploading quotation PDF:', error);
        throw error;
    }
};

