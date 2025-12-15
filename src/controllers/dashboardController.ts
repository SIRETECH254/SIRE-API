import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Project from '../models/Project';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Quotation from '../models/Quotation';
import Service from '../models/Service';
import User from '../models/User';
import Role from '../models/Role';

// @desc    Get admin dashboard statistics
// @route   GET /api/dashboard/admin
// @access  Private (Admin)
export const getAdminDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Projects statistics
        const totalProjects = await Project.countDocuments();
        const projectsByStatus = {
            pending: await Project.countDocuments({ status: 'pending' }),
            in_progress: await Project.countDocuments({ status: 'in_progress' }),
            on_hold: await Project.countDocuments({ status: 'on_hold' }),
            completed: await Project.countDocuments({ status: 'completed' }),
            cancelled: await Project.countDocuments({ status: 'cancelled' })
        };

        // Invoices statistics
        const totalInvoices = await Invoice.countDocuments();
        const invoicesByStatus = {
            draft: await Invoice.countDocuments({ status: 'draft' }),
            sent: await Invoice.countDocuments({ status: 'sent' }),
            paid: await Invoice.countDocuments({ status: 'paid' }),
            partially_paid: await Invoice.countDocuments({ status: 'partially_paid' }),
            overdue: await Invoice.countDocuments({ status: 'overdue' }),
            cancelled: await Invoice.countDocuments({ status: 'cancelled' })
        };

        // Calculate total revenue
        const paidInvoices = await Invoice.find({ status: 'paid' });
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

        // Payments statistics
        const totalPayments = await Payment.countDocuments();
        const completedPayments = await Payment.find({ status: 'completed' });
        const totalPaymentAmount = completedPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Quotations statistics
        const totalQuotations = await Quotation.countDocuments();
        const quotationsByStatus = {
            pending: await Quotation.countDocuments({ status: 'pending' }),
            sent: await Quotation.countDocuments({ status: 'sent' }),
            accepted: await Quotation.countDocuments({ status: 'accepted' }),
            rejected: await Quotation.countDocuments({ status: 'rejected' }),
            converted: await Quotation.countDocuments({ status: 'converted' })
        };

        // Clients statistics (users with client role)
        const clientRole = await Role.findOne({ name: 'client' });
        const clientQuery = clientRole ? { roles: clientRole._id } : {};
        const totalClients = await User.countDocuments(clientQuery);
        const activeClients = await User.countDocuments({ ...clientQuery, isActive: true });
        const verifiedClients = await User.countDocuments({ ...clientQuery, emailVerified: true });

        // Services statistics
        const totalServices = await Service.countDocuments();
        const activeServices = await Service.countDocuments({ isActive: true });

        // Recent activity (last 10 items)
        const recentProjects = await Project.find()
            .populate('client', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentInvoices = await Invoice.find()
            .populate('client', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentPayments = await Payment.find()
            .populate('client', 'firstName lastName email')
            .populate('invoice', 'invoiceNumber')
            .sort({ createdAt: 'desc' })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    projects: {
                        total: totalProjects,
                        byStatus: projectsByStatus
                    },
                    invoices: {
                        total: totalInvoices,
                        byStatus: invoicesByStatus
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalPaymentAmount,
                        completed: completedPayments.length
                    },
                    quotations: {
                        total: totalQuotations,
                        byStatus: quotationsByStatus
                    },
                    clients: {
                        total: totalClients,
                        active: activeClients,
                        verified: verifiedClients
                    },
                    services: {
                        total: totalServices,
                        active: activeServices
                    },
                    revenue: {
                        total: totalRevenue,
                        fromPayments: totalPaymentAmount
                    }
                },
                recentActivity: {
                    projects: recentProjects,
                    invoices: recentInvoices,
                    payments: recentPayments
                }
            }
        });

    } catch (error: any) {
        console.error('Get admin dashboard error:', error);
        next(errorHandler(500, "Server error while fetching admin dashboard"));
    }
};

