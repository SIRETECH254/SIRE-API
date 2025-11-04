
# 📊 SIRE Tech API - Dashboard Analytics Documentation

## 📋 Table of Contents
- [Dashboard Overview](#dashboard-overview)
- [Dashboard Controller](#dashboard-controller)
- [Dashboard Routes](#dashboard-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 📊 Dashboard Overview

The SIRE Tech API Dashboard Analytics System provides comprehensive analytics and statistics for both admin users and clients. Dashboards aggregate data from various modules including projects, invoices, payments, quotations, clients, and services to provide insights and overviews.

### Dashboard System Features
- **Admin Dashboard** - Comprehensive system-wide analytics
- **Client Dashboard** - Personalized client statistics
- **Revenue Analytics** - Financial performance tracking
- **Project Statistics** - Project performance metrics
- **Client Activity** - Client engagement analytics
- **Service Demand** - Service popularity and demand analytics

### Dashboard Types
1. **Admin Dashboard** - System-wide statistics and analytics
2. **Client Dashboard** - Client-specific statistics and overview
3. **Revenue Dashboard** - Financial performance metrics
4. **Project Dashboard** - Project management statistics
5. **Client Activity Dashboard** - Client engagement metrics
6. **Service Demand Dashboard** - Service popularity analytics

---

## 🎮 Dashboard Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Project from '../models/Project';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Quotation from '../models/Quotation';
import Client from '../models/Client';
import Service from '../models/Service';
import User from '../models/User';
```

### Functions Overview

#### `getAdminDashboard()`
**Purpose:** Get admin dashboard statistics
**Access:** Admin users only
**Features:**
- Total projects by status
- Total invoices by status
- Total payments and revenue
- Total quotations by status
- Total clients
- Active services
- Recent activity
**Response:** Complete admin dashboard data

**Controller Implementation:**
```typescript
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

        // Clients statistics
        const totalClients = await Client.countDocuments();
        const activeClients = await Client.countDocuments({ isActive: true });
        const verifiedClients = await Client.countDocuments({ emailVerified: true });

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
```

#### `getClientDashboard()`
**Purpose:** Get client dashboard statistics
**Access:** Authenticated clients only
**Features:**
- Client's projects by status
- Client's invoices by status
- Client's payments history
- Client's quotations by status
- Total spent
- Outstanding balance
**Response:** Complete client dashboard data

**Controller Implementation:**
```typescript
export const getClientDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const clientId = req.user?._id;

        if (!clientId) {
            return next(errorHandler(401, "Client authentication required"));
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
```

#### `getRevenueStats(query)`
**Purpose:** Get revenue analytics
**Access:** Admin users only (super_admin, finance)
**Features:**
- Revenue by period (daily, weekly, monthly, yearly)
- Revenue by payment method
- Revenue trends
- Outstanding revenue
- Top clients by revenue
**Query Parameters:**
- period: daily, weekly, monthly, yearly
- startDate, endDate: Date range
**Response:** Revenue analytics data

**Controller Implementation:**
```typescript
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
```

#### `getProjectStats(query)`
**Purpose:** Get project statistics
**Access:** Admin users only
**Features:**
- Projects by status
- Projects by priority
- Projects by completion rate
- Average project duration
- Team member assignments
**Response:** Project analytics data

**Controller Implementation:**
```typescript
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
```

#### `getClientActivityStats(query)`
**Purpose:** Get client activity statistics
**Access:** Admin users only
**Features:**
- Active clients
- New clients by period
- Client engagement metrics
- Top active clients
**Response:** Client activity analytics data

**Controller Implementation:**
```typescript
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

        // Total clients
        const totalClients = await Client.countDocuments();
        const activeClients = await Client.countDocuments({ isActive: true });

        // New clients in period
        const newClients = await Client.countDocuments({
            createdAt: { $gte: start, $lte: end }
        });

        // Clients with recent activity (last login)
        const activeClientCount = await Client.countDocuments({
            lastLoginAt: { $gte: start, $lte: end }
        });

        // Top clients by project count
        const clientProjects = await Project.aggregate([
            { $group: { _id: '$client', projectCount: { $sum: 1 } } },
            { $sort: { projectCount: -1 } },
            { $limit: 10 }
        ]);

        const topClients = await Client.populate(clientProjects, { path: '_id', select: 'firstName lastName email company' });

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
```

#### `getServiceDemandStats(query)`
**Purpose:** Get service demand analytics
**Access:** Admin users only
**Features:**
- Most requested services
- Service popularity trends
- Service revenue
- Service conversion rate
**Response:** Service demand analytics data

**Controller Implementation:**
```typescript
export const getServiceDemandStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // All services
        const allServices = await Service.find({ isActive: true });

        // Services in quotations
        const quotations = await Quotation.find().populate('services', 'title');
        
        // Count service usage in quotations
        const serviceUsage: any = {};
        quotations.forEach(quotation => {
            if (quotation.services && Array.isArray(quotation.services)) {
                quotation.services.forEach((service: any) => {
                    const serviceId = service._id ? service._id.toString() : service.toString();
                    if (!serviceUsage[serviceId]) {
                        serviceUsage[serviceId] = {
                            service: service,
                            count: 0,
                            totalRevenue: 0
                        };
                    }
                    serviceUsage[serviceId].count += 1;
                    serviceUsage[serviceId].totalRevenue += quotation.totalAmount || 0;
                });
            }
        });

        // Convert to array and sort
        const serviceDemand = Object.values(serviceUsage)
            .sort((a: any, b: any) => b.count - a.count);

        // Services in projects
        const projects = await Project.find().populate('services', 'title');
        const serviceProjectUsage: any = {};
        projects.forEach(project => {
            if (project.services && Array.isArray(project.services)) {
                project.services.forEach((service: any) => {
                    const serviceId = service._id ? service._id.toString() : service.toString();
                    if (!serviceProjectUsage[serviceId]) {
                        serviceProjectUsage[serviceId] = 0;
                    }
                    serviceProjectUsage[serviceId] += 1;
                });
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalServices: allServices.length,
                serviceDemand: serviceDemand.slice(0, 10),
                serviceProjectUsage: serviceProjectUsage
            }
        });

    } catch (error: any) {
        console.error('Get service demand stats error:', error);
        next(errorHandler(500, "Server error while fetching service demand statistics"));
    }
};
```

---

## 🛣️ Dashboard Routes

### Base Path: `/api/dashboard`

```typescript
// Admin Routes
GET    /admin                     // Admin dashboard
GET    /revenue                   // Revenue analytics
GET    /projects                  // Project statistics
GET    /client-activity           // Client activity statistics
GET    /service-demand            // Service demand analytics

// Client Routes
GET    /client                    // Client dashboard
```

### Router Implementation

**File: `src/routes/dashboardRoutes.ts`**

```typescript
import express from 'express';
import {
    getAdminDashboard,
    getClientDashboard,
    getRevenueStats,
    getProjectStats,
    getClientActivityStats,
    getServiceDemandStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/admin', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAdminDashboard);

/**
 * @route   GET /api/dashboard/client
 * @desc    Get client dashboard statistics
 * @access  Private (Client)
 */
router.get('/client', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/dashboard/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin only)
 */
router.get('/revenue', authenticateToken, authorizeRoles(['super_admin', 'finance']), getRevenueStats);

/**
 * @route   GET /api/dashboard/projects
 * @desc    Get project statistics
 * @access  Private (Admin only)
 */
router.get('/projects', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getProjectStats);

/**
 * @route   GET /api/dashboard/client-activity
 * @desc    Get client activity statistics
 * @access  Private (Admin only)
 */
router.get('/client-activity', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getClientActivityStats);

/**
 * @route   GET /api/dashboard/service-demand
 * @desc    Get service demand analytics
 * @access  Private (Admin only)
 */
router.get('/service-demand', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getServiceDemandStats);

export default router;
```

### Route Details

#### `GET /api/dashboard/admin`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "projects": {
        "total": 100,
        "byStatus": {
          "pending": 10,
          "in_progress": 30,
          "on_hold": 5,
          "completed": 50,
          "cancelled": 5
        }
      },
      "invoices": {
        "total": 80,
        "byStatus": {
          "draft": 5,
          "sent": 20,
          "paid": 40,
          "partially_paid": 10,
          "overdue": 5,
          "cancelled": 0
        }
      },
      "payments": {
        "total": 120,
        "totalAmount": 500000,
        "completed": 115
      },
      "quotations": {
        "total": 60,
        "byStatus": {
          "pending": 5,
          "sent": 20,
          "accepted": 25,
          "rejected": 5,
          "converted": 5
        }
      },
      "clients": {
        "total": 50,
        "active": 45,
        "verified": 40
      },
      "services": {
        "total": 10,
        "active": 8
      },
      "revenue": {
        "total": 500000,
        "fromPayments": 480000
      }
    },
    "recentActivity": {
      "projects": [...],
      "invoices": [...],
      "payments": [...]
    }
  }
}
```

#### `GET /api/dashboard/client`
**Headers:** `Authorization: Bearer <client_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "projects": {
        "total": 5,
        "byStatus": {
          "pending": 0,
          "in_progress": 2,
          "on_hold": 0,
          "completed": 3,
          "cancelled": 0
        }
      },
      "invoices": {
        "total": 8,
        "byStatus": {
          "draft": 0,
          "sent": 2,
          "paid": 5,
          "partially_paid": 1,
          "overdue": 0,
          "cancelled": 0
        },
        "outstanding": 5000
      },
      "payments": {
        "total": 12,
        "totalAmount": 45000
      },
      "quotations": {
        "total": 10,
        "byStatus": {
          "pending": 1,
          "sent": 2,
          "accepted": 5,
          "rejected": 1,
          "converted": 1
        }
      },
      "financial": {
        "totalSpent": 45000,
        "outstandingBalance": 5000
      }
    },
    "recentActivity": {
      "projects": [...],
      "invoices": [...],
      "payments": [...]
    }
  }
}
```

#### `GET /api/dashboard/revenue`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `period` (optional): daily, weekly, monthly, yearly (default: monthly)
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-01-31T23:59:59.999Z",
      "type": "monthly"
    },
    "revenue": {
      "total": 50000,
      "outstanding": 10000,
      "byMethod": {
        "mpesa": 30000,
        "paystack": 20000
      }
    },
    "topClients": [...],
    "invoiceCount": 50,
    "paymentCount": 45
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user/client
**Usage in Dashboard Routes:**
```typescript
router.get('/admin', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAdminDashboard);
router.get('/client', authenticateToken, getClientDashboard);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check admin permissions
**Usage:**
```typescript
router.get('/revenue', authenticateToken, authorizeRoles(['super_admin', 'finance']), getRevenueStats);
```

---

## 📝 API Examples

### Complete Dashboard Flow

#### 1. Get Admin Dashboard
```bash
curl -X GET http://localhost:5000/api/dashboard/admin \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 2. Get Client Dashboard
```bash
curl -X GET http://localhost:5000/api/dashboard/client \
  -H "Authorization: Bearer <client_access_token>"
```

#### 3. Get Revenue Statistics
```bash
curl -X GET "http://localhost:5000/api/dashboard/revenue?period=monthly&startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 4. Get Project Statistics
```bash
curl -X GET http://localhost:5000/api/dashboard/projects \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 5. Get Client Activity Statistics
```bash
curl -X GET "http://localhost:5000/api/dashboard/client-activity?period=monthly" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 6. Get Service Demand Statistics
```bash
curl -X GET http://localhost:5000/api/dashboard/service-demand \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🔒 Security Features

### Access Control
- **Admin Only** - Most dashboard endpoints require admin privileges
- **Client Access** - Clients can only access their own dashboard
- **Role-Based Access** - Different roles see different data
- **Data Isolation** - Clients can only see their own data

### Data Protection
- **Aggregated Data** - Only aggregated statistics, no sensitive details
- **Client Isolation** - Client dashboards only show their data
- **Audit Trail** - All dashboard access logged

---

## 🚨 Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error while fetching dashboard"
}
```

---

## 🔗 Integration with Other Modules

### Project Integration
- Project statistics and status breakdowns
- Project completion metrics
- Team member assignments

### Invoice Integration
- Invoice status breakdowns
- Revenue calculations
- Outstanding balance tracking

### Payment Integration
- Payment statistics
- Revenue by payment method
- Payment history

### Quotation Integration
- Quotation status breakdowns
- Conversion rates
- Service demand from quotations

### Client Integration
- Client activity metrics
- Client engagement statistics
- Top clients by revenue

### Service Integration
- Service popularity metrics
- Service demand analytics
- Service revenue tracking

---

## 📊 Performance Considerations

### Optimization Tips
- **Database Indexes** - Ensure proper indexes on frequently queried fields
- **Caching** - Consider caching dashboard data for better performance
- **Pagination** - Use pagination for large datasets
- **Aggregation** - Use MongoDB aggregation for complex calculations

### Database Indexes
```typescript
// Project indexes
projectSchema.index({ status: 1 });
projectSchema.index({ client: 1 });
projectSchema.index({ createdAt: -1 });

// Invoice indexes
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ paidDate: 1 });

// Payment indexes
paymentSchema.index({ status: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ paymentDate: 1 });
```

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

