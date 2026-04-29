import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../src/supabaseClient';
import ParentMessagingDesk from './ParentMessagingDesk';
import { buildAdminMessagingId, getAdminMessagingName } from '../../shared/messaging/adminMessaging';
import { buildParentMessagingUsers } from '../../shared/messaging/parentMessaging';

interface MessagesOversightProps {
  schoolId: string;
  schoolName?: string;
}

interface ConversationSummary {
  id: string;               // unique key = sorted IDs or group id
  kind: 'dm' | 'group';
  name: string;             // "Alice → Bob" or group name
  participantAvatars: string[];
  participantNames: string[];
  participantIds: string[];
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

interface ParentInquiryRecord {
  id: string;
  school_id: string;
  parent_email: string;
  department: string;
  urgency: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
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

const formatExactDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeInquiryStatus = (value?: string | null) => String(value || '').trim().toLowerCase();

const getInquiryStatusClasses = (status: string) => {
  const normalized = normalizeInquiryStatus(status);
  if (normalized === 'resolved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (normalized === 'read') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
};

const getInquiryUrgencyClasses = (urgency: string) => {
  const normalized = String(urgency || '').toLowerCase();
  if (normalized.includes('urgent') || normalized.includes('high')) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  }
  if (normalized.includes('normal')) {
    return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  }
  return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
};

const MessagesOversight: React.FC<MessagesOversightProps> = ({ schoolId, schoolName }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allMessages, setAllMessages] = useState<MessageRecord[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [parentInquiries, setParentInquiries] = useState<ParentInquiryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'messages' | 'parent_messages' | 'inquiries'>('messages');
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null);
  const [convMessages, setConvMessages] = useState<MessageRecord[]>([]);
  const [activeInquiry, setActiveInquiry] = useState<ParentInquiryRecord | null>(null);
  const [filterRole, setFilterRole] = useState<'all' | 'teacher' | 'student' | 'student_service' | 'cross_role'>('all');
  const [filterKind, setFilterKind] = useState<'all' | 'dm' | 'group'>('all');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<'all' | 'unread' | 'read' | 'resolved'>('all');
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isUpdatingInquiryId, setIsUpdatingInquiryId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminUserId = buildAdminMessagingId(schoolId);
  const adminUserName = getAdminMessagingName(schoolName);

  useEffect(() => {
    void loadAll();
  }, [schoolId, schoolName]);