// @desc    Get client dashboard statistics
// @route   GET /api/dashboard/client
// @access  Private (Client)
export const getClientDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const clientId = req.user?._id;

        if (!clientId) {
            return next(errorHandler(401, "Client authentication required"));
        }

        // Verify client exists (user with client role)
        const client = await User.findById(clientId);
        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Projects statistics
        const totalProjects = await Project.countDocuments({ client: clientId });
        const projectsByStatus = {
            pending: await Project.countDocuments({ client: clientId, status: 'pending' }),
            in_progress: await Project.countDocuments({ client: clientId, status: 'in_progress' }),
            on_hold: await Project.countDocuments({ client: clientId, status: 'on_hold' }),
            completed: await Project.countDocuments({ client: clientId, status: 'completed' }),
            cancelled: await Project.countDocuments({ client: clientId, status: 'cancelled' })
        };

        // Invoices statistics
        const totalInvoices = await Invoice.countDocuments({ client: clientId });
        const invoicesByStatus = {
            draft: await Invoice.countDocuments({ client: clientId, status: 'draft' }),
            sent: await Invoice.countDocuments({ client: clientId, status: 'sent' }),
            paid: await Invoice.countDocuments({ client: clientId, status: 'paid' }),
            partially_paid: await Invoice.countDocuments({ client: clientId, status: 'partially_paid' }),
            overdue: await Invoice.countDocuments({ client: clientId, status: 'overdue' }),
            cancelled: await Invoice.countDocuments({ client: clientId, status: 'cancelled' })
        };

        // Calculate total spent and outstanding
        const clientInvoices = await Invoice.find({ client: clientId });
        const totalSpent = clientInvoices
            .filter(inv => inv.status === 'paid')
            .reduce((sum, inv) => sum + inv.totalAmount, 0);

        const outstandingBalance = clientInvoices
            .filter(inv => ['sent', 'partially_paid', 'overdue'].includes(inv.status))
            .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);

        // Payments statistics
        const totalPayments = await Payment.countDocuments({ client: clientId });
        const completedPayments = await Payment.find({ client: clientId, status: 'completed' });
        const totalPaymentAmount = completedPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Quotations statistics
        const totalQuotations = await Quotation.countDocuments({ client: clientId });
        const quotationsByStatus = {
            pending: await Quotation.countDocuments({ client: clientId, status: 'pending' }),
            sent: await Quotation.countDocuments({ client: clientId, status: 'sent' }),
            accepted: await Quotation.countDocuments({ client: clientId, status: 'accepted' }),
            rejected: await Quotation.countDocuments({ client: clientId, status: 'rejected' }),
            converted: await Quotation.countDocuments({ client: clientId, status: 'converted' })
        };

        // Recent activity (last 5 items)
        const recentProjects = await Project.find({ client: clientId })
            .sort({ createdAt: 'desc' })
            .limit(5);

        const recentInvoices = await Invoice.find({ client: clientId })
            .sort({ createdAt: 'desc' })
            .limit(5);

        const recentPayments = await Payment.find({ client: clientId })
            .populate('invoice', 'invoiceNumber')
            .sort({ createdAt: 'desc' })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    projects: {
                        total: totalProjects,
                        byStatus: projectsByStatus
                    },
                    invoices: {
                        total: totalInvoices,
                        byStatus: invoicesByStatus,
                        outstanding: outstandingBalance
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalPaymentAmount
                    },
                    quotations: {
                        total: totalQuotations,
                        byStatus: quotationsByStatus
                    },
                    financial: {
                        totalSpent: totalSpent,
                        outstandingBalance: outstandingBalance
                    }
                },
                recentActivity: {
                    projects: recentProjects,
                    invoices: recentInvoices,
                    payments: recentPayments
                }
            }
        });

    } catch (error: any) {
        console.error('Get client dashboard error:', error);
        next(errorHandler(500, "Server error while fetching client dashboard"));
    }
};

