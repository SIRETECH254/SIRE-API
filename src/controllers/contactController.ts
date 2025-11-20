import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import { errorHandler } from '../middleware/errorHandler';
import ContactMessage from '../models/ContactMessage';
import User from '../models/User';
import Role from '../models/Role';
import { sendContactFormNotification, sendContactReplyEmail } from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';

// @desc    Submit contact message (Public)
// @route   POST /api/contact
// @access  Public
export const submitContactMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, email, phone, subject, message }: {
            name: string;
            email: string;
            phone?: string;
            subject: string;
            message: string;
        } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return next(errorHandler(400, "Name, email, subject, and message are required"));
        }

        // Validate email format
        if (!validator.isEmail(email)) {
            return next(errorHandler(400, "Please provide a valid email"));
        }

        // Validate phone format (if provided)
        if (phone && !validator.isMobilePhone(phone)) {
            return next(errorHandler(400, "Please provide a valid phone number"));
        }

        // Validate message length
        if (message.length < 10 || message.length > 2000) {
            return next(errorHandler(400, "Message must be between 10 and 2000 characters"));
        }

        // Create contact message
        const contactMessage = new ContactMessage({
            name,
            email: email.toLowerCase(),
            phone,
            subject,
            message,
            status: 'unread'
        });

        await contactMessage.save();

        // Send email notification to admin
        try {
            await sendContactFormNotification(email, name, subject, message);
        } catch (emailError) {
            console.error('Error sending email notification:', emailError);
            // Don't fail the request if email fails
        }

        // Send in-app notification to all admins
        try {
            const admins = await User.find({ 
                role: { $in: ['super_admin', 'finance', 'project_manager'] },
                isActive: true 
            });

            const notificationPromises = admins.map(admin => 
                createInAppNotification({
                    recipient: admin._id.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'New Contact Message',
                    message: `New contact message from ${name}: ${subject}`,
                    metadata: {
                        contactMessageId: contactMessage._id,
                        senderName: name,
                        senderEmail: email,
                        subject: subject
                    },
                    io: (req.app as any).get('io')
                })
            );

            await Promise.all(notificationPromises);
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Contact message submitted successfully. We will get back to you soon!",
            data: {
                contactMessage: {
                    id: contactMessage._id,
                    name: contactMessage.name,
                    subject: contactMessage.subject,
                    status: contactMessage.status,
                    createdAt: contactMessage.createdAt
                }
            }
        });

    } catch (error: any) {
        console.error('Submit contact message error:', error);
        next(errorHandler(500, "Server error while submitting contact message"));
    }
};

// @desc    Get all contact messages (Admin only)
// @route   GET /api/contact
// @access  Private (Admin)
export const getAllMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, status, search, startDate, endDate } = req.query;

        const query: any = {};

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Search by name, email, subject, or message
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        // Date range filtering
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate as string);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate as string);
            }
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const messages = await ContactMessage.find(query)
            .populate('repliedBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await ContactMessage.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                messages: messages,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalMessages: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all messages error:', error);
        next(errorHandler(500, "Server error while fetching contact messages"));
    }
};

// @desc    Get single contact message (Admin only)
// @route   GET /api/contact/:messageId
// @access  Private (Admin)
export const getMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId)
            .populate('repliedBy', 'firstName lastName email');

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        // Mark as read if currently unread
        if (message.status === 'unread') {
            message.status = 'read';
            await message.save();
        }

        res.status(200).json({
            success: true,
            data: {
                message: message
            }
        });

    } catch (error: any) {
        console.error('Get message error:', error);
        next(errorHandler(500, "Server error while fetching contact message"));
    }
};

// @desc    Mark message as read (Admin only)
// @route   PATCH /api/contact/:messageId/read
// @access  Private (Admin)
export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        if (message.status === 'unread') {
            message.status = 'read';
            await message.save();
        }

        res.status(200).json({
            success: true,
            message: "Message marked as read",
            data: {
                message: {
                    id: message._id,
                    status: message.status
                }
            }
        });

    } catch (error: any) {
        console.error('Mark as read error:', error);
        next(errorHandler(500, "Server error while marking message as read"));
    }
};

// @desc    Reply to contact message (Admin only)
// @route   POST /api/contact/:messageId/reply
// @access  Private (Admin)
export const replyToMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { reply }: { reply: string } = req.body;

        if (!reply) {
            return next(errorHandler(400, "Reply message is required"));
        }

        if (reply.length < 10 || reply.length > 2000) {
            return next(errorHandler(400, "Reply must be between 10 and 2000 characters"));
        }

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        // Update message with reply
        message.reply = reply;
        message.status = 'replied';
        message.repliedBy = req.user?._id as any;
        message.repliedAt = new Date();
        await message.save();

        // Send email reply to sender
        try {
            await sendContactReplyEmail(message.email, message.name, message.subject, reply);
        } catch (emailError) {
            console.error('Error sending reply email:', emailError);
            // Don't fail the request if email fails
        }

        // Send in-app notification to sender if they are a registered user with client role
        try {
            // Find user with client role by email
            const clientRole = await Role.findOne({ name: 'client' });
            if (clientRole) {
                const client = await User.findOne({ 
                    email: message.email,
                    roles: clientRole._id
                });

                if (client) {
                    await createInAppNotification({
                        recipient: client._id.toString(),
                        recipientModel: 'User',
                        category: 'general',
                        subject: 'Contact Message Replied',
                        message: `Your contact message "${message.subject}" has been replied to. Check your email for the reply.`,
                        metadata: {
                            contactMessageId: message._id,
                            subject: message.subject,
                            reply: reply
                        },
                        io: (req.app as any).get('io')
                    });
                }
            }
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        await message.populate('repliedBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: "Reply sent successfully",
            data: {
                message: {
                    id: message._id,
                    status: message.status,
                    reply: message.reply,
                    repliedBy: message.repliedBy,
                    repliedAt: message.repliedAt
                }
            }
        });

    } catch (error: any) {
        console.error('Reply to message error:', error);
        next(errorHandler(500, "Server error while replying to message"));
    }
};

// @desc    Delete contact message (Admin only)
// @route   DELETE /api/contact/:messageId
// @access  Private (Admin)
export const deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        await ContactMessage.findByIdAndDelete(messageId);

        res.status(200).json({
            success: true,
            message: "Contact message deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete message error:', error);
        next(errorHandler(500, "Server error while deleting contact message"));
    }
};

// @desc    Archive contact message (Admin only)
// @route   PATCH /api/contact/:messageId/archive
// @access  Private (Admin)
export const archiveMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        message.status = 'archived';
        await message.save();

        res.status(200).json({
            success: true,
            message: "Message archived successfully",
            data: {
                message: {
                    id: message._id,
                    status: message.status
                }
            }
        });

    } catch (error: any) {
        console.error('Archive message error:', error);
        next(errorHandler(500, "Server error while archiving message"));
    }
};

