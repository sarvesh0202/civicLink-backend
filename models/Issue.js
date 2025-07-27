import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['roads', 'lighting', 'sanitation', 'water', 'electricity', 'parks', 'other']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  address: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open'
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  resolvedProof: {
    imageUrl: String,
    description: String,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Create geospatial index for location queries
issueSchema.index({ location: '2dsphere' });

export default mongoose.model('Issue', issueSchema);