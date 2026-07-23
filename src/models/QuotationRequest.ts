import mongoose, { Schema } from 'mongoose';
import type { IQuotationRequest } from '../types/index';

const quotationRequestSchema = new Schema<IQuotationRequest>({
    requestNumber: {
        type: String,
        unique: true,
        trim: true
    },
    // ── Contact ──────────────────────────────────────────────────────────────
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        trim: true,
        maxlength: [20, 'Phone cannot exceed 20 characters']
    },
    company: {
        type: String,
        trim: true,
        maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    country: {
        type: String,
        trim: true,
        maxlength: [60, 'Country cannot exceed 60 characters']
    },
    // ── Project Scope ─────────────────────────────────────────────────────────
    projectTitle: {
        type: String,
        required: [true, 'Project title is required'],
        trim: true,
        maxlength: [200, 'Project title cannot exceed 200 characters']
    },
    projectType: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: [true, 'Project type is required']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [20, 'Description must be at least 20 characters'],
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    services: [{
        type: String,
        trim: true,
        maxlength: [100, 'Service name cannot exceed 100 characters']
    }],
    // ── Constraints ───────────────────────────────────────────────────────────
    budget: {
        type: String,
        trim: true,
        maxlength: [100, 'Budget string cannot exceed 100 characters']
    },
    deadline: {
        type: Date
    },
    // ── Supporting ────────────────────────────────────────────────────────────
    attachments: [{
        type: String,
        trim: true
    }],
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    referralSource: {
        type: String,
        trim: true,
        maxlength: [100, 'Referral source cannot exceed 100 characters']
    },
    // ── System ────────────────────────────────────────────────────────────────
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: {
            values: ['new', 'reviewed', 'converted', 'rejected'],
            message: 'Status must be new, reviewed, converted, or rejected'
        },
        default: 'new'
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    linkedProject: {
        type: Schema.Types.ObjectId,
        ref: 'Project'
    },
    linkedUser: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    // ── Audit timestamps ──────────────────────────────────────────────────────
    reviewedAt: { type: Date },
    convertedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    }
}, {
    timestamps: true
});

// ── Indexes ───────────────────────────────────────────────────────────────────
quotationRequestSchema.index({ email: 1 });
quotationRequestSchema.index({ status: 1 });
quotationRequestSchema.index({ projectType: 1 });
quotationRequestSchema.index({ assignedTo: 1 });
quotationRequestSchema.index({ createdAt: -1 });
quotationRequestSchema.index({ status: 1, createdAt: -1 });
quotationRequestSchema.index({ status: 1, projectType: 1 });

// ── Auto-number pre-save hook ─────────────────────────────────────────────────
// Counts by year-prefix regex to avoid race condition of flat countDocuments()
quotationRequestSchema.pre('save', async function (next) {
    if (!this.requestNumber || this.requestNumber.trim() === '') {
        try {
            const year = new Date().getFullYear();
            const count = await mongoose.model('QuotationRequest').countDocuments({
                requestNumber: new RegExp(`^RQR-${year}-`)
            });
            this.requestNumber = `RQR-${year}-${String(count + 1).padStart(4, '0')}`;
        } catch {
            const year = new Date().getFullYear();
            const ts = Date.now().toString().slice(-6);
            this.requestNumber = `RQR-${year}-${ts}`;
        }
    }
    next();
});

const QuotationRequest = mongoose.model<IQuotationRequest>('QuotationRequest', quotationRequestSchema);

export default QuotationRequest;
