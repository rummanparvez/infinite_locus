import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Event, Registration, ApiResponse, PaginatedResponse } from '../../types';
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock, 
  Plus,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Filter,
  Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    totalRegistrations: 0,
    pendingApprovals: 0,
  });
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOrganizerData();
  }, []);

  const fetchOrganizerData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMyEvents(),
        fetchPendingRegistrations(),
        fetchStats(),
      ]);
    } catch (error) {
      console.error('Error fetching organizer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyEvents = async () => {
    try {
      const response = await api.get<ApiResponse<PaginatedResponse<Event>>>('/events/my-events?type=organized');
      if (response.data.success) {
        setMyEvents(response.data.data.items);
      }
    } catch (error) {
      console.error('Error fetching my events:', error);
    }
  };

  const fetchPendingRegistrations = async () => {
    try {
      const params = new URLSearchParams({
        status: 'pending',
        limit: '50',
        ...(selectedEvent && { eventId: selectedEvent }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await api.get<ApiResponse<PaginatedResponse<Registration>>>(`/registrations?${params}`);
      if (response.data.success) {
        setPendingRegistrations(response.data.data.items);
      }
    } catch (error) {
      console.error('Error fetching pending registrations:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const eventsResponse = await api.get('/events/my-events?type=organized&limit=1000');
      if (eventsResponse.data.success) {
        const events = eventsResponse.data.data.items;
        const publishedEvents = events.filter((e: Event) => e.status === 'published');
        
        setStats({
          totalEvents: events.length,
          publishedEvents: publishedEvents.length,
          totalRegistrations: events.reduce((sum: number, e: Event) => sum + e.stats.totalRegistrations, 0),
          pendingApprovals: events.reduce((sum: number, e: Event) => sum + (e.stats.totalRegistrations - e.stats.approvedRegistrations), 0),
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleApproveRegistration = async (registrationId: string, approved: boolean) => {
    try {
      await api.put(`/registrations/${registrationId}/approve`, {
        approved,
        reason: approved ? 'Approved by organizer' : 'Rejected by organizer'
      });
      
      // Refresh data
      fetchPendingRegistrations();
      fetchStats();
    } catch (error) {
      console.error('Error updating registration:', error);
    }
  };

  const handleBulkApprove = async (approved: boolean) => {
    try {
      const registrationIds = pendingRegistrations.map(r => r._id);
      await api.post('/registrations/bulk-approve', {
        registrationIds,
        approved,
        reason: approved ? 'Bulk approved by organizer' : 'Bulk rejected by organizer'
      });
      
      // Refresh data
      fetchPendingRegistrations();
      fetchStats();
    } catch (error) {
      console.error('Error bulk updating registrations:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organizer Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your events and registrations
              </p>
            </div>
            <Link
              to="/create-event"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Event</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Published Events</p>
                <p className="text-2xl font-bold text-gray-900">{stats.publishedEvents}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRegistrations}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingApprovals}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">My Events</h2>
                <Link
                  to="/my-events"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="p-6">
              {myEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No events created yet</p>
                  <Link
                    to="/create-event"
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {myEvents.slice(0, 5).map((event) => (
                    <div key={event._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(event.schedule.startDate)} • {event.stats.totalRegistrations} registered
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          event.status === 'published' ? 'bg-green-100 text-green-800' :
                          event.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.status}
                        </span>
                        <div className="flex space-x-1">
                          <Link
                            to={`/events/${event._id}`}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/events/${event._id}/edit`}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pending Registrations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Pending Registrations</h2>
                {pendingRegistrations.length > 0 && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleBulkApprove(true)}
                      className="text-sm text-green-600 hover:text-green-800 font-medium"
                    >
                      Approve All
                    </button>
                    <button
                      onClick={() => handleBulkApprove(false)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Reject All
                    </button>
                  </div>
                )}
              </div>
              
              {/* Filters */}
              <div className="mt-4 flex space-x-4">
                <div className="flex-1">
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Events</option>
                    {myEvents.map((event) => (
                      <option key={event._id} value={event._id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search registrations..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={fetchPendingRegistrations}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {pendingRegistrations.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No pending registrations</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {pendingRegistrations.map((registration) => (
                    <div key={registration._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {registration.user.firstName} {registration.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {registration.event.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          Registered: {formatDate(registration.createdAt)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveRegistration(registration._id, true)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <UserCheck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleApproveRegistration(registration._id, false)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;