  const loadAll = async () => {
    if (!supabase) return;
    setIsLoading(true);
    setPanelError(null);
    try {
      const [teachersRes, studentsRes, servicesRes, messagesRes, groupsRes, membersRes, inquiriesRes] = await Promise.all([
        supabase.from('teachers').select('id, name, avatar').eq('school_id', schoolId),
        supabase
          .from('students')
          .select('id, name, avatar, parent_name, parent_email, secondary_parent_name, secondary_parent_email')
          .eq('school_id', schoolId),
        supabase.from('student_services').select('id, name, avatar').eq('school_id', schoolId),
        supabase.from('messages').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('message_groups').select('*').eq('school_id', schoolId),
        supabase.from('message_group_members').select('*'),
        supabase.from('parent_inquiries').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
      ]);

      const parentUsers = buildParentMessagingUsers(schoolId, (studentsRes.data || []) as any[]).map((parent) => ({
        id: parent.id,
        name: parent.name,
        avatar: parent.avatar,
        role: 'parent',
      }));

      const users: UserProfile[] = [
        { id: adminUserId, name: adminUserName, role: 'admin' },
        ...(teachersRes.data || []).map((t: any) => ({ ...t, role: 'teacher' })),
        ...(studentsRes.data || []).map((s: any) => ({ ...s, role: 'student' })),
        ...(servicesRes.data || []).map((sv: any) => ({ ...sv, role: 'student_service' })),
        ...parentUsers,
      ];
      const nextGroups = groupsRes.data || [];
      const allowedGroupIds = new Set(nextGroups.map((group: any) => String(group.id)));
      const nextInquiries = (inquiriesRes.data || []) as ParentInquiryRecord[];

      setAllUsers(users);
      setAllMessages(messagesRes.data || []);
      setGroups(nextGroups);
      setGroupMembers((membersRes.data || []).filter((member: any) => allowedGroupIds.has(String(member.group_id))));
      setParentInquiries(nextInquiries);
      setActiveInquiry(prev => (prev ? nextInquiries.find(item => item.id === prev.id) || null : prev));
    } catch (err) {
      console.error('MessagesOversight loadAll:', err);
      setPanelError((err as Error)?.message || 'Failed to load messages.');
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
      const participantIds = [msg.sender_id, msg.receiver_id].sort();
      const pair = participantIds.join('__');
      if (!convMap[pair]) {
        const nameA = getUserName(participantIds[0]);
        const nameB = getUserName(participantIds[1]);
        convMap[pair] = {
          id: pair,
          kind: 'dm',
          name: `${nameA} ↔ ${nameB}`,
          participantAvatars: [getUserAvatar(participantIds[0]), getUserAvatar(participantIds[1])],
          participantNames: [nameA, nameB],
          participantIds,
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
      const participantIds = members
        .map((m: any) => String(m.user_id || m.member_id || ''))
        .filter(Boolean);
      convMap[`grp:${grp.id}`] = {
        id: `grp:${grp.id}`,
        kind: 'group',
        name: grp.name,
        participantAvatars: members.slice(0, 4).map((m: any) => m.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user_name)}&background=4ea59d&color=fff`),
        participantNames: members.map((m: any) => m.user_name),
        participantIds,
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

  const internalConversations = useMemo(() => {
    return conversations.filter((conversation) => !conversation.participantIds.some((participantId) => {
      const role = userMap[participantId]?.role;
      return role === 'parent' || role === 'admin';
    }));
  }, [conversations, userMap]);

  const parentConversationCount = useMemo(() => {
    return conversations.filter((conversation) => {
      const roles = conversation.participantIds
        .map((participantId) => userMap[participantId]?.role)
        .filter((role): role is string => Boolean(role));
      return roles.includes('parent') && roles.some((role) => role === 'teacher' || role === 'student_service');
    }).length;
  }, [conversations, userMap]);

  const filteredConversations = useMemo(() => {
    let result = internalConversations;
    if (filterKind !== 'all') result = result.filter(c => c.kind === filterKind);
    if (filterRole !== 'all') {
      result = result.filter(c => {
        const roles = c.participantIds
          .map(id => userMap[id]?.role)
          .filter((role): role is string => Boolean(role));
        if (filterRole === 'cross_role') {
          return roles.includes('student') && roles.includes('teacher');
        }
        return roles.includes(filterRole);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.participantNames.some(n => n.toLowerCase().includes(q)) ||
        c.lastMessage.toLowerCase().includes(q)
      );
    }
    return result;
  }, [filterKind, filterRole, internalConversations, searchQuery, userMap]);

  const filteredInquiries = useMemo(() => {
    let result = parentInquiries;

    if (inquiryStatusFilter !== 'all') {
      result = result.filter(inquiry => normalizeInquiryStatus(inquiry.status) === inquiryStatusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inquiry =>
        inquiry.parent_email.toLowerCase().includes(q) ||
        inquiry.department.toLowerCase().includes(q) ||
        inquiry.urgency.toLowerCase().includes(q) ||
        inquiry.subject.toLowerCase().includes(q) ||
        inquiry.message.toLowerCase().includes(q) ||
        inquiry.status.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [parentInquiries, inquiryStatusFilter, searchQuery]);

  const buildConversationMessages = (conv: ConversationSummary) => {
    if (conv.kind === 'dm') {
      const [idA, idB] = conv.id.split('__');
      return allMessages
        .filter(m => !m.group_id && ((m.sender_id === idA && m.receiver_id === idB) || (m.sender_id === idB && m.receiver_id === idA)))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const gid = conv.groupId!;
    return allMessages
      .filter(m => m.group_id === gid)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  useEffect(() => {
    if (!activeConv) return;
    setConvMessages(buildConversationMessages(activeConv));
  }, [activeConv, allMessages]);

  const openConversation = (conv: ConversationSummary) => {
    setActiveView('messages');
    setActiveConv(conv);
    setActiveInquiry(null);
    setConvMessages(buildConversationMessages(conv));
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const openInquiry = (inquiry: ParentInquiryRecord) => {
    setActiveView('inquiries');
    setActiveInquiry(inquiry);
    setActiveConv(null);
  };

  const updateInquiryStatus = async (inquiry: ParentInquiryRecord, nextStatus: 'unread' | 'read' | 'resolved') => {
    if (!supabase) return;
    if (normalizeInquiryStatus(inquiry.status) === nextStatus) return;

    setPanelError(null);
    setIsUpdatingInquiryId(inquiry.id);

    try {
      const { error } = await supabase
        .from('parent_inquiries')
        .update({ status: nextStatus })
        .eq('id', inquiry.id)
        .eq('school_id', schoolId);

      if (error) throw error;

      setParentInquiries(prev => prev.map(item => (item.id === inquiry.id ? { ...item, status: nextStatus } : item)));
      setActiveInquiry(prev => (prev && prev.id === inquiry.id ? { ...prev, status: nextStatus } : prev));
    } catch (err) {
      console.error('Failed to update inquiry status:', err);
      setPanelError((err as Error)?.message || 'Failed to update inquiry status.');
    } finally {
      setIsUpdatingInquiryId(null);
    }
  };

  const totalMessages = allMessages.length;
  const totalConversations = internalConversations.length;
  const totalGroups = groups.length;
  const unreadMessages = allMessages.filter(m => !m.read_at && m.receiver_id).length;
  const totalInquiries = parentInquiries.length;
  const unreadInquiries = parentInquiries.filter(inquiry => normalizeInquiryStatus(inquiry.status) === 'unread').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-shield-halved text-brand-500"></i> Institutional Oversight
          </h2>
          <p className="text-slate-400 text-sm mt-1 dark:text-slate-500 font-medium">Monitor internal conversations and parent inquiries from one secure inbox.</p>
        </div>
        <button
          onClick={() => void loadAll()}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-500 hover:bg-brand-500 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
        >
          <i className="fas fa-rotate-right"></i> Refresh
        </button>
      </div>

      {panelError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {panelError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[ 
          { id: 'messages', label: 'Internal Messages', count: totalConversations, icon: 'fa-comments' },
          { id: 'parent_messages', label: 'Parent Messaging', count: parentConversationCount, icon: 'fa-people-arrows' },
          { id: 'inquiries', label: 'Parent Inquiries', count: totalInquiries, icon: 'fa-envelope-open-text' },
        ].map(tab => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as 'messages' | 'parent_messages' | 'inquiries')}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-400 hover:text-brand-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-[9px] ${isActive ? 'bg-white/15 dark:bg-slate-900/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {isLoading ? '...' : tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Messages', value: totalMessages, icon: 'fa-envelope', color: 'text-brand-500 bg-brand-500/10' },
          { label: 'Conversations', value: totalConversations, icon: 'fa-comments', color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Group Chats', value: totalGroups, icon: 'fa-user-group', color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Unread Messages', value: unreadMessages, icon: 'fa-bell', color: 'text-rose-500 bg-rose-500/10' },
          { label: 'Parent Inquiries', value: totalInquiries, icon: 'fa-envelope-open-text', color: 'text-amber-500 bg-amber-500/10' },
          { label: 'Unread Inquiries', value: unreadInquiries, icon: 'fa-circle-exclamation', color: 'text-emerald-500 bg-emerald-500/10' },
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
      {activeView === 'messages' ? (
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
              {(['all', 'teacher', 'student', 'student_service', 'cross_role'] as const).map(r => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filterRole === r ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {r === 'all' ? 'All roles' : r === 'student_service' ? 'Services' : r === 'cross_role' ? 'Student ↔ Teacher' : r}
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
              {filteredConversations.length} of {totalConversations} conversations
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
                                senderUser.role === 'parent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
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
                <div className="flex flex-col gap-2 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-shield-halved text-amber-500 text-sm"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      Administrative Policy: Secure Observation Active
                    </p>
                  </div>
                  <p className="text-[9px] font-bold text-amber-700/70 dark:text-amber-500/50 ml-7 leading-relaxed">
                    This session is being recorded for administrative audit. All access to student-teacher communication is logged. Messages in this view are read-only.
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
      ) : activeView === 'parent_messages' ? (
      <ParentMessagingDesk schoolId={schoolId} schoolName={schoolName} />
      ) : (
      <div className="flex bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-premium overflow-hidden" style={{ height: '680px' }}>
        <div className="w-96 border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search parent inquiries..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xs"></i>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['all', 'unread', 'read', 'resolved'] as const).map(status => (
                <button key={status} onClick={() => setInquiryStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${inquiryStatusFilter === status ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">Loading...</p>
              </div>
            ) : filteredInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-40 px-4 text-center">
                <i className="fas fa-envelope-open-text text-3xl mb-2 text-slate-400"></i>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No parent inquiries found</p>
              </div>
            ) : (
              filteredInquiries.map(inquiry => {
                const isActive = activeInquiry?.id === inquiry.id;
                return (
                  <button
                    key={inquiry.id}
                    onClick={() => openInquiry(inquiry)}
                    className={`w-full p-4 border-b border-slate-50 dark:border-slate-800 transition-all text-left ${isActive ? 'bg-amber-500/5 border-l-4 border-l-amber-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className={`text-xs font-black truncate ${isActive ? 'text-amber-600 dark:text-amber-300' : 'text-slate-700 dark:text-white'}`}>{inquiry.subject}</h4>
                        <p className="text-[10px] font-semibold text-slate-500 truncate mt-1">{inquiry.parent_email}</p>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 shrink-0">{formatTime(inquiry.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-2">{inquiry.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getInquiryStatusClasses(inquiry.status)}`}>
                        {normalizeInquiryStatus(inquiry.status) || 'unread'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getInquiryUrgencyClasses(inquiry.urgency)}`}>
                        {inquiry.urgency}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {inquiry.department}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
              {filteredInquiries.length} of {parentInquiries.length} parent inquiries
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {activeInquiry ? (
            <>
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getInquiryStatusClasses(activeInquiry.status)}`}>
                      {normalizeInquiryStatus(activeInquiry.status) || 'unread'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getInquiryUrgencyClasses(activeInquiry.urgency)}`}>
                      {activeInquiry.urgency}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {activeInquiry.department}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white break-words">{activeInquiry.subject}</h4>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    From {activeInquiry.parent_email} · {formatExactDate(activeInquiry.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(['unread', 'read', 'resolved'] as const).map(status => {
                    const isCurrent = normalizeInquiryStatus(activeInquiry.status) === status;
                    return (
                      <button
                        key={status}
                        onClick={() => void updateInquiryStatus(activeInquiry, status)}
                        disabled={isCurrent || isUpdatingInquiryId === activeInquiry.id}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCurrent ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-400 hover:text-brand-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'} disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {status}
                      </button>
                    );
                  })}
                  <button onClick={() => setActiveInquiry(null)}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                    <i className="fas fa-xmark text-sm"></i>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[
                    { label: 'Parent Email', value: activeInquiry.parent_email, icon: 'fa-at' },
                    { label: 'Department', value: activeInquiry.department, icon: 'fa-building-columns' },
                    { label: 'Urgency', value: activeInquiry.urgency, icon: 'fa-bolt' },
                    { label: 'Status', value: activeInquiry.status, icon: 'fa-circle-check' },
                    { label: 'Received', value: formatExactDate(activeInquiry.created_at), icon: 'fa-clock' },
                    { label: 'School ID', value: activeInquiry.school_id, icon: 'fa-school' },
                  ].map(field => (
                    <div key={field.label} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <i className={`fas ${field.icon} text-xs`}></i>
                        <p className="text-[9px] font-black uppercase tracking-widest">{field.label}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-100 break-all">{field.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-950 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4 text-slate-400">
                    <i className="fas fa-envelope text-sm"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">Parent Message</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4 text-sm leading-7 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {activeInquiry.message}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30">
              <div className="w-24 h-24 rounded-[32px] bg-amber-500/10 flex items-center justify-center text-5xl text-amber-500 mb-6">
                <i className="fas fa-envelope-open-text"></i>
              </div>
              <h3 className="text-xl font-black text-slate-700 dark:text-white uppercase tracking-wide">Select a parent inquiry</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">to view the submitted message and update its status</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default MessagesOversight;
