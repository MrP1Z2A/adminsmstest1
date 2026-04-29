import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { buildAdminMessagingId, getAdminMessagingName } from '../../shared/messaging/adminMessaging';
import { buildParentMessagingUsers } from '../../shared/messaging/parentMessaging';

interface ParentMessagingDeskProps {
  schoolId: string;
  schoolName?: string;
}

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  role: 'teacher' | 'student_service' | 'parent' | 'admin' | string;
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

interface ConversationSummary {
  id: string;
  kind: 'dm' | 'group';
  name: string;
  participantAvatars: string[];
  participantNames: string[];
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: string;
  lastSenderName: string;
  messageCount: number;
  groupId?: string;
}

interface ParentContactSummary {
  parent: UserProfile;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

type DeskSelection =
  | { kind: 'parent'; parentId: string }
  | { kind: 'conversation'; conversationId: string };

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffHours = (Date.now() - date.getTime()) / 3_600_000;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffHours < 168) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatThreadTimestamp = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getAvatarUrl = (name: string, avatar?: string | null) =>
  avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4ea59d&color=fff`;

const getRoleBadgeClasses = (role?: string) => {
  if (role === 'teacher') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  if (role === 'student_service') return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
  if (role === 'parent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (role === 'admin') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
};

const dedupeMessages = (messages: MessageRecord[]) => {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
};

const ParentMessagingDesk: React.FC<ParentMessagingDeskProps> = ({ schoolId, schoolName }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allMessages, setAllMessages] = useState<MessageRecord[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSelection, setActiveSelection] = useState<DeskSelection | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adminUserId = useMemo(() => buildAdminMessagingId(schoolId), [schoolId]);
  const adminUserName = useMemo(() => getAdminMessagingName(schoolName), [schoolName]);
  const adminUserAvatar = useMemo(() => getAvatarUrl(adminUserName), [adminUserName]);

  useEffect(() => {
    void loadDesk();
  }, [schoolId, schoolName]);

  useEffect(() => {
    if (!supabase || !schoolId) return;

    const channel = supabase
      .channel(`sms-parent-desk:${schoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `school_id=eq.${schoolId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const nextMessage = payload.new as MessageRecord;
          setAllMessages((previous) => previous.some((message) => message.id === nextMessage.id) ? previous : dedupeMessages([nextMessage, ...previous]));
        }

        if (payload.eventType === 'UPDATE') {
          const nextMessage = payload.new as MessageRecord;
          setAllMessages((previous) => dedupeMessages(previous.map((message) => message.id === nextMessage.id ? nextMessage : message)));
        }

        if (payload.eventType === 'DELETE') {
          const deletedId = String((payload.old as any)?.id || '');
          setAllMessages((previous) => previous.filter((message) => message.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [schoolId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSelection, allMessages.length]);

  const loadDesk = async () => {
    if (!supabase) return;

    setIsLoading(true);
    setPanelError(null);

    try {
      const [teachersRes, studentsRes, servicesRes, messagesRes, groupsRes, membersRes] = await Promise.all([
        supabase.from('teachers').select('id, name, avatar, email').eq('school_id', schoolId),
        supabase
          .from('students')
          .select('id, name, avatar, parent_name, parent_email, secondary_parent_name, secondary_parent_email')
          .eq('school_id', schoolId),
        supabase.from('student_services').select('id, name, avatar, email').eq('school_id', schoolId),
        supabase.from('messages').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('message_groups').select('*').eq('school_id', schoolId),
        supabase.from('message_group_members').select('*'),
      ]);

      if (teachersRes.error) throw teachersRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (messagesRes.error) throw messagesRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (membersRes.error) throw membersRes.error;

      const parentUsers = buildParentMessagingUsers(schoolId, (studentsRes.data || []) as any[]).map((parent) => ({
        id: parent.id,
        name: parent.name,
        avatar: parent.avatar,
        email: parent.email,
        role: 'parent',
      }));

      const nextUsers: UserProfile[] = [
        { id: adminUserId, name: adminUserName, avatar: adminUserAvatar, role: 'admin', email: 'administrative desk' },
        ...((teachersRes.data || []).map((teacher: any) => ({ ...teacher, role: 'teacher' }))),
        ...((servicesRes.data || []).map((service: any) => ({ ...service, role: 'student_service' }))),
        ...parentUsers,
      ];

      const nextGroups = groupsRes.data || [];
      const allowedGroupIds = new Set(nextGroups.map((group: any) => String(group.id)));

      setAllUsers(nextUsers);
      setAllMessages((messagesRes.data || []) as MessageRecord[]);
      setGroups(nextGroups);
      setGroupMembers((membersRes.data || []).filter((member: any) => allowedGroupIds.has(String(member.group_id))));
    } catch (error) {
      console.error('ParentMessagingDesk load error:', error);
      setPanelError((error as Error)?.message || 'Failed to load parent messaging.');
    } finally {
      setIsLoading(false);
    }
  };

  const userMap = useMemo(() => {
    const nextMap: Record<string, UserProfile> = {};
    allUsers.forEach((user) => {
      nextMap[user.id] = user;
    });
    return nextMap;
  }, [allUsers]);

  const getUserName = (userId: string) => userMap[userId]?.name || userId;
  const getUserAvatar = (userId: string) => getAvatarUrl(getUserName(userId), userMap[userId]?.avatar);

  const buildConversationMessages = (conversation: ConversationSummary) => {
    if (conversation.kind === 'dm') {
      const [idA, idB] = conversation.id.split('__');
      return allMessages
        .filter((message) => (
          !message.group_id
          && (
            (message.sender_id === idA && message.receiver_id === idB)
            || (message.sender_id === idB && message.receiver_id === idA)
          )
        ))
        .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    }

    return allMessages
      .filter((message) => message.group_id === conversation.groupId)
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  };

  const conversations = useMemo(() => {
    const nextMap: Record<string, ConversationSummary> = {};

    allMessages.forEach((message) => {
      if (message.group_id || !message.receiver_id) return;

      const participantIds = [message.sender_id, message.receiver_id].sort();
      const conversationId = participantIds.join('__');

      if (!nextMap[conversationId]) {
        const nameA = getUserName(participantIds[0]);
        const nameB = getUserName(participantIds[1]);
        nextMap[conversationId] = {
          id: conversationId,
          kind: 'dm',
          name: `${nameA} ↔ ${nameB}`,
          participantAvatars: [getUserAvatar(participantIds[0]), getUserAvatar(participantIds[1])],
          participantNames: [nameA, nameB],
          participantIds,
          lastMessage: message.content,
          lastMessageAt: message.created_at,
          lastSenderName: getUserName(message.sender_id),
          messageCount: 1,
        };
        return;
      }

      nextMap[conversationId].messageCount += 1;
      if (new Date(message.created_at) > new Date(nextMap[conversationId].lastMessageAt)) {
        nextMap[conversationId].lastMessage = message.content;
        nextMap[conversationId].lastMessageAt = message.created_at;
        nextMap[conversationId].lastSenderName = getUserName(message.sender_id);
      }
    });

    groups.forEach((group) => {
      const members = groupMembers.filter((member) => member.group_id === group.id);
      const groupMessages = allMessages.filter((message) => message.group_id === group.id);
      const lastMessage = groupMessages[0];

      nextMap[`grp:${group.id}`] = {
        id: `grp:${group.id}`,
        kind: 'group',
        name: group.name,
        participantAvatars: members
          .slice(0, 4)
          .map((member: any) => member.user_avatar || getAvatarUrl(member.user_name)),
        participantNames: members.map((member: any) => member.user_name),
        participantIds: members.map((member: any) => String(member.user_id || '')).filter(Boolean),
        lastMessage: lastMessage?.content || 'No messages yet',
        lastMessageAt: lastMessage?.created_at || group.created_at,
        lastSenderName: lastMessage ? getUserName(lastMessage.sender_id) : group.name,
        messageCount: groupMessages.length,
        groupId: group.id,
      };
    });

    return Object.values(nextMap).sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());
  }, [allMessages, getUserAvatar, getUserName, groupMembers, groups, userMap]);

  const parentConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const roles = conversation.participantIds.map((participantId) => userMap[participantId]?.role).filter(Boolean);
      const includesParent = roles.includes('parent');
      const includesStaff = roles.some((role) => role === 'teacher' || role === 'student_service');
      return includesParent && includesStaff;
    });
  }, [conversations, userMap]);

  const parentContactSummaries = useMemo(() => {
    const directMeta = new Map<string, ParentContactSummary>();

    allMessages.forEach((message) => {
      if (message.group_id) return;
      if (message.sender_id !== adminUserId && message.receiver_id !== adminUserId) return;

      const otherUserId = message.sender_id === adminUserId ? message.receiver_id : message.sender_id;
      if (!otherUserId || userMap[otherUserId]?.role !== 'parent') return;

      const existing = directMeta.get(otherUserId);
      if (!existing) {
        directMeta.set(otherUserId, {
          parent: userMap[otherUserId],
          lastMessage: message.content,
          lastMessageAt: message.created_at,
          unreadCount: message.receiver_id === adminUserId && !message.read_at ? 1 : 0,
        });
        return;
      }

      if (message.receiver_id === adminUserId && !message.read_at) {
        existing.unreadCount += 1;
      }

      if (!existing.lastMessageAt || new Date(message.created_at) > new Date(existing.lastMessageAt)) {
        existing.lastMessage = message.content;
        existing.lastMessageAt = message.created_at;
      }
    });

    return allUsers
      .filter((user) => user.role === 'parent')
      .map((parent) => directMeta.get(parent.id) || {
        parent,
        unreadCount: 0,
      })
      .sort((left, right) => {
        if (left.lastMessageAt && right.lastMessageAt) {
          return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime();
        }
        if (left.lastMessageAt) return -1;
        if (right.lastMessageAt) return 1;
        return left.parent.name.localeCompare(right.parent.name);
      });
  }, [adminUserId, allMessages, allUsers, userMap]);

  const filteredParentConversations = useMemo(() => {
    if (!searchQuery.trim()) return parentConversations;
    const normalizedQuery = searchQuery.toLowerCase();
    return parentConversations.filter((conversation) => (
      conversation.name.toLowerCase().includes(normalizedQuery)
      || conversation.participantNames.some((name) => name.toLowerCase().includes(normalizedQuery))
      || conversation.lastMessage.toLowerCase().includes(normalizedQuery)
    ));
  }, [parentConversations, searchQuery]);

  const filteredParentContacts = useMemo(() => {
    if (!searchQuery.trim()) return parentContactSummaries;
    const normalizedQuery = searchQuery.toLowerCase();
    return parentContactSummaries.filter((entry) => (
      entry.parent.name.toLowerCase().includes(normalizedQuery)
      || String(entry.parent.email || '').toLowerCase().includes(normalizedQuery)
      || String(entry.lastMessage || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [parentContactSummaries, searchQuery]);

  const activeConversation = useMemo(() => {
    if (activeSelection?.kind !== 'conversation') return null;
    return parentConversations.find((conversation) => conversation.id === activeSelection.conversationId) || null;
  }, [activeSelection, parentConversations]);

  const selectedParent = useMemo(() => {
    if (!activeSelection) return null;

    if (activeSelection.kind === 'parent') {
      return userMap[activeSelection.parentId] || null;
    }

    const parentId = activeConversation?.participantIds.find((participantId) => userMap[participantId]?.role === 'parent');
    return parentId ? userMap[parentId] || null : null;
  }, [activeConversation, activeSelection, userMap]);

  const selectedAdminMessages = useMemo(() => {
    if (!selectedParent) return [];

    return allMessages
      .filter((message) => (
        !message.group_id
        && (
          (message.sender_id === adminUserId && message.receiver_id === selectedParent.id)
          || (message.sender_id === selectedParent.id && message.receiver_id === adminUserId)
        )
      ))
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  }, [adminUserId, allMessages, selectedParent]);

  const canReplyInActiveThread = useMemo(() => {
    if (!activeSelection || !selectedParent) return false;
    if (activeSelection.kind === 'parent') return true;
    return activeConversation?.kind === 'dm'
      && activeConversation.participantIds.includes(adminUserId)
      && activeConversation.participantIds.includes(selectedParent.id);
  }, [activeConversation, activeSelection, adminUserId, selectedParent]);

  const activeMessages = useMemo(() => {
    if (!activeSelection) return [];
    if (canReplyInActiveThread || activeSelection.kind === 'parent') return selectedAdminMessages;
    return activeConversation ? buildConversationMessages(activeConversation) : [];
  }, [activeConversation, activeSelection, canReplyInActiveThread, selectedAdminMessages]);

  useEffect(() => {
    if (!selectedParent) return;

    const unreadMessages = selectedAdminMessages.filter((message) => message.receiver_id === adminUserId && !message.read_at);
    if (unreadMessages.length === 0) return;

    const readAt = new Date().toISOString();
    const unreadIds = unreadMessages.map((message) => message.id);

    setAllMessages((previous) => previous.map((message) => unreadIds.includes(message.id) ? { ...message, read_at: readAt } : message));
    void supabase.from('messages').update({ read_at: readAt }).in('id', unreadIds);
  }, [adminUserId, selectedAdminMessages, selectedParent]);

  const unreadDirectCount = parentContactSummaries.reduce((sum, entry) => sum + entry.unreadCount, 0);
  const directThreadCount = parentContactSummaries.filter((entry) => entry.lastMessageAt).length;

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !selectedParent || !draftMessage.trim()) return;

    const trimmedMessage = draftMessage.trim();
    const payload = {
      sender_id: adminUserId,
      receiver_id: selectedParent.id,
      group_id: null,
      content: trimmedMessage,
      school_id: schoolId,
    };

    const optimisticMessage: MessageRecord = {
      id: `opt-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    setPanelError(null);
    setIsSendingMessage(true);
    setDraftMessage('');
    setActiveSelection({ kind: 'parent', parentId: selectedParent.id });
    setAllMessages((previous) => [optimisticMessage, ...previous]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (error) throw error;

      setAllMessages((previous) => dedupeMessages(previous.map((message) => message.id === optimisticMessage.id ? (data as MessageRecord) : message)));
    } catch (error) {
      console.error('ParentMessagingDesk send error:', error);
      setAllMessages((previous) => previous.filter((message) => message.id !== optimisticMessage.id));
      setDraftMessage(trimmedMessage);
      setPanelError((error as Error)?.message || 'Failed to send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const activeTitle = activeSelection?.kind === 'parent'
    ? selectedParent?.name || 'Parent'
    : activeConversation?.name || 'Parent thread';

  const activeSubtitle = activeSelection?.kind === 'parent'
    ? (selectedParent?.email || 'Direct administrative channel')
    : activeConversation?.kind === 'group'
      ? `${activeConversation?.participantNames.length || 0} participants`
      : `${activeConversation?.messageCount || 0} messages`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-people-arrows text-emerald-500"></i> Parent Messaging Desk
          </h3>
          <p className="text-slate-400 text-sm mt-1 dark:text-slate-500 font-medium">
            Review parent-to-staff threads and open a direct administrative message channel with any parent.
          </p>
        </div>
        <button
          onClick={() => void loadDesk()}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
        >
          <i className="fas fa-rotate-right"></i> Refresh
        </button>
      </div>

      {panelError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {panelError}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Parent Contacts', value: parentContactSummaries.length, icon: 'fa-user-group', color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Observed Threads', value: parentConversations.length, icon: 'fa-comments', color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Direct Threads', value: directThreadCount, icon: 'fa-paper-plane', color: 'text-sky-500 bg-sky-500/10' },
          { label: 'Unread To Admin', value: unreadDirectCount, icon: 'fa-bell', color: 'text-rose-500 bg-rose-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <i className={`fas ${stat.icon} text-sm`}></i>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{isLoading ? '...' : stat.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-premium overflow-hidden" style={{ height: '700px' }}>
        <div className="w-96 border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search parent threads..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xs"></i>
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Admin Identity</p>
              <div className="flex items-center gap-3 mt-2">
                <img src={adminUserAvatar} alt={adminUserName} className="w-10 h-10 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{adminUserName}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{schoolId}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Loading...</p>
              </div>
            ) : (
              <div className="p-4 space-y-5">
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observed Parent Threads</p>
                    <span className="text-[10px] font-black text-slate-400">{filteredParentConversations.length}</span>
                  </div>
                  {filteredParentConversations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 px-4 py-5 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No parent threads yet</p>
                    </div>
                  ) : (
                    filteredParentConversations.map((conversation) => {
                      const isActive = activeSelection?.kind === 'conversation' && activeSelection.conversationId === conversation.id;
                      return (
                        <button
                          key={conversation.id}
                          onClick={() => setActiveSelection({ kind: 'conversation', conversationId: conversation.id })}
                          className={`w-full text-left rounded-2xl border px-4 py-4 transition-all ${isActive ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800/50'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0 w-10 h-10">
                              {conversation.kind === 'group' ? (
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/15 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                  <i className="fas fa-users text-sm"></i>
                                </div>
                              ) : (
                                <>
                                  <img src={conversation.participantAvatars[0]} className="w-7 h-7 rounded-lg object-cover absolute top-0 left-0 border-2 border-white dark:border-slate-900" alt="" />
                                  <img src={conversation.participantAvatars[1]} className="w-6 h-6 rounded-lg object-cover absolute bottom-0 right-0 border-2 border-white dark:border-slate-900" alt="" />
                                </>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{conversation.name}</p>
                                <span className={`text-[10px] font-black shrink-0 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>{formatTime(conversation.lastMessageAt)}</span>
                              </div>
                              <p className={`text-[11px] mt-1 truncate ${isActive ? 'text-emerald-50' : 'text-slate-500 dark:text-slate-400'}`}>
                                <span className="font-bold">{conversation.lastSenderName.split(' ')[0]}:</span> {conversation.lastMessage}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Parent Outreach</p>
                    <span className="text-[10px] font-black text-slate-400">{filteredParentContacts.length}</span>
                  </div>
                  {filteredParentContacts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 px-4 py-5 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No parents found</p>
                    </div>
                  ) : (
                    filteredParentContacts.map((entry) => {
                      const isActive = activeSelection?.kind === 'parent' && activeSelection.parentId === entry.parent.id;
                      return (
                        <button
                          key={entry.parent.id}
                          onClick={() => setActiveSelection({ kind: 'parent', parentId: entry.parent.id })}
                          className={`w-full text-left rounded-2xl border px-4 py-4 transition-all ${isActive ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/15' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-200 hover:bg-sky-50/60 dark:hover:bg-slate-800/50'}`}
                        >
                          <div className="flex items-start gap-3">
                            <img src={getUserAvatar(entry.parent.id)} alt={entry.parent.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{entry.parent.name}</p>
                                <span className={`text-[10px] font-black shrink-0 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>{formatTime(entry.lastMessageAt)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-white/15 text-white' : getRoleBadgeClasses('parent')}`}>
                                  Parent
                                </span>
                                {!!entry.unreadCount && (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-rose-400 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                    {entry.unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] mt-2 truncate ${isActive ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                {entry.lastMessage || entry.parent.email || 'Open a direct administrative channel'}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </section>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {!activeSelection ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 px-8">
              <div className="w-24 h-24 rounded-[32px] bg-emerald-500/10 flex items-center justify-center text-5xl text-emerald-500 mb-6">
                <i className="fas fa-comments"></i>
              </div>
              <h4 className="text-xl font-black text-slate-700 dark:text-white uppercase tracking-wide">Select a parent thread</h4>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">to monitor the conversation or open a direct parent channel</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-4 min-w-0">
                  {activeSelection.kind === 'conversation' && activeConversation?.kind === 'group' ? (
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <i className="fas fa-users"></i>
                    </div>
                  ) : (
                    <img src={selectedParent ? getUserAvatar(selectedParent.id) : adminUserAvatar} alt={activeTitle} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-lg font-black text-slate-800 dark:text-white truncate">{activeTitle}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {selectedParent && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getRoleBadgeClasses('parent')}`}>
                          Parent
                        </span>
                      )}
                      {activeSelection.kind === 'parent' && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getRoleBadgeClasses('admin')}`}>
                          Admin Channel
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400">{activeSubtitle}</span>
                    </div>
                  </div>
                </div>

                {!canReplyInActiveThread && selectedParent && (
                  <button
                    onClick={() => setActiveSelection({ kind: 'parent', parentId: selectedParent.id })}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-[10px] font-black uppercase tracking-widest shrink-0"
                  >
                    Message Parent Directly
                  </button>
                )}
              </div>

              <div className={`px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 ${canReplyInActiveThread || activeSelection.kind === 'parent' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                <i className={`fas ${canReplyInActiveThread || activeSelection.kind === 'parent' ? 'fa-paper-plane text-emerald-600' : 'fa-shield-halved text-amber-500'} text-sm shrink-0`}></i>
                <p className={`text-[11px] font-bold ${canReplyInActiveThread || activeSelection.kind === 'parent' ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {canReplyInActiveThread || activeSelection.kind === 'parent'
                    ? 'Messages sent here appear to parents as School Administration and stay separate from staff-only reply chains.'
                    : 'This parent thread is shown for oversight. Use the direct parent channel if administration needs to respond.'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-40 px-6 text-center">
                    <div className="w-20 h-20 rounded-[28px] bg-emerald-500/10 flex items-center justify-center text-4xl text-emerald-500 mb-5">
                      <i className="fas fa-comment-dots"></i>
                    </div>
                    <h5 className="text-lg font-black text-slate-700 dark:text-white">
                      {activeSelection.kind === 'parent' ? 'Start a direct parent conversation' : 'No messages in this thread yet'}
                    </h5>
                    <p className="text-sm text-slate-500 mt-2 max-w-md">
                      {activeSelection.kind === 'parent'
                        ? 'Send a school-wide administrative update, answer a parent directly, or open a new support conversation.'
                        : 'This thread has not started yet, or it has no messages that match the selected conversation.'}
                    </p>
                  </div>
                ) : (
                  activeMessages.map((message) => {
                    const isOwn = message.sender_id === adminUserId;
                    const sender = userMap[message.sender_id] || null;
                    const senderName = isOwn ? adminUserName : sender?.name || getUserName(message.sender_id);
                    const senderAvatar = isOwn ? adminUserAvatar : getUserAvatar(message.sender_id);
                    const senderRole = isOwn ? 'admin' : sender?.role;

                    return (
                      <div key={message.id} className={`flex items-start gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isOwn && (
                          <img src={senderAvatar} className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5" alt={senderName} />
                        )}
                        <div className="max-w-[75%] min-w-0">
                          <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-xs font-black text-slate-700 dark:text-white">{senderName}</span>
                            {senderRole && (
                              <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${getRoleBadgeClasses(senderRole)}`}>
                                {String(senderRole).replace('_', ' ')}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400">{formatThreadTimestamp(message.created_at)}</span>
                          </div>
                          <div className={`rounded-xl px-4 py-3 text-sm border ${isOwn ? 'bg-slate-900 text-white border-slate-900 rounded-tr-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-700 rounded-tl-sm'}`}>
                            {message.content}
                          </div>
                          {isOwn && (
                            <p className="mt-1 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">
                              {message.read_at ? 'Seen' : 'Sent'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {(canReplyInActiveThread || activeSelection.kind === 'parent') ? (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <input
                      type="text"
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder={`Message ${selectedParent?.name || 'parent'}...`}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-emerald-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!draftMessage.trim() || isSendingMessage}
                      className="px-5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      {isSendingMessage ? 'Sending' : 'Send'}
                    </button>
                  </form>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentMessagingDesk;
