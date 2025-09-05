const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, checkPermission } = require('../middleware/auth');

const router = express.Router();

router.get('/events', auth, checkPermission('generate_reports'), async (req, res) => {
  try {
    const { startDate, endDate, department, category, status, format = 'json' } = req.query;
    
    const filter = {};
    
    if (startDate || endDate) {
      filter['schedule.startDate'] = {};
      if (startDate) filter['schedule.startDate'].$gte = new Date(startDate);
      if (endDate) filter['schedule.startDate'].$lte = new Date(endDate);
    }
    
    if (department) filter.department = department;
    if (category) filter.category = category;
    if (status) filter.status = status;

    const events = await Event.find(filter)
      .populate('organizer', 'firstName lastName email')
      .populate('category', 'name')
      .populate('department', 'name code')
      .sort({ 'schedule.startDate': -1 });

    const eventsWithStats = await Promise.all(events.map(async (event) => {
      const registrationStats = await Registration.getRegistrationStats(event._id);
      return {
        ...event.toObject(),
        registrationStats
      };
    }));

    const summary = {
      totalEvents: events.length,
      totalRegistrations: eventsWithStats.reduce((sum, event) => sum + event.registrationStats.total, 0),
      totalAttendees: eventsWithStats.reduce((sum, event) => sum + event.registrationStats.attended, 0),
      averageAttendanceRate: eventsWithStats.length > 0 
        ? eventsWithStats.reduce((sum, event) => {
            const rate = event.registrationStats.total > 0 
              ? (event.registrationStats.attended / event.registrationStats.total) * 100 
              : 0;
            return sum + rate;
          }, 0) / eventsWithStats.length 
        : 0
    };

    res.json({
      success: true,
      data: {
        summary,
        events: eventsWithStats,
        generatedAt: new Date(),
        filters: { startDate, endDate, department, category, status }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate events report',
      error: error.message
    });
  }
});

router.get('/registrations', auth, checkPermission('generate_reports'), async (req, res) => {
  try {
    const { startDate, endDate, eventId, status, department } = req.query;
    
    const filter = {};
    
    if (startDate || endDate) {
      filter.registrationDate = {};
      if (startDate) filter.registrationDate.$gte = new Date(startDate);
      if (endDate) filter.registrationDate.$lte = new Date(endDate);
    }
    
    if (eventId) filter.event = eventId;
    if (status) filter.status = status;

    let pipeline = [
      { $match: filter },
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
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventInfo'
        }
      },
      { $unwind: '$eventInfo' }
    ];

    if (department) {
      pipeline.push({
        $match: { 'userInfo.department': mongoose.Types.ObjectId(department) }
      });
    }

    pipeline.push({
      $lookup: {
        from: 'departments',
        localField: 'userInfo.department',
        foreignField: '_id',
        as: 'departmentInfo'
      }
    });

    const registrations = await Registration.aggregate(pipeline);

    const summary = {
      totalRegistrations: registrations.length,
      byStatus: registrations.reduce((acc, reg) => {
        acc[reg.status] = (acc[reg.status] || 0) + 1;
        return acc;
      }, {}),
      byDepartment: registrations.reduce((acc, reg) => {
        const deptName = reg.departmentInfo[0]?.name || 'No Department';
        acc[deptName] = (acc[deptName] || 0) + 1;
        return acc;
      }, {}),
      byRole: registrations.reduce((acc, reg) => {
        acc[reg.userInfo.role] = (acc[reg.userInfo.role] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        summary,
        registrations,
        generatedAt: new Date(),
        filters: { startDate, endDate, eventId, status, department }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate registrations report',
      error: error.message
    });
  }
});

router.get('/attendance', auth, checkPermission('generate_reports'), async (req, res) => {
  try {
    const { startDate, endDate, eventId, department } = req.query;
    
    let eventFilter = { status: 'published' };
    
    if (startDate || endDate) {
      eventFilter['schedule.startDate'] = {};
      if (startDate) eventFilter['schedule.startDate'].$gte = new Date(startDate);
      if (endDate) eventFilter['schedule.startDate'].$lte = new Date(endDate);
    }
    
    if (eventId) eventFilter._id = mongoose.Types.ObjectId(eventId);
    if (department) eventFilter.department = mongoose.Types.ObjectId(department);

    const attendanceData = await Event.aggregate([
      { $match: eventFilter },
      {
        $lookup: {
          from: 'registrations',
          localField: '_id',
          foreignField: 'event',
          as: 'registrations'
        }
      },
      {
        $project: {
          title: 1,
          'schedule.startDate': 1,
          totalRegistrations: { $size: '$registrations' },
          attendedCount: {
            $size: {
              $filter: {
                input: '$registrations',
                cond: { $eq: ['$$this.status', 'attended'] }
              }
            }
          },
          absentCount: {
            $size: {
              $filter: {
                input: '$registrations',
                cond: { $eq: ['$$this.status', 'absent'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          attendanceRate: {
            $cond: [
              { $gt: ['$totalRegistrations', 0] },
              { $multiply: [{ $divide: ['$attendedCount', '$totalRegistrations'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { 'schedule.startDate': -1 } }
    ]);

    const summary = {
      totalEvents: attendanceData.length,
      totalRegistrations: attendanceData.reduce((sum, event) => sum + event.totalRegistrations, 0),
      totalAttended: attendanceData.reduce((sum, event) => sum + event.attendedCount, 0),
      totalAbsent: attendanceData.reduce((sum, event) => sum + event.absentCount, 0),
      averageAttendanceRate: attendanceData.length > 0 
        ? attendanceData.reduce((sum, event) => sum + event.attendanceRate, 0) / attendanceData.length 
        : 0
    };

    res.json({
      success: true,
      data: {
        summary,
        events: attendanceData,
        generatedAt: new Date(),
        filters: { startDate, endDate, eventId, department }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report',
      error: error.message
    });
  }
});

router.get('/users', auth, checkPermission('generate_reports'), async (req, res) => {
  try {
    const { role, department, active, startDate, endDate } = req.query;
    
    const filter = {};
    
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (active !== undefined) filter.isActive = active === 'true';
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const users = await User.find(filter)
      .populate('department', 'name code')
      .select('-password')
      .sort({ createdAt: -1 });

    const userActivity = await Registration.aggregate([
      {
        $group: {
          _id: '$user',
          totalRegistrations: { $sum: 1 },
          attendedEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'attended'] }, 1, 0] }
          },
          lastActivity: { $max: '$registrationDate' }
        }
      }
    ]);

    const activityMap = userActivity.reduce((acc, activity) => {
      acc[activity._id.toString()] = activity;
      return acc;
    }, {});

    const usersWithActivity = users.map(user => ({
      ...user.toObject(),
      activity: activityMap[user._id.toString()] || {
        totalRegistrations: 0,
        attendedEvents: 0,
        lastActivity: null
      }
    }));

    const summary = {
      totalUsers: users.length,
      byRole: users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {}),
      byDepartment: users.reduce((acc, user) => {
        const deptName = user.department?.name || 'No Department';
        acc[deptName] = (acc[deptName] || 0) + 1;
        return acc;
      }, {}),
      activeUsers: users.filter(user => user.isActive).length,
      inactiveUsers: users.filter(user => !user.isActive).length
    };

    res.json({
      success: true,
      data: {
        summary,
        users: usersWithActivity,
        generatedAt: new Date(),
        filters: { role, department, active, startDate, endDate }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate users report',
      error: error.message
    });
  }
});

router.get('/departments', auth, checkPermission('generate_reports'), async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate('hod', 'firstName lastName email')
      .sort({ name: 1 });

    const departmentStats = await Promise.all(departments.map(async (dept) => {
      const studentCount = await User.countDocuments({ 
        department: dept._id, 
        role: 'student', 
        isActive: true 
      });
      
      const facultyCount = await User.countDocuments({ 
        department: dept._id, 
        role: { $in: ['faculty', 'hod'] }, 
        isActive: true 
      });
      
      const eventCount = await Event.countDocuments({ 
        department: dept._id, 
        status: 'published' 
      });
      
      const registrationCount = await Registration.countDocuments({
        event: { 
          $in: await Event.find({ department: dept._id }).distinct('_id') 
        }
      });

      return {
        ...dept.toObject(),
        statistics: {
          students: studentCount,
          faculty: facultyCount,
          events: eventCount,
          registrations: registrationCount
        }
      };
    }));

    const summary = {
      totalDepartments: departments.length,
      totalStudents: departmentStats.reduce((sum, dept) => sum + dept.statistics.students, 0),
      totalFaculty: departmentStats.reduce((sum, dept) => sum + dept.statistics.faculty, 0),
      totalEvents: departmentStats.reduce((sum, dept) => sum + dept.statistics.events, 0),
      totalRegistrations: departmentStats.reduce((sum, dept) => sum + dept.statistics.registrations, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        departments: departmentStats,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate departments report',
      error: error.message
    });
  }
});

module.exports = router;