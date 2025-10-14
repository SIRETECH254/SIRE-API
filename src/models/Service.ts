import mongoose, { Schema } from 'mongoose';
import type { IService } from '../types/index';

const serviceSchema = new Schema<IService>({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true
  },
  category: {
    type: String,
    enum: {
      values: ['web_development', 'mobile_app', 'digital_marketing', 'ui_ux_design', 'consulting', 'other'],
      message: 'Invalid service category'
    },
    default: 'other'
  },
  basePrice: {
    type: Number,
    min: [0, 'Base price cannot be negative']
  },
  features: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
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

serviceSchema.index({ title: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ createdAt: -1 });

const Service = mongoose.model<IService>('Service', serviceSchema);

export default Service;


