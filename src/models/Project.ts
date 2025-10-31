import mongoose, { Schema } from 'mongoose';
import type { IProject } from '../types/index';

const projectSchema = new Schema<IProject>({
  projectNumber: {
    type: String,
    required: false, // Will be auto-generated, not required in request
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  quotation: {
    type: Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  services: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'in_progress', 'on_hold', 'completed', 'cancelled'],
      message: 'Status must be pending, in_progress, on_hold, completed, or cancelled'
    },
    default: 'pending'
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be low, medium, high, or urgent'
    },
    default: 'medium'
  },
  assignedTo: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  completionDate: {
    type: Date
  },
  progress: {
    type: Number,
    required: [true, 'Progress is required'],
    min: [0, 'Progress cannot be less than 0'],
    max: [100, 'Progress cannot exceed 100'],
    default: 0
  },
  milestones: [{
    title: {
      type: String,
      required: [true, 'Milestone title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    dueDate: {
      type: Date,
      required: [true, 'Milestone due date is required']
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    completedDate: {
      type: Date
    }
  }],
  attachments: [{
    name: {
      type: String,
      required: [true, 'Attachment name is required']
    },
    url: {
      type: String,
      required: [true, 'Attachment URL is required']
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  }
}, {
  timestamps: true
});

// Indexes for better performance
// Note: projectNumber index is already created by unique: true
projectSchema.index({ client: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ assignedTo: 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ status: 1, priority: 1 });
projectSchema.index({ client: 1, status: 1 });

// Pre-save middleware to generate project number
projectSchema.pre('save', async function(next) {
  // Only generate if projectNumber is not already set
  if (!(this as any).projectNumber || (this as any).projectNumber.trim() === '') {
    try {
      const year = new Date().getFullYear();
      // Count existing projects for this year to ensure uniqueness
      const existingProjects = await mongoose.model('Project').countDocuments({
        projectNumber: new RegExp(`^PRJ-${year}-`)
      });
      (this as any).projectNumber = `PRJ-${year}-${String(existingProjects + 1).padStart(4, '0')}`;
    } catch (error) {
      // If counting fails, use timestamp-based fallback
      const year = new Date().getFullYear();
      const timestamp = Date.now().toString().slice(-6);
      (this as any).projectNumber = `PRJ-${year}-${timestamp}`;
    }
  }
  next();
});

// Pre-save middleware to set completion date when status changes to completed
projectSchema.pre('save', function(next) {
  if ((this as any).isModified('status') && (this as any).status === 'completed' && !(this as any).completionDate) {
    (this as any).completionDate = new Date();
  }
  next();
});

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;

