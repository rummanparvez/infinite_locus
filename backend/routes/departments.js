const express = require('express');
const Department = require('../models/Department');
const User = require('../models/User');
const { auth, authorize, checkPermission } = require('../middleware/auth');
const { validateDepartment, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { active = true } = req.query;
    const filter = {};
    
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    const departments = await Department.find(filter)
      .populate('hod', 'firstName lastName email')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { departments }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
});

router.get('/stats', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const stats = await Department.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'department',
          as: 'users'
        }
      },
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: 'department',
          as: 'events'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          studentCount: {
            $size: {
              $filter: {
                input: '$users',
                cond: { $eq: ['$$this.role', 'student'] }
              }
            }
          },
          facultyCount: {
            $size: {
              $filter: {
                input: '$users',
                cond: { $in: ['$$this.role', ['faculty', 'hod']] }
              }
            }
          },
          eventCount: { $size: '$events' },
          totalUsers: { $size: '$users' }
        }
      }
    ]);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department statistics',
      error: error.message
    });
  }
});

router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('hod', 'firstName lastName email phone')
      .populate('faculty', 'firstName lastName email')
      .populate('events');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    await department.updateStatistics();

    res.json({
      success: true,
      data: { department }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
      error: error.message
    });
  }
});

router.post('/', auth, checkPermission('manage_departments'), validateDepartment, async (req, res) => {
  try {
    const department = new Department(req.body);
    await department.save();

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Department name or code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: error.message
    });
  }
});

router.put('/:id', auth, checkPermission('manage_departments'), validateObjectId('id'), async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('hod', 'firstName lastName email');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: error.message
    });
  }
});

router.delete('/:id', auth, authorize('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const userCount = await User.countDocuments({ department: req.params.id });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with existing users'
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: error.message
    });
  }
});

router.post('/:id/members', auth, checkPermission('manage_departments'), validateObjectId('id'), async (req, res) => {
  try {
    const { userIds, role } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const updateData = { department: req.params.id };
    if (role) updateData.role = role;

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updateData }
    );

    await department.updateStatistics();

    res.json({
      success: true,
      message: 'Members added to department successfully',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add members to department',
      error: error.message
    });
  }
});

router.get('/:id/members', auth, validateObjectId('id'), async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { department: req.params.id, isActive: true };
    if (role) filter.role = role;

    const members = await User.find(filter)
      .select('firstName lastName email role studentId employeeId year section')
      .sort({ role: 1, firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department members',
      error: error.message
    });
  }
});

module.exports = router;