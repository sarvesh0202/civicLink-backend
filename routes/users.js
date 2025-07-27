import express from 'express';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userIssues = await Issue.find({ userId: req.params.id })
      .populate('userId', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({
      user,
      issues: userIssues
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ karma: -1 })
      .limit(20);

    res.json(users);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user stats
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    const totalIssues = await Issue.countDocuments({ userId: req.userId });
    const resolvedIssues = await Issue.countDocuments({ 
      userId: req.userId, 
      status: 'resolved' 
    });
    const totalUpvotes = await Issue.aggregate([
      { $match: { userId: req.userId } },
      { $project: { upvoteCount: { $size: '$upvotes' } } },
      { $group: { _id: null, total: { $sum: '$upvoteCount' } } }
    ]);

    res.json({
      user,
      stats: {
        totalIssues,
        resolvedIssues,
        totalUpvotes: totalUpvotes[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;