// @desc    Get revenue analytics
// @route   GET /api/dashboard/revenue
// @access  Private (Admin - super_admin, finance)
export const getRevenueStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly', startDate, endDate } = req.query;

        // Calculate date range
        let start: Date;
        let end: Date = new Date();

        if (startDate && endDate) {
            start = new Date(startDate as string);
            end = new Date(endDate as string);
        } else {
            // Default to last 30 days
            start = new Date();
            start.setDate(start.getDate() - 30);
        }

        // Get paid invoices in date range
        const paidInvoices = await Invoice.find({
            status: 'paid',
            paidDate: { $gte: start, $lte: end }
        }).populate('client', 'firstName lastName company');

        // Calculate total revenue
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

        // Get payments in date range
        const payments = await Payment.find({
            status: 'completed',
            paymentDate: { $gte: start, $lte: end }
        });

        // Revenue by payment method
        const revenueByMethod: any = {};
        payments.forEach(payment => {
            const method = payment.paymentMethod;
            if (!revenueByMethod[method]) {
                revenueByMethod[method] = 0;
            }
            revenueByMethod[method] += payment.amount;
        });

        // Outstanding revenue
        const outstandingInvoices = await Invoice.find({
            status: { $in: ['sent', 'partially_paid', 'overdue'] }
        });
        const outstandingRevenue = outstandingInvoices.reduce(
            (sum, inv) => sum + (inv.totalAmount - inv.paidAmount),
            0
        );

        // Top clients by revenue
        const clientRevenue: any = {};
        paidInvoices.forEach(inv => {
            const clientId = inv.client.toString();
            if (!clientRevenue[clientId]) {
                clientRevenue[clientId] = {
                    client: inv.client,
                    total: 0
                };
            }
            clientRevenue[clientId].total += inv.totalAmount;
        });

        const topClients = Object.values(clientRevenue)
            .sort((a: any, b: any) => b.total - a.total)
            .slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                period: {
                    start: start,
                    end: end,
                    type: period
                },
                revenue: {
                    total: totalRevenue,
                    outstanding: outstandingRevenue,
                    byMethod: revenueByMethod
                },
                topClients: topClients,
                invoiceCount: paidInvoices.length,
                paymentCount: payments.length
            }
        });

    } catch (error: any) {
        console.error('Get revenue stats error:', error);
        next(errorHandler(500, "Server error while fetching revenue statistics"));
    }
};

// @desc    Get project statistics
// @route   GET /api/dashboard/projects
// @access  Private (Admin)
export const getProjectStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Projects by status
        const projectsByStatus = {
            pending: await Project.countDocuments({ status: 'pending' }),
            in_progress: await Project.countDocuments({ status: 'in_progress' }),
            on_hold: await Project.countDocuments({ status: 'on_hold' }),
            completed: await Project.countDocuments({ status: 'completed' }),
            cancelled: await Project.countDocuments({ status: 'cancelled' })
        };

        // Projects by priority
        const projectsByPriority = {
            low: await Project.countDocuments({ priority: 'low' }),
            medium: await Project.countDocuments({ priority: 'medium' }),
            high: await Project.countDocuments({ priority: 'high' }),
            urgent: await Project.countDocuments({ priority: 'urgent' })
        };

        // Calculate average progress
        const allProjects = await Project.find();
        const totalProgress = allProjects.reduce((sum, proj) => sum + proj.progress, 0);
        const averageProgress = allProjects.length > 0 ? totalProgress / allProjects.length : 0;

        // Completed projects with dates
        const completedProjects = await Project.find({
            status: 'completed',
            completionDate: { $exists: true }
        });

        // Calculate average completion time
        let totalDays = 0;
        completedProjects.forEach(proj => {
            if (proj.startDate && proj.completionDate) {
                const days = Math.ceil(
                    (proj.completionDate.getTime() - proj.startDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                totalDays += days;
            }
        });
        const averageCompletionDays = completedProjects.length > 0 ? totalDays / completedProjects.length : 0;

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: allProjects.length,
                    byStatus: projectsByStatus,
                    byPriority: projectsByPriority
                },
                performance: {
                    averageProgress: Math.round(averageProgress),
                    averageCompletionDays: Math.round(averageCompletionDays),
                    completed: completedProjects.length
                }
            }
        });

    } catch (error: any) {
        console.error('Get project stats error:', error);
        next(errorHandler(500, "Server error while fetching project statistics"));
    }
};

