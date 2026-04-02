import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../src/supabaseClient';

interface MessagesOversightProps {
  schoolId: string;
}

interface ConversationSummary {
  id: string;               // unique key = sorted IDs or group id
  kind: 'dm' | 'group';
  name: string;             // "Alice → Bob" or group name
  participantAvatars: string[];
  participantNames: string[];
  lastMessage: string;
  lastMessageAt: string;
  lastSenderName: string;
  messageCount: number;
  isGroup?: boolean;
  groupId?: string;
}

interface MessageRecord {
  id: string;
  sender_id: string;
  receiver_id?: string | null;
  group_id?: string | null;
  content: string;
  created_at: string;
  read_at?: string | null;
  school_id: string;
}

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const MessagesOversight: React.FC<MessagesOversightProps> = ({ schoolId }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allMessages, setAllMessages] = useState<MessageRecord[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null);
  const [convMessages, setConvMessages] = useState<MessageRecord[]>([]);
  const [filterRole, setFilterRole] = useState<'all' | 'teacher' | 'student' | 'student_service'>('all');
  const [filterKind, setFilterKind] = useState<'all' | 'dm' | 'group'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadAll();
  }, [schoolId]);

  const loadAll = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const [teachersRes, studentsRes, servicesRes, messagesRes, groupsRes, membersRes] = await Promise.all([
        supabase.from('teachers').select('id, name, avatar').eq('school_id', schoolId),
        supabase.from('students').select('id, name, avatar').eq('school_id', schoolId),
        supabase.from('student_services').select('id, name, avatar').eq('school_id', schoolId),
        supabase.from('messages').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('message_groups').select('*').eq('school_id', schoolId),
        supabase.from('message_group_members').select('*'),
      ]);

      const users: UserProfile[] = [
        ...(teachersRes.data || []).map((t: any) => ({ ...t, role: 'teacher' })),
        ...(studentsRes.data || []).map((s: any) => ({ ...s, role: 'student' })),
        ...(servicesRes.data || []).map((sv: any) => ({ ...sv, role: 'student_service' })),
      ];
      setAllUsers(users);
      setAllMessages(messagesRes.data || []);
      setGroups(groupsRes.data || []);
      setGroupMembers(membersRes.data || []);
    } catch (err) {
      console.error('MessagesOversight loadAll:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const userMap = useMemo(() => {
    const m: Record<string, UserProfile> = {};
    for (const u of allUsers) m[u.id] = u;
    return m;
  }, [allUsers]);

  const getUserName = (id: string) => userMap[id]?.name || id;
  const getUserAvatar = (id: string) =>
    userMap[id]?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserName(id))}&background=4ea59d&color=fff`;

  // Build conversation summaries
  const conversations: ConversationSummary[] = useMemo(() => {
    const convMap: Record<string, ConversationSummary> = {};

    // DM conversations
    for (const msg of allMessages) {
      if (msg.group_id) continue; // handled separately
      if (!msg.receiver_id) continue;
      const pair = [msg.sender_id, msg.receiver_id].sort().join('__');
      if (!convMap[pair]) {
        const nameA = getUserName(msg.sender_id);
        const nameB = getUserName(msg.receiver_id);
        convMap[pair] = {
          id: pair,
          kind: 'dm',
          name: `${nameA} ↔ ${nameB}`,
          participantAvatars: [getUserAvatar(msg.sender_id), getUserAvatar(msg.receiver_id)],
          participantNames: [nameA, nameB],
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          lastSenderName: getUserName(msg.sender_id),
          messageCount: 1,
        };
      } else {
        convMap[pair].messageCount++;
        if (new Date(msg.created_at) > new Date(convMap[pair].lastMessageAt)) {
          convMap[pair].lastMessage = msg.content;
          convMap[pair].lastMessageAt = msg.created_at;
          convMap[pair].lastSenderName = getUserName(msg.sender_id);
        }
      }
    }

    // Group conversations
    for (const grp of groups) {
      const grpMessages = allMessages.filter(m => m.group_id === grp.id);
      const members = groupMembers.filter(m => m.group_id === grp.id);
      const lastMsg = grpMessages[0];
      convMap[`grp:${grp.id}`] = {
        id: `grp:${grp.id}`,
        kind: 'group',
        name: grp.name,
        participantAvatars: members.slice(0, 4).map((m: any) => m.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user_name)}&background=4ea59d&color=fff`),
        participantNames: members.map((m: any) => m.user_name),
        lastMessage: lastMsg?.content || 'No messages yet',
        lastMessageAt: lastMsg?.created_at || grp.created_at,
        lastSenderName: lastMsg ? getUserName(lastMsg.sender_id) : grp.name,
        messageCount: grpMessages.length,
        isGroup: true,
        groupId: grp.id,
      };
    }

    return Object.values(convMap).sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [allMessages, groups, groupMembers, userMap]);

  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (filterKind !== 'all') result = result.filter(c => c.kind === filterKind);
    if (filterRole !== 'all') result = result.filter(c =>
      c.participantNames.some(name => {
        const user = allUsers.find(u => u.name === name);
        return user?.role === filterRole;
      })
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.participantNames.some(n => n.toLowerCase().includes(q)) ||
        c.lastMessage.toLowerCase().includes(q)
      );
    }
    return result;
  }, [conversations, filterKind, filterRole, searchQuery, allUsers]);

  const openConversation = (conv: ConversationSummary) => {
    setActiveConv(conv);
    if (conv.kind === 'dm') {
      const [idA, idB] = conv.id.split('__');
      const msgs = allMessages
        .filter(m => !m.group_id && ((m.sender_id === idA && m.receiver_id === idB) || (m.sender_id === idB && m.receiver_id === idA)))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setConvMessages(msgs);
    } else {
      const gid = conv.groupId!;
      const msgs = allMessages
        .filter(m => m.group_id === gid)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setConvMessages(msgs);
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const totalMessages = allMessages.length;
  const totalConversations = conversations.length;
  const totalGroups = groups.length;
  const unreadCount = allMessages.filter(m => !m.read_at && m.receiver_id).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-comments text-brand-500"></i> Message Oversight
          </h2>
          <p className="text-slate-400 text-sm mt-1 dark:text-slate-500">Monitor all platform communications across the school</p>
        </div>
        <button
          onClick={() => void loadAll()}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-500 hover:bg-brand-500 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
        >
          <i className="fas fa-rotate-right"></i> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: totalMessages, icon: 'fa-envelope', color: 'text-brand-500 bg-brand-500/10' },
          { label: 'Conversations', value: totalConversations, icon: 'fa-comments', color: 'text-purple-500 bg-purple-500/10' },
          { label: 'Group Chats', value: totalGroups, icon: 'fa-user-group', color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Unread', value: unreadCount, icon: 'fa-bell', color: 'text-rose-500 bg-rose-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <i className={`fas ${stat.icon} text-sm`}></i>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{isLoading ? '…' : stat.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Panel */}
      <div className="flex bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-premium overflow-hidden" style={{ height: '640px' }}>

        {/* ── Left: Conversation List ── */}
        <div className="w-80 border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xs"></i>
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'dm', 'group'] as const).map(k => (
                <button key={k} onClick={() => setFilterKind(k)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filterKind === k ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {k === 'all' ? 'All' : k === 'dm' ? 'Direct' : 'Groups'}
                </button>
              ))}
              <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5 self-stretch"></div>
              {(['all', 'teacher', 'student', 'student_service'] as const).map(r => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filterRole === r ? 'bg-purple-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {r === 'all' ? 'All roles' : r === 'student_service' ? 'Services' : r}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">Loading...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-40 px-4 text-center">
                <i className="fas fa-comments text-3xl mb-2 text-slate-400"></i>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isActive = activeConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 p-4 border-b border-slate-50 dark:border-slate-800 transition-all text-left ${isActive ? 'bg-brand-500/5 border-l-4 border-l-brand-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    {/* Avatar stack */}
                    <div className="relative shrink-0 w-11 h-11">
                      {conv.kind === 'group' ? (
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                          <i className="fas fa-users text-indigo-500 text-sm"></i>
                        </div>
                      ) : (
                        <>
                          <img src={conv.participantAvatars[0]} className="w-8 h-8 rounded-lg object-cover absolute top-0 left-0 border-2 border-white dark:border-slate-900" alt="" />
                          <img src={conv.participantAvatars[1]} className="w-7 h-7 rounded-lg object-cover absolute bottom-0 right-0 border-2 border-white dark:border-slate-900" alt="" />
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-1">
                        <h4 className={`text-xs font-black truncate ${isActive ? 'text-brand-500' : 'text-slate-700 dark:text-white'}`}>{conv.name}</h4>
                        <span className="text-[8px] font-bold text-slate-400 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        <span className="font-bold text-slate-500">{conv.lastSenderName.split(' ')[0]}:</span>{' '}
                        {conv.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${conv.kind === 'group' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-brand-500/10 text-brand-600'}`}>
                          {conv.kind === 'group' ? 'Group' : 'Direct'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400">{conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}</span>
                        {conv.kind === 'group' && (
                          <span className="text-[8px] font-bold text-slate-400">{conv.participantNames.length} members</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
              {filteredConversations.length} of {conversations.length} conversations
            </p>
          </div>
        </div>

        {/* ── Right: Message Thread ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  {activeConv.kind === 'group' ? (
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                      <i className="fas fa-users text-indigo-500"></i>
                    </div>
                  ) : (
                    <div className="flex -space-x-2">
                      {activeConv.participantAvatars.slice(0, 2).map((av, i) => (
                        <img key={i} src={av} className="w-9 h-9 rounded-xl object-cover border-2 border-white dark:border-slate-900" alt="" />
                      ))}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">{activeConv.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {activeConv.kind === 'group'
                        ? `${activeConv.participantNames.length} members · ${activeConv.messageCount} messages`
                        : `${activeConv.messageCount} messages`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activeConv.kind === 'group' && (
                    <div className="text-right hidden md:block">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Members</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                        {activeConv.participantNames.join(', ')}
                      </p>
                    </div>
                  )}
                  <button onClick={() => setActiveConv(null)}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                    <i className="fas fa-xmark text-sm"></i>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {convMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30">
                    <i className="fas fa-message text-4xl mb-3 text-slate-400"></i>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">No messages</p>
                  </div>
                ) : (
                  convMessages.map(msg => {
                    const senderName = getUserName(msg.sender_id);
                    const senderAvatar = getUserAvatar(msg.sender_id);
                    const senderUser = userMap[msg.sender_id];

                    return (
                      <div key={msg.id} className="flex items-start gap-3 group">
                        <img src={senderAvatar} className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5" alt={senderName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-slate-700 dark:text-white">{senderName}</span>
                            {senderUser && (
                              <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                senderUser.role === 'teacher' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                                senderUser.role === 'student_service' ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' :
                                'bg-brand-500/10 text-brand-600'
                              }`}>{senderUser.role.replace('_', ' ')}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400">
                              {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.read_at && (
                              <span className="text-[8px] text-brand-500 font-bold flex items-center gap-0.5">
                                <i className="fas fa-check-double"></i>
                              </span>
                            )}
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 max-w-xl border border-slate-100 dark:border-slate-700">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Read-only notice */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
                  <i className="fas fa-shield-halved text-amber-500 text-sm"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Admin Read-Only View · Messages cannot be sent from this panel
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30">
              <div className="w-24 h-24 rounded-[32px] bg-brand-500/10 flex items-center justify-center text-5xl text-brand-500 mb-6">
                <i className="fas fa-comments"></i>
              </div>
              <h3 className="text-xl font-black text-slate-700 dark:text-white uppercase tracking-wide">Select a conversation</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">to view the full message thread</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesOversight;
