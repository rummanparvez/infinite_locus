# Campus Event Platform API Endpoints

## Base URL
```
https://infinite-locus.onrender.com//api
```

## Authentication Endpoints

### Register User
```
POST /auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@college.edu",
  "password": "password123",
  "role": "student",
  "studentId": "CS2021001",
  "department": "68ba99cb9c32c3e5f2a1a521",
  "year": 3,
  "semester": 5,
  "section": "A",
  "phone": "+1234567890"
}
```

### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john.doe@college.edu",
  "password": "password123"
}
```

### Get Current User
```
GET /auth/me
Authorization: Bearer <token>
```

### Update Profile
```
PUT /auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "bio": "Computer Science student",
  "interests": ["AI", "Web Development"],
  "skills": ["JavaScript", "Python"]
}
```

### Change Password
```
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

## User Management Endpoints

### Get All Users (Admin/Manager)
```
GET /users?page=1&limit=20&role=student&department=departmentId&search=john
Authorization: Bearer <token>
```

### Get User Statistics
```
GET /users/stats
Authorization: Bearer <token>
```

### Get User by ID
```
GET /users/:id
Authorization: Bearer <token>
```

### Update User
```
PUT /users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Updated Name",
  "role": "faculty",
  "isActive": true
}
```

### Bulk User Operations
```
POST /users/bulk-action
Authorization: Bearer <token>
Content-Type: application/json

{
  "userIds": ["userId1", "userId2"],
  "action": "activate", // activate, deactivate, update-role, update-department
  "data": {
    "role": "faculty"
  }
}
```

## Event Management Endpoints

### Get All Events
```
GET /events?page=1&limit=20&category=categoryId&department=departmentId&status=published&search=workshop&upcoming=true
```

### Get My Events
```
GET /events/my-events?type=organized // organized, registered
Authorization: Bearer <token>
```

### Get Event Statistics
```
GET /events/stats
Authorization: Bearer <token>
```

### Get Event by ID
```
GET /events/:id
```

### Create Event
```
POST /events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "AI Workshop",
  "description": "Introduction to Artificial Intelligence",
  "shortDescription": "Learn AI basics",
  "category": "categoryId",
  "department": "departmentId",
  "venue": {
    "name": "Main Auditorium",
    "address": "Building A, Floor 2",
    "capacity": 200,
    "type": "physical"
  },
  "schedule": {
    "startDate": "2024-02-15T10:00:00Z",
    "endDate": "2024-02-15T16:00:00Z"
  },
  "registration": {
    "isRequired": true,
    "maxCapacity": 150,
    "approvalRequired": false,
    "deadline": "2024-02-14T23:59:59Z",
    "allowedRoles": ["student", "faculty"],
    "allowedYears": [2, 3, 4]
  },
  "tags": ["AI", "Workshop", "Technology"]
}
```

### Update Event
```
PUT /events/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Event Title",
  "description": "Updated description"
}
```

### Approve/Reject Event
```
POST /events/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "reason": "Rejection reason if not approved"
}
```

### Delete Event
```
DELETE /events/:id
Authorization: Bearer <token>
```

### Add Comment to Event
```
POST /events/:id/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Great event!",
  "parent": "parentCommentId" // optional for replies
}
```

### Rate Event
```
POST /events/:id/rate
Authorization: Bearer <token>
Content-Type: application/json

{
  "score": 5,
  "review": "Excellent event!",
  "aspects": {
    "organization": 5,
    "content": 4,
    "venue": 5,
    "speakers": 5
  },
  "isAnonymous": false
}
```

## Registration Endpoints

### Register for Event
```
POST /registrations
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventId": "eventId",
  "preferences": {
    "dietary": "Vegetarian",
    "accessibility": "Wheelchair access needed",
    "emergencyContact": {
      "name": "Jane Doe",
      "phone": "+1234567890",
      "relation": "Mother"
    }
  }
}
```

### Get User Registrations
```
GET /registrations?page=1&limit=20&status=approved&eventId=eventId
Authorization: Bearer <token>
```

### Get Event Registrations (Organizer/Admin)
```
GET /registrations/event/:eventId?status=pending&search=john
Authorization: Bearer <token>
```

### Approve/Reject Registration
```
PUT /registrations/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "reason": "Rejection reason if not approved"
}
```

