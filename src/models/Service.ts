import mongoose, { Schema } from 'mongoose';
import type { IService } from '../types/index';

const serviceSchema = new Schema<IService>({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true
  },
  features: {
    type: [String],
    required: [true, 'Features are required'],
    validate: {
      validator: function(v: string[]) {
        return v && v.length > 0;
      },
      message: 'At least one feature is required'
    }
  },
  isActive: {
    type: Boolean,
    required: [true, 'Active status is required'],
    default: true
  },
  icon: {
    type: String,
    trim: true
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
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ title: 1 });

const Service = mongoose.model<IService>('Service', serviceSchema);

export default Service;

