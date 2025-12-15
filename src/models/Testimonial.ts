import mongoose, { Schema } from 'mongoose';
import type { ITestimonial } from '../types/index';

const testimonialSchema = new Schema<ITestimonial>({
  client: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required']
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
testimonialSchema.index({ client: 1 });
testimonialSchema.index({ project: 1 });
testimonialSchema.index({ isApproved: 1 });
testimonialSchema.index({ isPublished: 1 });
testimonialSchema.index({ rating: 1 });

// Compound index for published testimonials
testimonialSchema.index({ isPublished: 1, isApproved: 1 });

const Testimonial = mongoose.model<ITestimonial>('Testimonial', testimonialSchema);

export default Testimonial;