// @desc    Get client activity statistics
// @route   GET /api/dashboard/client-activity
// @access  Private (Admin)
export const getClientActivityStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly' } = req.query;

        // Calculate date range
        const end = new Date();
        const start = new Date();
        
        if (period === 'daily') {
            start.setDate(start.getDate() - 1);
        } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
        } else if (period === 'monthly') {
            start.setMonth(start.getMonth() - 1);
        } else if (period === 'yearly') {
            start.setFullYear(start.getFullYear() - 1);
        }

        // Get client role for filtering
        const clientRole = await Role.findOne({ name: 'client' });
        const clientQuery = clientRole ? { roles: clientRole._id } : {};

        // Total clients (users with client role)
        const totalClients = await User.countDocuments(clientQuery);
        const activeClients = await User.countDocuments({ ...clientQuery, isActive: true });

        // New clients in period
        const newClients = await User.countDocuments({
            ...clientQuery,
            createdAt: { $gte: start, $lte: end }
        });

        // Clients with recent activity (last login)
        const activeClientCount = await User.countDocuments({
            ...clientQuery,
            lastLoginAt: { $gte: start, $lte: end }
        });

        // Top clients by project count
        const clientProjects = await Project.aggregate([
            { $group: { _id: '$client', projectCount: { $sum: 1 } } },
            { $sort: { projectCount: -1 } },
            { $limit: 10 }
        ]);

        // Populate client details
        const topClients = await Promise.all(
            clientProjects.map(async (item: any) => {
                const client = await User.findById(item._id).select('firstName lastName email company');
                return {
                    client: client,
                    projectCount: item.projectCount
                };
            })
        );

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: totalClients,
                    active: activeClients,
                    newInPeriod: newClients,
                    activeInPeriod: activeClientCount
                },
                period: {
                    start: start,
                    end: end,
                    type: period
                },
                topClients: topClients
            }
        });

    } catch (error: any) {
        console.error('Get client activity stats error:', error);
        next(errorHandler(500, "Server error while fetching client activity statistics"));
    }
};

// @desc    Get service demand analytics
// @route   GET /api/dashboard/service-demand
// @access  Private (Admin)
export const getServiceDemandStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // All services
        const allServices = await Service.find({ isActive: true });

        // Services in projects (main source of service demand)
        const projects = await Project.find().populate('services', 'title');
        const serviceProjectUsage: any = {};
        const serviceRevenue: any = {};
        
        projects.forEach(project => {
            if (project.services && Array.isArray(project.services)) {
                project.services.forEach((service: any) => {
                    const serviceId = service._id ? service._id.toString() : service.toString();
                    if (!serviceProjectUsage[serviceId]) {
                        serviceProjectUsage[serviceId] = {
                            service: service,
                            count: 0,
                            totalRevenue: 0
                        };
                    }
                    serviceProjectUsage[serviceId].count += 1;
                    
                    // Try to get revenue from related invoices
                    // This would require additional queries, simplified for now
                });
            }
        });

        // Convert to array and sort by count
        const serviceDemand = Object.values(serviceProjectUsage)
            .sort((a: any, b: any) => b.count - a.count);

        // Get quotations count per service (based on related projects)
        const quotations = await Quotation.find().populate('project', 'services');
        const serviceQuotationCount: any = {};
        
        quotations.forEach(quotation => {
            if (quotation.project && (quotation.project as any).services) {
                const projectServices = (quotation.project as any).services;
                if (Array.isArray(projectServices)) {
                    projectServices.forEach((service: any) => {
                        const serviceId = service._id ? service._id.toString() : service.toString();
                        if (!serviceQuotationCount[serviceId]) {
                            serviceQuotationCount[serviceId] = 0;
                        }
                        serviceQuotationCount[serviceId] += 1;
                    });
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalServices: allServices.length,
                serviceDemand: serviceDemand.slice(0, 10),
                serviceProjectUsage: serviceProjectUsage,
                serviceQuotationCount: serviceQuotationCount
            }
        });

    } catch (error: any) {
        console.error('Get service demand stats error:', error);
        next(errorHandler(500, "Server error while fetching service demand statistics"));
    }
};

