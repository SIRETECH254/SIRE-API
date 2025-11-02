import nodemailer from "nodemailer";
import { errorHandler } from "../../middleware/errorHandler";


// Create email transporter
const createTransporter = () => {

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {

        throw errorHandler(500, "Email configuration is missing. Please check SMTP environment variables.");

    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

};


// Send OTP email
export const sendOTPEmail = async (email: string, otp: string, name: string = "User") => {

    if (!email || !otp) {

        throw errorHandler(400, "Email and OTP are required for sending OTP email");

    }

    try {

        const transporter = createTransporter();

        const mailOptions = {
            from: `"SIRE Tech" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Verify Your Account - OTP Code",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin: 0;">SIRE Tech</h1>
                        <p style="color: #666; margin: 5px 0;">Your Business Management Partner</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center;">
                        <h2 style="color: #333; margin-bottom: 20px;">Account Verification</h2>
                        <p style="color: #666; margin-bottom: 25px;">Hi ${name},</p>
                        <p style="color: #666; margin-bottom: 25px;">Welcome to SIRE Tech! Please verify your account using the OTP code below:</p>
                        
                        <div style="background: #2563eb; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 3px; margin: 25px 0;">
                            ${otp}
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            This code will expire in ${process.env.OTP_EXP_MINUTES || 10} minutes.
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            If you didn't request this, please ignore this email.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>SIRE Tech - Business Management Solutions</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `
        };

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    console.log(error);
                    reject(errorHandler(500, `Failed to send OTP email: ${error.message}`));
                } else {
                    console.log("Email sent: " + info.response);
                    resolve({ success: true, messageId: info.messageId });
                }
            });
        });

    } catch (error: any) {

        console.error('Error sending OTP email:', error);

        throw errorHandler(500, `Failed to send OTP email: ${error.message}`);

    }

};


// Send password reset email
export const sendPasswordResetEmail = async (email: string, resetToken: string, name: string = "User") => {

    if (!email || !resetToken) {

        throw errorHandler(400, "Email and reset token are required for sending password reset email");

    }

    try {

        const transporter = createTransporter();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: `"SIRE Tech" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Reset Your Password - SIRE Tech",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin: 0;">SIRE Tech</h1>
                        <p style="color: #666; margin: 5px 0;">Your Business Management Partner</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
                        <p style="color: #666; margin-bottom: 20px;">Hi ${name},</p>
                        <p style="color: #666; margin-bottom: 25px;">
                            We received a request to reset your password for your SIRE Tech account. 
                            Click the button below to create a new password:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                            This link will expire in 15 minutes for security reasons.
                        </p>
                        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                            If the button doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="color: #666; font-size: 12px; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">
                            ${resetUrl}
                        </p>
                        <p style="color: #666; font-size: 14px; margin-top: 20px;">
                            If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>SIRE Tech - Business Management Solutions</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `
        };

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    console.log(error);
                    reject(errorHandler(500, `Failed to send password reset email: ${error.message}`));
                } else {
                    console.log("Email sent: " + info.response);
                    resolve({ success: true, messageId: info.messageId });
                }
            });
        });

    } catch (error: any) {

        console.error('Error sending password reset email:', error);

        throw errorHandler(500, `Failed to send password reset email: ${error.message}`);

    }

};


// Send welcome email
export const sendWelcomeEmail = async (email: string, name: string) => {

    if (!email || !name) {

        throw errorHandler(400, "Email and name are required for sending welcome email");

    }

    try {

        const transporter = createTransporter();

        const mailOptions = {
            from: `"SIRE Tech" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Welcome to SIRE Tech! 🎉",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin: 0;">SIRE Tech</h1>
                        <p style="color: #666; margin: 5px 0;">Your Business Management Partner</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Welcome to the Team! 🎉</h2>
                        <p style="color: #666; margin-bottom: 20px;">Hi ${name},</p>
                        <p style="color: #666; margin-bottom: 25px;">
                            Your account has been successfully verified! Welcome to SIRE Tech, your comprehensive business management solution.
                        </p>
                        
                        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                            <h3 style="margin: 0 0 10px 0;">🚀 Ready to Get Started?</h3>
                            <p style="margin: 0; opacity: 0.9;">Manage your clients, projects, and invoices all in one place!</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Go to Dashboard
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center;">
                            Need help? Contact our support team anytime!
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>SIRE Tech - Business Management Solutions</p>
                        <p>support@siretech.com</p>
                    </div>
                </div>
            `
        };

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    console.log(error);
                    reject(errorHandler(500, `Failed to send welcome email: ${error.message}`));
                } else {
                    console.log("Email sent: " + info.response);
                    resolve({ success: true, messageId: info.messageId });
                }
            });
        });

    } catch (error: any) {

        console.error('Error sending welcome email:', error);

        throw errorHandler(500, `Failed to send welcome email: ${error.message}`);

    }

};

