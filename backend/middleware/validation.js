const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateUser = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['student', 'faculty', 'organizer', 'admin', 'authority', 'hod', 'principal', 'registrar']),
  handleValidationErrors
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateEvent = [
  body('title').trim().notEmpty().withMessage('Event title is required'),
  body('description').trim().notEmpty().withMessage('Event description is required'),
  body('category').isMongoId().withMessage('Valid category is required'),
  body('venue.name').trim().notEmpty().withMessage('Venue name is required'),
  body('schedule.startDate').isISO8601().withMessage('Valid start date is required'),
  body('schedule.endDate').isISO8601().withMessage('Valid end date is required'),
  body('registration.maxCapacity').optional().isInt({ min: 1 }).withMessage('Capacity must be positive'),
  handleValidationErrors
];

const validateRegistration = [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  handleValidationErrors
];

const validateDepartment = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').trim().notEmpty().withMessage('Department code is required'),
  handleValidationErrors
];

const validateCategory = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
  handleValidationErrors
];

const validateNotification = [
  body('title').trim().notEmpty().withMessage('Notification title is required'),
  body('message').trim().notEmpty().withMessage('Notification message is required'),
  body('type').optional().isIn(['info', 'success', 'warning', 'error', 'event', 'registration', 'approval', 'reminder']),
  body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
  handleValidationErrors
];

const validateObjectId = (field = 'id') => [
  param(field).isMongoId().withMessage(`Valid ${field} is required`),
  handleValidationErrors
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

const validateSearch = [
  query('q').optional().trim().isLength({ min: 1 }).withMessage('Search query cannot be empty'),
  query('category').optional().isMongoId().withMessage('Valid category ID required'),
  query('department').optional().isMongoId().withMessage('Valid department ID required'),
  query('status').optional().isIn(['draft', 'pending', 'approved', 'published', 'cancelled', 'completed']),
  handleValidationErrors
];

module.exports = {
  validateUser,
  validateLogin,
  validateEvent,
  validateRegistration,
  validateDepartment,
  validateCategory,
  validateNotification,
  validateObjectId,
  validatePagination,
  validateSearch,
  handleValidationErrors
};