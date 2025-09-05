import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Event, Registration, ApiResponse } from '../../types';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  Tag, 
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Share2,
  Heart,
  MessageCircle
} from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import api from '../../services/api';

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    dietary: '',
    accessibility: '',
    emergencyContact: {
      name: '',
      phone: '',
      relation: ''
    }
  });
  const { subscribe, joinEvent, leaveEvent } = useWebSocket();

  useEffect(() => {
    if (id) {
      fetchEvent();
      fetchRegistration();
      joinEvent(id);
    }

    return () => {
      if (id) {
        leaveEvent(id);
      }
    };
  }, [id]);

  useEffect(() => {
    if (!event) return;

    setAttendeeCount(event.stats.approvedRegistrations);

    // Subscribe to real-time updates
    const unsubscribe = subscribe('new-registration', (data: any) => {
      if (data.eventId === event._id) {
        setAttendeeCount(prev => prev + 1);
      }
    });

    const unsubscribeStatus = subscribe('registration-status-updated', (data: any) => {
      if (data.eventId === event._id) {
        setAttendeeCount(data.approvedCount);
        if (data.userId === user?._id) {
          fetchRegistration();
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [event, user, subscribe]);

  const fetchEvent = async () => {
    try {
      const response = await api.get<ApiResponse<Event>>(`/events/${id}`);
      if (response.data.success) {
        setEvent(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistration = async () => {
    try {
      const response = await api.get<ApiResponse<{ items: Registration[] }>>(`/registrations?eventId=${id}`);
      if (response.data.success && response.data.data.items.length > 0) {
        setRegistration(response.data.data.items[0]);
      }
    } catch (error) {
      console.error('Error fetching registration:', error);
    }
  };

  const handleRegister = async () => {
    if (!event) return;

    setRegistering(true);
    try {
      const response = await api.post<ApiResponse<Registration>>('/registrations', {
        eventId: event._id,
        preferences: {
          dietary: registrationData.dietary || undefined,
          accessibility: registrationData.accessibility || undefined,
          emergencyContact: registrationData.emergencyContact.name ? registrationData.emergencyContact : undefined
        }
      });

      if (response.data.success) {
        setRegistration(response.data.data);
        setShowRegistrationForm(false);
        // Reset form
        setRegistrationData({
          dietary: '',
          accessibility: '',
          emergencyContact: { name: '', phone: '', relation: '' }
        });
      }
    } catch (error) {
      console.error('Error registering for event:', error);
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!registration) return;

    try {
      await api.delete(`/registrations/${registration._id}`, {
        data: { reason: 'User cancelled registration' }
      });
      setRegistration(null);
    } catch (error) {
      console.error('Error cancelling registration:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'attended':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const isEventFull = attendeeCount >= (event?.registration.maxCapacity || 0);
  const registrationDeadlinePassed = event ? new Date() > new Date(event.registration.deadline) : false;
  const canRegister = event?.status === 'published' && !isEventFull && !registrationDeadlinePassed && !registration;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
          <Link to="/events" className="text-blue-600 hover:text-blue-800">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`p-2 rounded-full transition-colors ${
                  isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="relative h-64 bg-gradient-to-br from-blue-500 to-purple-600">
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <div className="flex items-center space-x-2 mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white bg-opacity-20 text-white">
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white bg-opacity-20 text-white">
                  {event.category.name}
                </span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
              <p className="text-lg opacity-90">{event.shortDescription}</p>
            </div>
          </div>

          <div className="p-6">
            {/* Event Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date & Time</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(event.schedule.startDate)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatTime(event.schedule.startDate)} - {formatTime(event.schedule.endDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Venue</p>
                    <p className="font-medium text-gray-900">{event.venue.name}</p>
                    <p className="text-sm text-gray-600">{event.venue.address}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Attendance</p>
                    <p className="font-medium text-gray-900">
                      <span className="text-blue-600">{attendeeCount}</span> / {event.registration.maxCapacity} registered
                    </p>
                    <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min((attendeeCount / event.registration.maxCapacity) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <User className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Organizer</p>
                    <p className="font-medium text-gray-900">
                      {event.organizer.firstName} {event.organizer.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{event.organizer.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Status */}
            {registration && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      registration.status === 'approved' ? 'bg-green-100' :
                      registration.status === 'pending' ? 'bg-yellow-100' :
                      registration.status === 'rejected' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      {registration.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {registration.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                      {registration.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Registration Status</p>
                      <p className={`text-sm ${
                        registration.status === 'approved' ? 'text-green-600' :
                        registration.status === 'pending' ? 'text-yellow-600' :
                        registration.status === 'rejected' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                      </p>
                    </div>
                  </div>
                  {registration.status === 'pending' && (
                    <button
                      onClick={handleCancelRegistration}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Cancel Registration
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4">
              {canRegister && (
                <button
                  onClick={() => setShowRegistrationForm(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  Register for Event
                </button>
              )}
              
              {isEventFull && !registration && (
                <div className="flex-1 bg-red-100 text-red-700 py-3 px-6 rounded-lg font-medium text-center">
                  Event is Full
                </div>
              )}

              {registrationDeadlinePassed && !registration && (
                <div className="flex-1 bg-yellow-100 text-yellow-700 py-3 px-6 rounded-lg font-medium text-center">
                  Registration Closed
                </div>
              )}

              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors flex items-center space-x-2">
                <MessageCircle className="h-4 w-4" />
                <span>Comments</span>
              </button>
            </div>
          </div>
        </div>

        {/* Event Description */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About This Event</h2>
          <div className="prose max-w-none text-gray-700">
            <p>{event.description}</p>
          </div>

          {/* Tags */}
          {event.tags.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Registration Requirements */}
        {event.registration.isRequired && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Registration Requirements</h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-700">
                  Registration deadline: {formatDate(event.registration.deadline)}
                </span>
              </div>
              {event.registration.approvalRequired && (
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-gray-700">
                    Registration requires approval from organizer
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700">
                  Open to: {event.registration.allowedRoles.join(', ')}
                </span>
              </div>
              {event.registration.allowedYears.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-gray-700">
                    Year restrictions: {event.registration.allowedYears.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Registration Form Modal */}
      {showRegistrationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Register for Event</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dietary Requirements (Optional)
                  </label>
                  <input
                    type="text"
                    value={registrationData.dietary}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, dietary: e.target.value }))}
                    placeholder="e.g., Vegetarian, Vegan, Allergies"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accessibility Requirements (Optional)
                  </label>
                  <input
                    type="text"
                    value={registrationData.accessibility}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, accessibility: e.target.value }))}
                    placeholder="e.g., Wheelchair access, Sign language"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact (Optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={registrationData.emergencyContact.name}
                      onChange={(e) => setRegistrationData(prev => ({ 
                        ...prev, 
                        emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                      }))}
                      placeholder="Contact Name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="tel"
                      value={registrationData.emergencyContact.phone}
                      onChange={(e) => setRegistrationData(prev => ({ 
                        ...prev, 
                        emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                      }))}
                      placeholder="Contact Phone"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={registrationData.emergencyContact.relation}
                      onChange={(e) => setRegistrationData(prev => ({ 
                        ...prev, 
                        emergencyContact: { ...prev.emergencyContact, relation: e.target.value }
                      }))}
                      placeholder="Relationship (e.g., Parent, Sibling)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowRegistrationForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {registering ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetail;