import express from 'express';
import multer from 'multer';
import path from 'path';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import fs from 'fs';
const router = express.Router();
import { fileURLToPath } from 'url';

// Define __dirname manually for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const uploadPath = path.join(__dirname, 'uploads');

// // Ensure directory exists
// if (!fs.existsSync(uploadPath)) {
//   fs.mkdirSync(uploadPath, { recursive: true });
// }
// Configure multer for file uploads
const uploadPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Create new issue
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, latitude, longitude, address } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const issue = new Issue({
      userId: req.userId,
      title,
      description,
      category,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      address,
      imageUrl: `/uploads/${req.file.filename}`
    });

    await issue.save();
    await issue.populate('userId', 'username avatar');

    // Update user's issues reported count and karma
    await User.findByIdAndUpdate(req.userId, {
      $inc: { issuesReported: 1, karma: 10 }
    });

    res.status(201).json({
      message: 'Issue created successfully',
      issue
    });
  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get issues with optional filters
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius = 10, category, status, sortBy = 'createdAt' } = req.query;
    
    let query = {};
    
    // Add location filter if provided
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
        }
      };
    }
    
    // Add category filter
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Add status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Define sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'upvotes':
        sortOptions = { upvotes: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const issues = await Issue.find(query)
      .populate('userId', 'username avatar')
      .sort(sortOptions)
      .limit(100);

    res.json(issues);
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single issue
router.get('/:id', async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('userId', 'username avatar')
      .populate('resolvedProof.resolvedBy', 'username avatar');
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
   console.log(issue);
    res.json(issue);
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upvote issue
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    // Check if user already upvoted
    const hasUpvoted = issue.upvotes.includes(req.userId);
    
    if (hasUpvoted) {
      // Remove upvote
      issue.upvotes = issue.upvotes.filter(id => id.toString() !== req.userId);
      await User.findByIdAndUpdate(issue.userId, { $inc: { karma: -5 } });
    } else {
      // Add upvote
      issue.upvotes.push(req.userId);
      await User.findByIdAndUpdate(issue.userId, { $inc: { karma: 5 } });
    }

    await issue.save();
    await issue.populate('userId', 'username avatar');

    res.json({
      message: hasUpvoted ? 'Upvote removed' : 'Issue upvoted',
      issue
    });
  } catch (error) {
    console.error('Upvote error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resolve issue
// router.post('/:id/resolve', auth, upload.single('proofImage'), async (req, res) => {
//   try {
//     const { description } = req.body;
//     const issue = await Issue.findById(req.params.id);
    
//     if (!issue) {
//       return res.status(404).json({ message: 'Issue not found' });
//     }

//     // Check if user owns the issue or is admin
//     if (issue.userId.toString() !== req.userId) {
//       return res.status(403).json({ message: 'Not authorized' });
//     }

//     issue.status = 'resolved';
//     issue.resolvedProof = {
//       imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
//       description,
//       resolvedAt: new Date(),
//       resolvedBy: req.userId
//     };

//     await issue.save();
//     await issue.populate('userId', 'username avatar');

//     // Update user's resolved count and karma
//     await User.findByIdAndUpdate(req.userId, {
//       $inc: { issuesResolved: 1, karma: 15 }
//     });

//     res.json({
//       message: 'Issue marked as resolved',
//       issue
//     });
//   } catch (error) {
//     console.error('Resolve issue error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });
router.post('/:id/resolve', auth, upload.single('proofImage'), async (req, res) => {
  try {
    const { description } = req.body;
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    //NEW: Allow any authenticated user to resolve issues, not just the reporter
    if (!req.file) {
      return res.status(400).json({ message: 'Proof image is required' });
    }

    issue.status = 'resolved';
    issue.resolvedProof = {
      imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
      description,
      resolvedAt: new Date(),
      resolvedBy: req.userId
    };

    await issue.save();
    await issue.populate('userId', 'username avatar');
    //NEW: Populate resolver information
    await issue.populate('resolvedProof.resolvedBy', 'username avatar');

    //NEW: Give karma points to the resolver, not the reporter
    await User.findByIdAndUpdate(req.userId, {
      $inc: { issuesResolved: 1, karma: 15 }
    });

    res.json({
      message: 'Issue marked as resolved',
      issue
    });
  } catch (error) {
    console.error('Resolve issue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;