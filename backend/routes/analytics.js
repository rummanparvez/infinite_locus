const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const Department = require('../models/Department');
const Category = require('../models/Category');
const { auth, checkPermission } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case '1y':
        dateFilter = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
        break;
    }

    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalRegistrations = await Registration.countDocuments();

    const recentEvents = await Event.countDocuments({
      createdAt: dateFilter,
      status: 'published'
    });

    const recentRegistrations = await Registration.countDocuments({
      registrationDate: dateFilter
    });

    const recentUsers = await User.countDocuments({
      createdAt: dateFilter,
      isActive: true
    });

    const eventsByStatus = await Event.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const registrationsByStatus = await Registration.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const topCategories = await Event.aggregate([
      { $match: { status: 'published' } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$category',
          name: { $first: '$categoryInfo.name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const topDepartments = await Event.aggregate([
      { $match: { status: 'published', department: { $exists: true } } },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      { $unwind: '$departmentInfo' },
      {
        $group: {
          _id: '$department',
          name: { $first: '$departmentInfo.name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const monthlyTrends = await Event.aggregate([
      { $match: { status: 'published' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          events: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalEvents,
          publishedEvents,
          totalUsers,
          totalRegistrations,
          recentEvents,
          recentRegistrations,
          recentUsers
        },
        distributions: {
          eventsByStatus,
          registrationsByStatus
        },
        rankings: {
          topCategories,
          topDepartments
        },
        trends: {
          monthly: monthlyTrends
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics dashboard',
      error: error.message
    });
  }
});

router.get('/events/:id', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'firstName lastName')
      .populate('category', 'name')
      .populate('department', 'name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registrationStats = await Registration.getRegistrationStats(req.params.id);
    
    const attendanceByDepartment = await Registration.aggregate([
      { $match: { event: mongoose.Types.ObjectId(req.params.id), status: 'attended' } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $lookup: {
          from: 'departments',
          localField: 'userInfo.department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      { $unwind: { path: '$departmentInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$userInfo.department',
          name: { $first: { $ifNull: ['$departmentInfo.name', 'No Department'] } },
          count: { $sum: 1 }
        }
      }
    ]);

    const attendanceByRole = await Registration.aggregate([
      { $match: { event: mongoose.Types.ObjectId(req.params.id), status: 'attended' } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $group: {
          _id: '$userInfo.role',
          count: { $sum: 1 }
        }
      }
    ]);

    const dailyRegistrations = await Registration.aggregate([
      { $match: { event: mongoose.Types.ObjectId(req.params.id) } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$registrationDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        event,
        registrationStats,
        demographics: {
          byDepartment: attendanceByDepartment,
          byRole: attendanceByRole
        },
        trends: {
          dailyRegistrations
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event analytics',
      error: error.message
    });
  }
});

router.get('/users', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const usersByRole = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const usersByDepartment = await User.aggregate([
      { $match: { isActive: true, department: { $exists: true } } },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      { $unwind: '$departmentInfo' },
      {
        $group: {
          _id: '$department',
          name: { $first: '$departmentInfo.name' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const registrationActivity = await Registration.aggregate([
      {
        $group: {
          _id: '$user',
          totalRegistrations: { $sum: 1 },
          attendedEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'attended'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
          role: '$userInfo.role',
          totalRegistrations: 1,
          attendedEvents: 1,
          attendanceRate: {
            $multiply: [
              { $divide: ['$attendedEvents', '$totalRegistrations'] },
              100
            ]
          }
        }
      },
      { $sort: { totalRegistrations: -1 } },
      { $limit: 20 }
    ]);

    const monthlyGrowth = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        demographics: {
          byRole: usersByRole,
          byDepartment: usersByDepartment
        },
        activity: registrationActivity,
        growth: monthlyGrowth
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics',
      error: error.message
    });
  }
});

module.exports = router;