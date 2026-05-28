import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, VideoPresets, Track, Participant, ParticipantEvent } from 'livekit-client';
import { fetchLiveKitToken } from '../livekitUtils';

interface Course {
  id: string;
  title: string;
  category?: string;
  description?: string;
  subTeacherName?: string;
  scheduleDescription?: string;
  thumbnail?: string;
}

interface VideoConferenceProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  schoolId?: string;
  courses: Course[];
  isTeacher: boolean;
  assignedCourseIds?: string[];
  supabase?: any;
}

// -------------------------------------------------------------
// ParticipantMediaTile: Renders Video/Audio for a Participant
// -------------------------------------------------------------
const ParticipantMediaTile: React.FC<{
  participant: Participant;
  isLocal: boolean;
  className?: string;
  showName?: boolean;
}> = ({ participant, isLocal, className = '', showName = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoTrack, setVideoTrack] = useState<any>(null);
  const [audioTrack, setAudioTrack] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(participant.isSpeaking);
  const [isCamEnabled, setIsCamEnabled] = useState(participant.isCameraEnabled);
  const [isMicEnabled, setIsMicEnabled] = useState(participant.isMicrophoneEnabled);

  useEffect(() => {
    const updateParticipantTracks = () => {
      setIsCamEnabled(participant.isCameraEnabled);
      setIsMicEnabled(participant.isMicrophoneEnabled);

      let vTrack: any = null;
      let aTrack: any = null;
      participant.trackPublications.forEach((pub) => {
        if (pub.track) {
          if (pub.kind === 'video') vTrack = pub.track;
          if (pub.kind === 'audio') aTrack = pub.track;
        }
      });
      setVideoTrack(vTrack);
      setAudioTrack(aTrack);
    };

    const handleIsSpeaking = (speaking: boolean) => {
      setIsSpeaking(speaking);
    };

    participant.on(ParticipantEvent.TrackSubscribed, updateParticipantTracks);
    participant.on(ParticipantEvent.TrackUnsubscribed, updateParticipantTracks);
    participant.on(ParticipantEvent.TrackPublished, updateParticipantTracks);
    participant.on(ParticipantEvent.TrackUnpublished, updateParticipantTracks);
    participant.on(ParticipantEvent.LocalTrackPublished, updateParticipantTracks);
    participant.on(ParticipantEvent.LocalTrackUnpublished, updateParticipantTracks);
    participant.on(ParticipantEvent.TrackMuted, updateParticipantTracks);
    participant.on(ParticipantEvent.TrackUnmuted, updateParticipantTracks);
    participant.on(ParticipantEvent.IsSpeakingChanged, handleIsSpeaking);

    // Initial state
    updateParticipantTracks();

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, updateParticipantTracks);
      participant.off(ParticipantEvent.TrackUnsubscribed, updateParticipantTracks);
      participant.off(ParticipantEvent.TrackPublished, updateParticipantTracks);
      participant.off(ParticipantEvent.TrackUnpublished, updateParticipantTracks);
      participant.off(ParticipantEvent.LocalTrackPublished, updateParticipantTracks);
      participant.off(ParticipantEvent.LocalTrackUnpublished, updateParticipantTracks);
      participant.off(ParticipantEvent.TrackMuted, updateParticipantTracks);
      participant.off(ParticipantEvent.TrackUnmuted, updateParticipantTracks);
      participant.off(ParticipantEvent.IsSpeakingChanged, handleIsSpeaking);
    };
  }, [participant]);

  const hasVideo = !!videoTrack && isCamEnabled;

  // Bind video track
  useEffect(() => {
    const el = videoRef.current;
    if (el && videoTrack && hasVideo) {
      videoTrack.attach(el);
      return () => {
        videoTrack.detach(el);
      };
    }
  }, [videoTrack, hasVideo]);

  // Bind audio track
  useEffect(() => {
    const el = audioRef.current;
    if (el && audioTrack && !isLocal) {
      audioTrack.attach(el);
      return () => {
        audioTrack.detach(el);
      };
    }
  }, [audioTrack, isLocal]);
  const displayName = participant.name || participant.identity;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative bg-[#0a1a19] rounded-3xl border border-white/10 overflow-hidden flex items-center justify-center group shadow-md aspect-video ${className}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'transform -scale-x-100' : ''}`}
        />
      ) : (
        <div className="text-center space-y-4">
          <div className={`w-14 h-14 rounded-2xl bg-[#1f4e4a] text-slate-100 flex items-center justify-center text-xl font-black border-2 ${isSpeaking ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]' : 'border-white/10'}`}>
            {initials || '?'}
          </div>
          {!showName && (
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Camera Disabled
            </p>
          )}
        </div>
      )}

      {/* Audio element for remote tracks */}
      {!isLocal && audioTrack && <audio ref={audioRef} autoPlay />}

      {/* Speaking / Mute Indicators */}
      <div className="absolute top-4 right-4 flex gap-2">
        {!isMicEnabled && (
          <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center text-xs">
            <i className="fa-solid fa-microphone-slash"></i>
          </div>
        )}
        {isSpeaking && isMicEnabled && (
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs animate-pulse">
            <i className="fa-solid fa-volume-high"></i>
          </div>
        )}
      </div>

      {showName && (
        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-xl text-[9px] font-black text-white uppercase tracking-wider">
          {displayName} {isLocal ? '(You)' : ''}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// MainScreenShare: Renders a Participant's Screen Share Stream
// -------------------------------------------------------------
const MainScreenShare: React.FC<{ participant: Participant }> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [screenTrack, setScreenTrack] = useState<any>(null);

  useEffect(() => {
    const handleTrackSubscribed = (track: any) => {
      if (track.source === Track.Source.ScreenShare) {
        setScreenTrack(track);
      }
    };

    const handleTrackUnsubscribed = (track: any) => {
      if (track.source === Track.Source.ScreenShare) {
        setScreenTrack(null);
      }
    };

    participant.on(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    // Initial check
    participant.trackPublications.forEach((pub) => {
      if (pub.track && pub.source === Track.Source.ScreenShare) {
        setScreenTrack(pub.track);
      }
    });

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
      participant.off(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    };
  }, [participant]);

  useEffect(() => {
    if (videoRef.current && screenTrack) {
      screenTrack.attach(videoRef.current);
      return () => {
        screenTrack.detach(videoRef.current);
      };
    }
  }, [screenTrack]);

  return (
    <div className="absolute inset-0 z-10 bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest">
        <i className="fa-solid fa-desktop text-emerald-400 mr-2"></i>
        {participant.name || participant.identity}'s Screen Share
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// VideoConference Main Component
// -------------------------------------------------------------
export const VideoConference: React.FC<VideoConferenceProps> = ({
  user,
  schoolId,
  courses,
  isTeacher,
  assignedCourseIds,
  supabase
}) => {
  const [activeRoom, setActiveRoom] = useState<Course | null>(null);
  const [activeRoomObj, setActiveRoomObj] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadedCourses, setLoadedCourses] = useState<Course[]>(courses);

  useEffect(() => {
    const fetchCoursesFromDb = async () => {
      if (!supabase || !schoolId) {
        setLoadedCourses(courses);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('class_courses')
          .select('*')
          .eq('school_id', schoolId);

        if (error) {
          console.error('Failed to load courses from DB:', error.message);
          setLoadedCourses(courses);
          return;
        }

        if (data && data.length > 0) {
          const mapped: Course[] = data.map((item: any) => ({
            id: String(item.id),
            title: item.name || 'Unnamed Course',
            category: 'Academic',
            description: item.description || 'No description provided.',
            subTeacherName: item.teacher_name || 'TBA',
            scheduleDescription: item.schedule || 'TBA',
            thumbnail: item.image_url || undefined
          }));
          setLoadedCourses(mapped);
        } else {
          setLoadedCourses(courses);
        }
      } catch (err) {
        console.error('Error fetching courses in VideoConference:', err);
        setLoadedCourses(courses);
      }
    };

    fetchCoursesFromDb();
  }, [supabase, schoolId, courses]);

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Connection-driven Mic/Cam/Screen States
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  // Filter courses based on user assignments if applicable
  const displayCourses = loadedCourses.filter(course => {
    if (user.role === 'admin' || user.role === 'owner' || user.role === 'staff') {
      return true; // Admin can see all courses
    }
    if (assignedCourseIds && assignedCourseIds.length > 0) {
      return assignedCourseIds.includes(course.id);
    }
    return true; // Fallback to all if no specific mapping
  });

  // Sync state helpers
  const updateParticipantsList = (r: Room) => {
    const list = [
      r.localParticipant,
      ...Array.from(r.remoteParticipants.values())
    ];
    setParticipants(list);
  };

  // Handle Joining a Room
  const handleJoinRoom = async (course: Course) => {
    setActiveRoom(course);
    setIsLoadingToken(true);
    setError(null);
    setToken(null);

    const roomId = `room-${course.id}`;
    const userId = user.id || `user-${Math.random().toString(36).substr(2, 9)}`;
    const userName = user.name || 'Anonymous User';

    try {
      const generatedToken = await fetchLiveKitToken(userId, userName, roomId, isTeacher);
      setToken(generatedToken);

      const livekitUrl = import.meta.env.VITE_LIVEKIT_WS_URL || 'ws://localhost:7880';
      const r = new Room({
        publishDefaults: {
          simulcast: true,
          videoEncoding: VideoPresets.h720.encoding,
        },
      });

      r.on(RoomEvent.ParticipantConnected, () => updateParticipantsList(r))
       .on(RoomEvent.ParticipantDisconnected, () => updateParticipantsList(r))
       .on(RoomEvent.TrackPublished, () => updateParticipantsList(r))
       .on(RoomEvent.TrackUnpublished, () => updateParticipantsList(r))
       .on(RoomEvent.LocalTrackPublished, () => updateParticipantsList(r))
       .on(RoomEvent.LocalTrackUnpublished, () => updateParticipantsList(r))
       .on(RoomEvent.ActiveSpeakersChanged, () => {
         // Trigger a visual re-render to update the active speaker view
         setParticipants(prev => [...prev]);
       });

      await r.connect(livekitUrl, generatedToken);
      setActiveRoomObj(r);

      // Auto-publish local tracks
      await r.localParticipant.setCameraEnabled(true);
      await r.localParticipant.setMicrophoneEnabled(true);
      setIsCamEnabled(true);
      setIsMicEnabled(true);

      updateParticipantsList(r);
    } catch (err: any) {
      console.error("Error joining video conference room:", err);
      setError(err.message || "Failed to establish a connection or retrieve token.");
      setActiveRoom(null);
      setActiveRoomObj(null);
    } finally {
      setIsLoadingToken(false);
    }
  };

  // Handle Leaving a Room
  const handleLeaveRoom = () => {
    if (activeRoomObj) {
      try {
        activeRoomObj.disconnect();
      } catch (e) {
        console.error("Error disconnecting room:", e);
      }
    }
    setActiveRoomObj(null);
    setParticipants([]);
    setIsSharingScreen(false);
    setActiveRoom(null);
    setToken(null);
    setError(null);
  };

  useEffect(() => {
    return () => {
      if (activeRoomObj) {
        try {
          activeRoomObj.disconnect();
        } catch (e) {
          console.error("Error disconnecting on unmount:", e);
        }
      }
    };
  }, [activeRoomObj]);

  // Control Toggles
  const toggleMic = async () => {
    if (activeRoomObj) {
      const enabled = activeRoomObj.localParticipant.isMicrophoneEnabled;
      await activeRoomObj.localParticipant.setMicrophoneEnabled(!enabled);
      setIsMicEnabled(!enabled);
    }
  };

  const toggleCam = async () => {
    if (activeRoomObj) {
      const enabled = activeRoomObj.localParticipant.isCameraEnabled;
      await activeRoomObj.localParticipant.setCameraEnabled(!enabled);
      setIsCamEnabled(!enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (activeRoomObj) {
      const enabled = activeRoomObj.localParticipant.isScreenShareEnabled;
      await activeRoomObj.localParticipant.setScreenShareEnabled(!enabled);
      setIsSharingScreen(!enabled);
    }
  };

  // Determine which participant has the screen share active
  const screenSharer = participants.find(p => p.isScreenShareEnabled);

  // Determine who should be in the main focus video area
  const activeFocus = (() => {
    // 1. First remote participant who is speaking and has their camera on
    const speakingRemote = participants.find(p => !p.isLocal && p.isSpeaking && p.isCameraEnabled);
    if (speakingRemote) return speakingRemote;

    // 2. First remote participant with camera on
    const cameraRemote = participants.find(p => !p.isLocal && p.isCameraEnabled);
    if (cameraRemote) return cameraRemote;

    // 3. The teacher/host if they are in the call
    const host = participants.find(p => p.identity.includes('teacher') || p.identity.includes('admin'));
    if (host) return host;

    // 4. Any remote participant
    const anyRemote = participants.find(p => !p.isLocal);
    if (anyRemote) return anyRemote;

    // 5. Fallback to the local participant
    return participants.find(p => p.isLocal);
  })();

  return (
    <div className="space-y-12 animate-fadeIn text-slate-800 pb-20">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Classrooms & Conferences</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">
            {activeRoom ? `Active Room: ${activeRoom.title}` : 'Select a course to join the live session'}
          </p>
        </div>
      </header>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[32px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            <div>
              <p className="font-bold text-sm">Failed to join video conference</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button onClick={handleLeaveRoom} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all">
            Dismiss
          </button>
        </div>
      )}

      {/* COURSE DASHBOARD */}
      {!activeRoom ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayCourses.length > 0 ? (
            displayCourses.map(course => (
              <div
                key={course.id}
                className="bg-white/10 backdrop-blur-2xl p-8 rounded-[40px] border border-white/20 hover:border-[#4ea59d]/40 transition-all duration-300 shadow-xl flex flex-col group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#4ea59d]/10 text-[#4ea59d] flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-graduation-cap"></i>
                  </div>
                  <span className="bg-[#4ea59d]/10 text-[#4ea59d] px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-[#4ea59d]/20">
                    {course.category || 'Course'}
                  </span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 mb-2">{course.title}</h4>
                {course.description && (
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed flex-1 line-clamp-3">
                    {course.description}
                  </p>
                )}
                {course.subTeacherName && (
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Professor: <span className="text-[#4ea59d]">{course.subTeacherName}</span>
                  </p>
                )}
                {course.scheduleDescription && (
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                    <i className="fa-solid fa-clock mr-1.5"></i> {course.scheduleDescription}
                  </p>
                )}

                <button
                  onClick={() => handleJoinRoom(course)}
                  className="w-full py-4 bg-[#4ea59d] text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.03] transition-all shadow-lg shadow-[#4ea59d]/20 flex items-center justify-center gap-2 group-hover:bg-[#3d8c85]"
                >
                  <i className="fa-solid fa-video"></i>
                  Join Meeting
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full p-12 text-center bg-white/10 backdrop-blur-2xl rounded-[40px] border border-dashed border-[#1f4e4a] text-slate-400 font-black uppercase tracking-widest animate-pulse">
              No enrolled or assigned courses found.
            </div>
          )}
        </div>
      ) : (
        /* ACTIVE CONFERENCE ROOM SCREEN */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Video Arena */}
          <div className="xl:col-span-3 space-y-6">
            <div className="relative aspect-video bg-[#0a1a19] rounded-[48px] border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center group animate-fadeIn">
              {/* Screen Share Tile */}
              {screenSharer && (
                <MainScreenShare participant={screenSharer} />
              )}

              {/* Focus Video */}
              {!screenSharer && activeFocus && (
                <ParticipantMediaTile
                  participant={activeFocus}
                  isLocal={activeFocus.isLocal}
                  className="w-full h-full rounded-[48px]"
                  showName={false}
                />
              )}

              {!screenSharer && !activeFocus && (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-[#1f4e4a] flex items-center justify-center text-4xl text-[#4ea59d] mx-auto animate-pulse">
                    <i className="fa-solid fa-video-slash"></i>
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    No active feeds
                  </p>
                </div>
              )}

              {/* Badges / Floating Info */}
              <div className="absolute top-6 left-6 flex gap-3 z-20">
                <span className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  LIVE MEETING
                </span>
                {activeFocus && (activeFocus.identity.includes('teacher') || activeFocus.identity.includes('admin')) && (
                  <span className="px-4 py-2 bg-[#4ea59d] text-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest">
                    FACULTY ROOM OWNER
                  </span>
                )}
              </div>

              {/* Controls Overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 opacity-90 hover:opacity-100 transition-opacity z-20">
                <button
                  onClick={toggleMic}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all ${
                    isMicEnabled
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  title={isMicEnabled ? "Mute Microphone" : "Unmute Microphone"}
                >
                  <i className={`fa-solid ${isMicEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
                </button>

                <button
                  onClick={toggleCam}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all ${
                    isCamEnabled
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  title={isCamEnabled ? "Disable Camera" : "Enable Camera"}
                >
                  <i className={`fa-solid ${isCamEnabled ? 'fa-video' : 'fa-video-slash'}`}></i>
                </button>

                <button
                  onClick={toggleScreenShare}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all ${
                    isSharingScreen
                      ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-600'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isSharingScreen ? "Stop Screen Share" : "Share Screen"}
                >
                  <i className="fa-solid fa-desktop"></i>
                </button>

                <button
                  onClick={() => setShowTokenModal(true)}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-all"
                  title="Inspect LiveKit Access Token"
                >
                  <i className="fa-solid fa-key"></i>
                </button>

                <div className="w-[1px] h-8 bg-white/20 mx-2"></div>

                <button
                  onClick={handleLeaveRoom}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                >
                  <i className="fa-solid fa-phone-slash"></i>
                  Leave
                </button>
              </div>
            </div>

            {/* Sub-grid of other participants */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {participants
                .filter(p => p !== activeFocus)
                .map((p) => (
                  <ParticipantMediaTile
                    key={p.identity}
                    participant={p}
                    isLocal={p.isLocal}
                  />
                ))}
            </div>
          </div>

          {/* Room Side Panel */}
          <div className="space-y-6">
            {/* Connection Information */}
            <section className="bg-white/10 backdrop-blur-2xl p-6 rounded-[36px] border border-white/20 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-signal text-[#4ea59d]"></i> Room Intelligence
              </h3>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Meeting ID</span>
                  <span className="font-mono font-bold text-slate-900 bg-[#efe7da] px-3 py-1 rounded-lg">
                    room-{activeRoom.id}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Token State</span>
                  <span className={`font-bold px-3 py-1 rounded-lg ${token ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500 animate-pulse'}`}>
                    {token ? 'JWT Signed' : 'Signing JWT...'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Participant Count</span>
                  <span className="font-bold text-slate-900">{participants.length} Joined</span>
                </div>
              </div>
            </section>

            {/* Quick Actions / Security */}
            <section className="bg-white/10 backdrop-blur-2xl p-6 rounded-[36px] border border-white/20 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-[#4ea59d]"></i> Faculty Room Policies
              </h3>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-xs">
                  <input type="checkbox" defaultChecked disabled className="rounded text-[#4ea59d] focus:ring-[#4ea59d] bg-transparent" />
                  <span className="text-slate-700 font-semibold">End-to-End Encryption</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <input type="checkbox" defaultChecked={isTeacher} disabled className="rounded text-[#4ea59d] focus:ring-[#4ea59d] bg-transparent" />
                  <span className="text-slate-700 font-semibold">Host Screen Share Authorization</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <input type="checkbox" defaultChecked disabled className="rounded text-[#4ea59d] focus:ring-[#4ea59d] bg-transparent" />
                  <span className="text-slate-700 font-semibold">Lobby Waiting Room Enabled</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* INSPECT TOKEN MODAL */}
      {showTokenModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-3xl bg-[#0a1a19] border border-white/20 rounded-[48px] overflow-hidden shadow-4xl p-10 space-y-8 text-white relative">
            <button
              onClick={() => setShowTokenModal(false)}
              className="absolute top-8 right-8 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="space-y-2">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">LiveKit Access Token</h3>
              <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.4em]">Development Mode Decrypted Signature</p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                This token is a secure JSON Web Token (JWT) signed by the local token server plugin using the API secret in development mode (`devkey` / `secret`). The LiveKit Client SDK requires this token to authenticate with the LiveKit server room.
              </p>
              
              <div className="bg-black/50 p-6 rounded-3xl border border-white/10 font-mono text-[11px] overflow-x-auto text-emerald-400 max-h-60 custom-scrollbar select-all">
                {token || "No token currently signed. Please rejoin the room to generate a signature."}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-white/5 p-6 rounded-3xl border border-white/10 text-slate-300">
                <div>
                  <p className="text-[9px] text-[#4ea59d] uppercase font-black mb-1">Signed API Key</p>
                  <p className="font-mono font-bold">devkey</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#4ea59d] uppercase font-black mb-1">User Identifier</p>
                  <p className="font-mono font-bold">{user.id}</p>
                </div>
                <div className="mt-3">
                  <p className="text-[9px] text-[#4ea59d] uppercase font-black mb-1">Identity Claims</p>
                  <p className="font-mono font-bold">userName: {user.name}</p>
                </div>
                <div className="mt-3">
                  <p className="text-[9px] text-[#4ea59d] uppercase font-black mb-1">Permission Level</p>
                  <p className="font-bold text-white uppercase">{isTeacher ? 'Publish Stream (Teacher)' : 'Viewer Stream (Student)'}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setShowTokenModal(false)}
                className="px-8 py-4 bg-[#4ea59d] text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#4ea59d]/20"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