// Send quotation email with PDF attachment
export const sendQuotationEmail = async (email: string, quotation: any, pdfUrl: string, pdfBuffer?: Buffer) => {
    if (!email || !quotation) {
        throw errorHandler(400, "Email and quotation are required for sending quotation email");
    }

    try {
        const transporter = createTransporter();
        const clientName = quotation.client 
            ? `${quotation.client.firstName || ''} ${quotation.client.lastName || ''}`.trim() || 'Client'
            : 'Client';
        const quotationNumber = quotation.quotationNumber || 'N/A';
        const validUntil = quotation.validUntil 
            ? new Date(quotation.validUntil).toLocaleDateString()
            : 'N/A';
        const totalAmount = quotation.totalAmount || 0;

        const mailOptions: any = {
            from: `"SIRE Tech" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Quotation ${quotationNumber} - SIRE Tech`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin: 0;">SIRE Tech</h1>
                        <p style="color: #666; margin: 5px 0;">Your Business Management Partner</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Quotation ${quotationNumber}</h2>
                        <p style="color: #666; margin-bottom: 20px;">Hi ${clientName},</p>
                        <p style="color: #666; margin-bottom: 25px;">
                            Thank you for your interest in our services. Please find attached your quotation.
                        </p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                            <p style="margin: 5px 0; color: #333;"><strong>Quotation Number:</strong> ${quotationNumber}</p>
                            ${quotation.project ? `<p style="margin: 5px 0; color: #333;"><strong>Project:</strong> ${quotation.project.title || 'N/A'}</p>` : ''}
                            <p style="margin: 5px 0; color: #333;"><strong>Valid Until:</strong> ${validUntil}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${pdfUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 10px;">
                                View Quotation PDF
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            You can also download the quotation PDF from the link above or accept/reject it through your client portal.
                        </p>
                        
                        ${quotation.notes ? `
                            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #856404;"><strong>Notes:</strong> ${quotation.notes}</p>
                            </div>
                        ` : ''}
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            If you have any questions or would like to discuss this quotation, please don't hesitate to contact us.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>SIRE Tech - Business Management Solutions</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `
        };

        // Attach PDF buffer if provided
        if (pdfBuffer) {
            mailOptions.attachments = [
                {
                    filename: `quotation-${quotationNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ];
        }

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    console.error('Error sending quotation email:', error);
                    reject(errorHandler(500, `Failed to send quotation email: ${error.message}`));
                } else {
                    console.log("Quotation email sent: " + info.response);
                    resolve({ success: true, messageId: info.messageId });
                }
            });
        });

    } catch (error: any) {
        console.error('Error sending quotation email:', error);
        throw errorHandler(500, `Failed to send quotation email: ${error.message}`);
    }
};

export const sendInvoiceEmail = async (email: string, invoice: any, pdfUrl: string, pdfBuffer?: Buffer) => {
    if (!email || !invoice) {
        throw errorHandler(400, "Email and invoice are required for sending invoice email");
    }

    try {
        const transporter = createTransporter();
        const clientName = invoice.client 
            ? `${invoice.client.firstName || ''} ${invoice.client.lastName || ''}`.trim() || 'Client'
            : 'Client';
        const invoiceNumber = invoice.invoiceNumber || 'N/A';
        const dueDate = invoice.dueDate 
            ? new Date(invoice.dueDate).toLocaleDateString()
            : 'N/A';
        const totalAmount = invoice.totalAmount || 0;
        const paidAmount = invoice.paidAmount || 0;
        const balanceDue = totalAmount - paidAmount;

        const mailOptions: any = {
            from: `"SIRE Tech" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Invoice ${invoiceNumber} - SIRE Tech`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; margin: 0;">SIRE Tech</h1>
                        <p style="color: #666; margin: 5px 0;">Your Business Management Partner</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Invoice ${invoiceNumber}</h2>
                        <p style="color: #666; margin-bottom: 20px;">Hi ${clientName},</p>
                        <p style="color: #666; margin-bottom: 25px;">
                            Please find attached your invoice for your review and payment.
                        </p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                            <p style="margin: 5px 0; color: #333;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                            ${invoice.projectTitle ? `<p style="margin: 5px 0; color: #333;"><strong>Project:</strong> ${invoice.projectTitle}</p>` : ''}
                            <p style="margin: 5px 0; color: #333;"><strong>Due Date:</strong> ${dueDate}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
                            ${paidAmount > 0 ? `<p style="margin: 5px 0; color: #333;"><strong>Paid Amount:</strong> $${paidAmount.toFixed(2)}</p>` : ''}
                            ${balanceDue > 0 ? `<p style="margin: 5px 0; color: #d32f2f;"><strong>Balance Due:</strong> $${balanceDue.toFixed(2)}</p>` : ''}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${pdfUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 10px;">
                                View Invoice PDF
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            You can also download the invoice PDF from the link above or make a payment through your client portal.
                        </p>
                        
                        ${invoice.notes ? `
                            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #856404;"><strong>Notes:</strong> ${invoice.notes}</p>
                            </div>
                        ` : ''}
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            If you have any questions about this invoice or need assistance with payment, please don't hesitate to contact us.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>SIRE Tech - Business Management Solutions</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `
        };

        // Attach PDF buffer if provided
        if (pdfBuffer) {
            mailOptions.attachments = [
                {
                    filename: `invoice-${invoiceNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ];
        }

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    console.error('Error sending invoice email:', error);
                    reject(errorHandler(500, `Failed to send invoice email: ${error.message}`));
                } else {
                    console.log("Invoice email sent: " + info.response);
                    resolve({ success: true, messageId: info.messageId });
                }
            });
        });

    } catch (error: any) {
        console.error('Error sending invoice email:', error);
        throw errorHandler(500, `Failed to send invoice email: ${error.message}`);
    }
};

