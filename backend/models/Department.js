const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 1000
  },
  hod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  faculty: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  building: {
    type: String,
    trim: true
  },
  floor: {
    type: String,
    trim: true
  },
  contact: {
    email: String,
    phone: String,
    website: String
  },
  established: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  programs: [{
    name: String,
    degree: {
      type: String,
      enum: ['UG', 'PG', 'PhD', 'Diploma', 'Certificate']
    },
    duration: Number,
    seats: Number
  }],
  facilities: [String],
  achievements: [{
    title: String,
    description: String,
    date: Date,
    type: {
      type: String,
      enum: ['award', 'recognition', 'milestone', 'accreditation']
    }
  }],
  statistics: {
    totalStudents: {
      type: Number,
      default: 0
    },
    totalFaculty: {
      type: Number,
      default: 0
    },
    eventsOrganized: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

departmentSchema.virtual('events', {
  ref: 'Event',
  localField: '_id',
  foreignField: 'department'
});

departmentSchema.virtual('studentCount').get(function() {
  return this.students ? this.students.length : 0;
});

departmentSchema.virtual('facultyCount').get(function() {
  return this.faculty ? this.faculty.length : 0;
});

departmentSchema.methods.updateStatistics = async function() {
  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  
  const studentCount = await User.countDocuments({ 
    department: this._id, 
    role: 'student' 
  });
  
  const facultyCount = await User.countDocuments({ 
    department: this._id, 
    role: { $in: ['faculty', 'hod'] } 
  });
  
  const eventsCount = await Event.countDocuments({ 
    department: this._id 
  });
  
  this.statistics.totalStudents = studentCount;
  this.statistics.totalFaculty = facultyCount;
  this.statistics.eventsOrganized = eventsCount;
  
  return this.save();
};

departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ hod: 1 });

module.exports = mongoose.model('Department', departmentSchema);