### Mark Attendance
```
PUT /registrations/:id/attendance
Authorization: Bearer <token>
Content-Type: application/json

{
  "present": true,
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

### Cancel Registration
```
DELETE /registrations/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Cannot attend due to conflict"
}
```

### Bulk Approve Registrations
```
POST /registrations/bulk-approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "registrationIds": ["regId1", "regId2"],
  "approved": true,
  "reason": "Bulk rejection reason"
}
```

## Department Management Endpoints

### Get All Departments
```
GET /departments?active=true
```

### Get Department Statistics
```
GET /departments/stats
Authorization: Bearer <token>
```

### Get Department by ID
```
GET /departments/:id
```

### Create Department
```
POST /departments
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Computer Science",
  "code": "CS",
  "description": "Department of Computer Science and Engineering",
  "hod": "userId",
  "building": "Block A",
  "floor": "3rd Floor",
  "contact": {
    "email": "cs@college.edu",
    "phone": "+1234567890",
    "website": "https://cs.college.edu"
  }
}
```

### Update Department
```
PUT /departments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Department Name",
  "hod": "newHodUserId"
}
```

### Add Members to Department
```
POST /departments/:id/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "userIds": ["userId1", "userId2"],
  "role": "faculty"
}
```

### Get Department Members
```
GET /departments/:id/members?role=student&page=1&limit=50
Authorization: Bearer <token>
```

## Category Management Endpoints

### Get All Categories
```
GET /categories?hierarchy=true&active=true
```

### Get Category Statistics
```
GET /categories/stats
Authorization: Bearer <token>
```

### Get Category by ID
```
GET /categories/:id
```

### Create Category
```
POST /categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Technology",
  "description": "Technology related events",
  "icon": "tech-icon",
  "color": "#3B82F6",
  "parent": "parentCategoryId",
  "permissions": {
    "whoCanCreateEvents": ["faculty", "organizer"],
    "requiresApproval": true
  }
}
```

### Update Category
```
PUT /categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Category",
  "color": "#10B981"
}
```

## Notification Endpoints

### Get User Notifications
```
GET /notifications?page=1&limit=20&type=event&priority=high&unread=true
Authorization: Bearer <token>
```

### Send Notification
```
POST /notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Event Reminder",
  "message": "Don't forget about tomorrow's workshop!",
  "type": "reminder",
  "priority": "normal",
  "recipients": ["userId1", "userId2"],
  "scheduledFor": "2024-02-14T09:00:00Z",
  "expiresAt": "2024-02-15T18:00:00Z",
  "metadata": {
    "actionUrl": "/events/eventId",
    "actionText": "View Event"
  }
}
```

### Mark Notification as Read
```
PUT /notifications/:id/read
Authorization: Bearer <token>
```

### Mark All Notifications as Read
```
PUT /notifications/mark-all-read
Authorization: Bearer <token>
```

### Get Notification Statistics
```
GET /notifications/stats
Authorization: Bearer <token>
```

## Analytics Endpoints

### Get Analytics Dashboard
```
GET /analytics/dashboard?period=30d
Authorization: Bearer <token>
```

### Get Event Analytics
```
GET /analytics/events/:id
Authorization: Bearer <token>
```

### Get User Analytics
```
GET /analytics/users
Authorization: Bearer <token>
```

## Report Generation Endpoints

### Generate Events Report
```
GET /reports/events?startDate=2024-01-01&endDate=2024-12-31&department=deptId&category=catId&status=published
Authorization: Bearer <token>
```

### Generate Registrations Report
```
GET /reports/registrations?startDate=2024-01-01&endDate=2024-12-31&eventId=eventId&status=attended
Authorization: Bearer <token>
```

### Generate Attendance Report
```
GET /reports/attendance?startDate=2024-01-01&endDate=2024-12-31&department=deptId
Authorization: Bearer <token>
```

### Generate Users Report
```
GET /reports/users?role=student&department=deptId&active=true
Authorization: Bearer <token>
```

### Generate Departments Report
```
GET /reports/departments
Authorization: Bearer <token>
```

## Feedback Endpoints

### Submit Feedback
```
POST /feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventId": "eventId",
  "type": "event",
  "rating": {
    "overall": 5,
    "content": 4,
    "organization": 5,
    "venue": 4,
    "speakers": 5
  },
  "comments": {
    "liked": "Great speakers and content",
    "improvements": "Better audio system needed",
    "suggestions": "More interactive sessions"
  },
  "isAnonymous": false
}
```

### Get Event Feedback
```
GET /feedback/event/:eventId?page=1&limit=20&type=event
Authorization: Bearer <token>
```

### Get User Feedback
```
GET /feedback?page=1&limit=20&eventId=eventId&status=submitted
Authorization: Bearer <token>
```

### Respond to Feedback
```
PUT /feedback/:id/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "response": "Thank you for your feedback. We'll work on the audio system."
}
```

### Get Feedback Statistics
```
GET /feedback/stats?eventId=eventId&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

## Health Check
```
GET /health
```

## WebSocket Events

Connect to: `ws://localhost:5000`

### Client Events
- `join-event`: Join event room for real-time updates
- `leave-event`: Leave event room

### Server Events
- `new-registration`: New user registered for event
- `registration-status-updated`: Registration approved/rejected
- `event-updated`: Event details updated
- `attendance-marked`: Attendance marked for user
- `new-comment`: New comment added to event
- `event-approval-needed`: Event needs approval
- `event-approval-result`: Event approved/rejected
- `new-notification`: New notification sent

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development)"
}
```

## Success Responses

All endpoints return success responses in this format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

## Authentication

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Pagination

Most list endpoints support pagination:
```
?page=1&limit=20
```

Response includes pagination info:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 100,
      "limit": 20
    }
  }
}
```