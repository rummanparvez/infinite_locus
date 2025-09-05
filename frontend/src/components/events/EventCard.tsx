import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Event } from '../../types';
import { Calendar, MapPin, Users, Clock, Tag, Heart } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const [attendeeCount, setAttendeeCount] = useState(event.stats.approvedRegistrations);
  const [isLiked, setIsLiked] = useState(false);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to real-time updates for this event
    const unsubscribe = subscribe('new-registration', (data: any) => {
      if (data.eventId === event._id) {
        setAttendeeCount(prev => prev + 1);
      }
    });

    const unsubscribeStatus = subscribe('registration-status-updated', (data: any) => {
      if (data.eventId === event._id) {
        setAttendeeCount(data.approvedCount);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [event._id, subscribe]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isEventFull = attendeeCount >= event.registration.maxCapacity;
  const registrationDeadlinePassed = new Date() > new Date(event.registration.deadline);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
      {/* Event Image/Header */}
      <div className="relative h-48 bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="absolute top-4 left-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </span>
        </div>
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full transition-colors ${
              isLiked ? 'bg-red-500 text-white' : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
            }`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="absolute bottom-4 left-4 text-white">
          <h3 className="text-xl font-bold mb-1 line-clamp-2">{event.title}</h3>
          <p className="text-sm opacity-90 line-clamp-1">{event.shortDescription}</p>
        </div>
      </div>

      {/* Event Details */}
      <div className="p-6">
        {/* Date and Time */}
        <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(event.schedule.startDate)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatTime(event.schedule.startDate)}</span>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-center space-x-1 mb-4 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span className="line-clamp-1">{event.venue.name}</span>
        </div>

        {/* Category and Tags */}
        <div className="mb-4">
          <div className="flex items-center space-x-1 mb-2">
            <Tag className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{event.category.name}</span>
          </div>
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs"
                >
                  {tag}
                </span>
              ))}
              {event.tags.length > 3 && (
                <span className="text-xs text-gray-500">+{event.tags.length - 3} more</span>
              )}
            </div>
          )}
        </div>

        {/* Registration Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                <span className="font-medium text-blue-600">{attendeeCount}</span>
                <span className="mx-1">/</span>
                <span>{event.registration.maxCapacity}</span>
                <span className="ml-1">registered</span>
              </span>
            </div>
            {attendeeCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                Live Count
              </span>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((attendeeCount / event.registration.maxCapacity) * 100, 100)}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Registration Status Messages */}
        {isEventFull && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Event is full</p>
          </div>
        )}

        {registrationDeadlinePassed && !isEventFull && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700 font-medium">Registration deadline passed</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Link
            to={`/events/${event._id}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors"
          >
            View Details
          </Link>
          {event.status === 'published' && !isEventFull && !registrationDeadlinePassed && (
            <Link
              to={`/events/${event._id}/register`}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Register
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;