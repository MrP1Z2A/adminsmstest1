import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Headset,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../sms/supabaseClient';
import { buildAdminMessagingId, getAdminMessagingName } from '../../shared/messaging/adminMessaging';

type ContactRole = 'teacher' | 'student_service' | 'admin';

interface ParentMessagingCenterProps {
  schoolId?: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentNames?: string[];
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

interface StaffContact {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: ContactRole;
  avatar?: string;
  lastMessage?: MessageRecord;
  lastMessageAt?: string;
  unreadCount?: number;
  teacherschool_id?: string;
  staffschool_id?: string;
}

interface GroupMember {
  id?: string;
  group_id: string;
  user_id: string;
  user_role: ContactRole | 'parent' | string;
  user_name: string;
  user_avatar?: string;
  joined_at?: string;
}

interface MessageGroup {
  id: string;
  name: string;
  created_by: string;
  school_id: string;
  created_at: string;
  members?: GroupMember[];
  lastMessageAt?: string;
  lastMessage?: MessageRecord;
}

type ActiveChat =
  | { kind: 'dm'; contact: StaffContact }
  | { kind: 'group'; group: MessageGroup };

const getAvatarUrl = (name: string, avatar?: string | null) =>
  avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f766e&color=ffffff`;

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffHours = (Date.now() - date.getTime()) / 3_600_000;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffHours < 168) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const roleMeta: Record<ContactRole, { label: string; badge: string }> = {
  admin: {
    label: 'Administration',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  teacher: {
    label: 'Teachers',
    badge: 'bg-amber-100 text-amber-700',
  },
  student_service: {
    label: 'Student Services',
    badge: 'bg-cyan-100 text-cyan-700',
  },
};

const getContactRoleLabel = (role: ContactRole) => {
  if (role === 'student_service') return 'Service Staff';
  if (role === 'admin') return 'Administration';
  return 'Teacher';
};

const ParentMessagingCenter: React.FC<ParentMessagingCenterProps> = ({
  schoolId,
  parentId,
  parentName,
  parentEmail,
  studentNames = [],
}) => {
  const currentUserAvatar = getAvatarUrl(parentName);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoles, setExpandedRoles] = useState<Record<ContactRole, boolean>>({
    admin: true,
    teacher: true,
    student_service: true,
  });
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminContactId = buildAdminMessagingId(schoolId || '');
  const adminContactName = getAdminMessagingName();

  const loadContacts = async () => {
    if (!schoolId || !parentId) return;

    setIsLoadingContacts(true);
    setPanelError(null);

    try {
      const [{ data: teachers, error: teachersError }, { data: services, error: servicesError }, { data: allMessages, error: messagesError }] = await Promise.all([
        supabase.from('teachers').select('id, name, email, avatar, teacherschool_id').eq('school_id', schoolId),
        supabase.from('student_services').select('id, name, email, avatar, staffschool_id').eq('school_id', schoolId),
        supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, created_at, read_at')
          .or(`sender_id.eq.${parentId},receiver_id.eq.${parentId}`)
          .is('group_id', null)
          .order('created_at', { ascending: false }),
      ]);

      if (teachersError) throw teachersError;
      if (servicesError) throw servicesError;
      if (messagesError) throw messagesError;

      const allContacts: StaffContact[] = [
        {
          id: adminContactId,
          auth_user_id: adminContactId,
          name: adminContactName,
          email: 'Administrative desk',
          role: 'admin',
        },
        ...((teachers || []).map((teacher: any) => ({
          ...teacher,
          auth_user_id: String(teacher.id),
          role: 'teacher' as const,
        }))),
        ...((services || []).map((service: any) => ({
          ...service,
          auth_user_id: String(service.id),
          role: 'student_service' as const,
        }))),
      ];

      const allIds = new Set(allContacts.map((contact) => contact.id));
      const lastMessageMap: Record<string, { lastAt: string; lastContent: string }> = {};
      const unreadCountMap: Record<string, number> = {};

      (allMessages || []).forEach((message: any) => {
        const otherId = message.sender_id === parentId ? message.receiver_id : message.sender_id;
        if (!otherId || !allIds.has(String(otherId))) return;

        if (!lastMessageMap[otherId]) {
          lastMessageMap[otherId] = {
            lastAt: message.created_at,
            lastContent: message.content,
          };
        }

        if (message.receiver_id === parentId && !message.read_at) {
          unreadCountMap[message.sender_id] = (unreadCountMap[message.sender_id] || 0) + 1;
        }
      });

      const enrichedContacts = allContacts
        .map((contact) => ({
          ...contact,
          unreadCount: unreadCountMap[contact.id] || 0,
          lastMessageAt: lastMessageMap[contact.id]?.lastAt,
          lastMessage: lastMessageMap[contact.id]
            ? {
                id: `preview-${contact.id}`,
                sender_id: parentId,
                receiver_id: contact.id,
                content: lastMessageMap[contact.id].lastContent,
                created_at: lastMessageMap[contact.id].lastAt,
                school_id: schoolId,
              }
            : undefined,
        }))
        .sort((left, right) => {
          if (left.lastMessageAt && right.lastMessageAt) {
            return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime();
          }
          if (left.lastMessageAt) return -1;
          if (right.lastMessageAt) return 1;
          return left.name.localeCompare(right.name);
        });

      setContacts(enrichedContacts);
    } catch (error: any) {
      console.error('Parent messaging contacts error:', error);
      setPanelError(error?.message || 'Failed to load school contacts.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const loadGroups = async () => {
    if (!schoolId || !parentId) return;

    try {
      const { data: memberships, error: membershipsError } = await supabase
        .from('message_group_members')
        .select('group_id')
        .eq('user_id', parentId);

      if (membershipsError) throw membershipsError;

      const groupIds = (memberships || []).map((membership: any) => membership.group_id).filter(Boolean);
      if (groupIds.length === 0) {
        setGroups([]);
        return;
      }

      const { data: groupData, error: groupsError } = await supabase
        .from('message_groups')
        .select('*, message_group_members(*)')
        .in('id', groupIds)
        .eq('school_id', schoolId);

      if (groupsError) throw groupsError;

      const enrichedGroups: MessageGroup[] = await Promise.all((groupData || []).map(async (group: any) => {
        const { data: lastMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...group,
          members: group.message_group_members || [],
          lastMessageAt: lastMessages?.[0]?.created_at || group.created_at,
          lastMessage: lastMessages?.[0],
        };
      }));

      enrichedGroups.sort((left, right) => {
        if (left.lastMessageAt && right.lastMessageAt) {
          return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime();
        }
        return left.name.localeCompare(right.name);
      });

      setGroups(enrichedGroups);
    } catch (error) {
      console.error('Parent messaging groups error:', error);
    }
  };

  useEffect(() => {
    if (!schoolId || !parentId) return;
    void loadContacts();
    void loadGroups();
  }, [schoolId, parentId]);

  useEffect(() => {
    if (!supabase || !parentId) return;

    const receiveChannel = supabase
      .channel(`parent-dm:${parentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${parentId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const message = payload.new as MessageRecord;
          if (activeChat?.kind === 'dm' && message.sender_id === activeChat.contact.id) {
            setMessages((previous) => previous.some((entry) => entry.id === message.id) ? previous : [...previous, message]);
            void markAsRead(message.id);
          }
          void loadContacts();
        }

        if (payload.eventType === 'DELETE') {
          const deletedId = String((payload.old as any)?.id || '');
          setMessages((previous) => previous.filter((entry) => entry.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(receiveChannel);
    };
  }, [parentId, activeChat]);

  useEffect(() => {
    if (!supabase || activeChat?.kind !== 'group') return;

    const groupId = activeChat.group.id;
    const groupChannel = supabase
      .channel(`parent-group:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const message = payload.new as MessageRecord;
          setMessages((previous) => previous.some((entry) => entry.id === message.id) ? previous : [...previous, message]);
        }

        if (payload.eventType === 'DELETE') {
          const deletedId = String((payload.old as any)?.id || '');
          setMessages((previous) => previous.filter((entry) => entry.id !== deletedId));
        }

        void loadGroups();
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(groupChannel);
    };
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const markAsRead = async (messageId: string) => {
    if (!supabase) return;
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', messageId);
  };

  const fetchMessages = async (chat: ActiveChat) => {
    if (!supabase || !schoolId) return;

    setIsLoadingMessages(true);
    setMessages([]);

    try {
      let query;
      if (chat.kind === 'dm') {
        query = supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${parentId},receiver_id.eq.${chat.contact.id}),and(sender_id.eq.${chat.contact.id},receiver_id.eq.${parentId})`)
          .order('created_at', { ascending: true });
      } else {
        query = supabase
          .from('messages')
          .select('*')
          .eq('group_id', chat.group.id)
          .order('created_at', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;

      const loadedMessages = (data || []) as MessageRecord[];
      setMessages(loadedMessages);

      if (chat.kind === 'dm') {
        const unread = loadedMessages.filter((message) => message.receiver_id === parentId && !message.read_at);
        if (unread.length > 0) {
          await Promise.all(unread.map((message) => markAsRead(message.id)));
          void loadContacts();
        }
      }
    } catch (error) {
      console.error('Parent messaging fetch messages error:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeChat) {
      void fetchMessages(activeChat);
    }
  }, [activeChat]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !schoolId || !activeChat || !newMessage.trim()) return;

    const trimmedMessage = newMessage.trim();
    const payload: any = {
      sender_id: parentId,
      content: trimmedMessage,
      school_id: schoolId,
      ...(activeChat.kind === 'group'
        ? { group_id: activeChat.group.id, receiver_id: null }
        : { receiver_id: activeChat.contact.id, group_id: null }),
    };

    const optimisticMessage: MessageRecord = {
      id: `opt-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, optimisticMessage]);
    setNewMessage('');

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (error) throw error;

      setMessages((previous) => previous.map((message) => message.id === optimisticMessage.id ? data : message));
      if (activeChat.kind === 'group') {
        void loadGroups();
      } else {
        void loadContacts();
      }
    } catch (error) {
      console.error('Parent messaging send error:', error);
      setMessages((previous) => previous.filter((message) => message.id !== optimisticMessage.id));
      setNewMessage(trimmedMessage);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!supabase) return;

    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;

      setMessages((previous) => previous.filter((message) => message.id !== messageId));
      setDeletingMessageId(null);
      if (activeChat?.kind === 'group') {
        void loadGroups();
      } else {
        void loadContacts();
      }
    } catch (error) {
      console.error('Parent messaging delete error:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!supabase || !schoolId) return;
    if (!newGroupName.trim() || selectedMemberIds.size === 0) {
      setCreateGroupError('Please enter a group name and select at least one staff member.');
      return;
    }

    setIsCreatingGroup(true);
    setCreateGroupError(null);

    try {
      const { data: group, error: groupError } = await supabase
        .from('message_groups')
        .insert([{ name: newGroupName.trim(), created_by: parentId, school_id: schoolId }])
        .select()
        .single();

      if (groupError) throw groupError;

      const selectedContacts = contacts.filter((contact) => selectedMemberIds.has(contact.id));
      const nextMembers: GroupMember[] = [
        {
          group_id: group.id,
          user_id: parentId,
          user_role: 'parent',
          user_name: parentName,
          user_avatar: currentUserAvatar,
        },
        ...selectedContacts.map((contact) => ({
          group_id: group.id,
          user_id: contact.id,
          user_role: contact.role,
          user_name: contact.name,
          user_avatar: contact.avatar,
        })),
      ];

      const { error: membersError } = await supabase.from('message_group_members').insert(nextMembers);
      if (membersError) throw membersError;

      const createdGroup: MessageGroup = {
        ...group,
        members: nextMembers,
        lastMessageAt: group.created_at,
      };

      setGroups((previous) => [createdGroup, ...previous.filter((entry) => entry.id !== createdGroup.id)]);
      setActiveChat({ kind: 'group', group: createdGroup });
      setIsCreateGroupOpen(false);
      setNewGroupName('');
      setSelectedMemberIds(new Set());
    } catch (error) {
      console.error('Parent create group error:', error);
      setCreateGroupError('Failed to create group. Please try again.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAddMember = async (contact: StaffContact) => {
    if (!supabase || activeChat?.kind !== 'group') return;

    setAddingMemberId(contact.id);

    try {
      const payload = {
        group_id: activeChat.group.id,
        user_id: contact.id,
        user_role: contact.role,
        user_name: contact.name,
        user_avatar: contact.avatar,
      };

      const { error } = await supabase.from('message_group_members').insert([payload]);
      if (error) throw error;

      const nextMembers = [...(activeChat.group.members || []), payload];
      const updatedGroup = { ...activeChat.group, members: nextMembers };

      setActiveChat({ kind: 'group', group: updatedGroup });
      setGroups((previous) => previous.map((group) => group.id === updatedGroup.id ? updatedGroup : group));
    } catch (error) {
      console.error('Parent add member error:', error);
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!supabase || activeChat?.kind !== 'group') return;

    setRemovingMemberId(memberId);

    try {
      const { error } = await supabase
        .from('message_group_members')
        .delete()
        .eq('group_id', activeChat.group.id)
        .eq('user_id', memberId);

      if (error) throw error;

      const nextMembers = (activeChat.group.members || []).filter((member) => member.user_id !== memberId);
      const updatedGroup = { ...activeChat.group, members: nextMembers };

      setActiveChat({ kind: 'group', group: updatedGroup });
      setGroups((previous) => previous.map((group) => group.id === updatedGroup.id ? updatedGroup : group));
    } catch (error) {
      console.error('Parent remove member error:', error);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(query)
      || contact.email.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  const groupedContacts = useMemo(() => {
    return {
      admin: filteredContacts.filter((contact) => contact.role === 'admin'),
      teacher: filteredContacts.filter((contact) => contact.role === 'teacher'),
      student_service: filteredContacts.filter((contact) => contact.role === 'student_service'),
    };
  }, [filteredContacts]);

  const groupEligibleContacts = useMemo(
    () => contacts.filter((contact) => contact.role !== 'admin'),
    [contacts]
  );

  const nonMembers = useMemo(() => {
    if (activeChat?.kind !== 'group') return [];
    const memberIds = new Set((activeChat.group.members || []).map((member) => member.user_id));
    return groupEligibleContacts.filter((contact) => !memberIds.has(contact.id));
  }, [groupEligibleContacts, activeChat]);

  const activeChatTitle = activeChat?.kind === 'dm' ? activeChat.contact.name : activeChat?.group.name || '';
  const activeChatAvatar = activeChat?.kind === 'dm'
    ? getAvatarUrl(activeChat.contact.name, activeChat.contact.avatar)
    : null;
  const totalUnread = contacts.reduce((sum, contact) => sum + (contact.unreadCount || 0), 0);

  if (!schoolId || !parentId) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-sm font-semibold text-rose-700">
        Parent messaging is unavailable because the school session could not be resolved.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em]">
              <ShieldCheck className="w-4 h-4" />
              Parent Messaging Network
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tighter text-slate-900">Messages & Group Chats</h2>
              <p className="text-slate-500 mt-2 font-medium max-w-2xl">
                Connect directly with teachers, student service staff, and school administration while keeping every conversation linked to your school account.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {studentNames.slice(0, 4).map((studentName) => (
                <span key={studentName} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  {studentName}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-full xl:min-w-[460px]">
            {[
              { label: 'School Contacts', value: contacts.length },
              { label: 'Group Chats', value: groups.length },
              { label: 'Unread', value: totalUnread },
              { label: 'Parent ID', value: 'Live', accent: true },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-[1.5rem] border px-4 py-4 ${stat.accent ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              >
                <p className={`text-2xl font-black ${stat.accent ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${stat.accent ? 'text-emerald-100' : 'text-slate-400'}`}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
            <img src={currentUserAvatar} alt={parentName} className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-black text-slate-900">{parentName}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{parentEmail}</p>
            </div>
          </div>
          <button
            onClick={() => { void loadContacts(); void loadGroups(); }}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-all text-[11px] font-black uppercase tracking-widest"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Inbox
          </button>
        </div>
      </div>

      {panelError && (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {panelError}
        </div>
      )}

      <div className="flex h-[760px] max-h-[calc(100vh-12rem)] bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-[340px] min-h-0 border-r border-slate-200 flex flex-col bg-slate-50/70">
          <div className="p-5 border-b border-slate-200 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  Inbox
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Direct and Group Channels</p>
              </div>
              <button
                onClick={() => {
                  setIsCreateGroupOpen(true);
                  setCreateGroupError(null);
                  setNewGroupName('');
                  setSelectedMemberIds(new Set());
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Users className="w-4 h-4" />
                New Group
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search contacts or group chats..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto border-t border-slate-100">
            {isLoadingContacts ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-emerald-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading conversations...</p>
              </div>
            ) : (
              <div className="p-4 space-y-5">
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Group Chats</p>
                    <span className="text-[10px] font-black text-slate-400">{filteredGroups.length}</span>
                  </div>
                  {filteredGroups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No groups yet</p>
                    </div>
                  ) : (
                    filteredGroups.map((group) => {
                      const isActive = activeChat?.kind === 'group' && activeChat.group.id === group.id;
                      return (
                        <button
                          key={group.id}
                          onClick={() => setActiveChat({ kind: 'group', group })}
                          className={`w-full text-left rounded-2xl border px-4 py-4 transition-all ${isActive ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/60'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex items-start gap-3">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/15 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>{group.name}</p>
                                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                                  {(group.members || []).length} members
                                </p>
                                {group.lastMessage && (
                                  <p className={`text-xs mt-2 truncate ${isActive ? 'text-emerald-50' : 'text-slate-500'}`}>{group.lastMessage.content}</p>
                                )}
                              </div>
                            </div>
                            <span className={`text-[10px] font-black shrink-0 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {formatTime(group.lastMessageAt)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </section>

                {(Object.keys(groupedContacts) as ContactRole[]).map((role) => {
                  const entries = groupedContacts[role];
                  const isExpanded = expandedRoles[role];
                  return (
                    <section key={role} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setExpandedRoles((previous) => ({
                          ...previous,
                          [role]: !previous[role],
                        }))}
                        className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-emerald-200 hover:bg-emerald-50/60 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{roleMeta[role].label}</p>
                            <p className="text-xs font-bold text-slate-500 mt-0.5">{entries.length} contact{entries.length === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${roleMeta[role].badge}`}>
                          {entries.length}
                        </span>
                      </button>

                      {!isExpanded ? null : entries.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No matches</p>
                        </div>
                      ) : (
                        entries.map((contact) => {
                          const isActive = activeChat?.kind === 'dm' && activeChat.contact.id === contact.id;
                          return (
                            <button
                              key={contact.id}
                              onClick={() => setActiveChat({ kind: 'dm', contact })}
                              className={`w-full text-left rounded-2xl border px-4 py-4 transition-all ${isActive ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10' : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/60'}`}
                            >
                              <div className="flex items-start gap-3">
                                <img src={getAvatarUrl(contact.name, contact.avatar)} alt={contact.name} className="w-11 h-11 rounded-2xl object-cover shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>{contact.name}</p>
                                    <span className={`text-[10px] font-black shrink-0 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                                      {formatTime(contact.lastMessageAt)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-white/15 text-white' : roleMeta[contact.role].badge}`}>
                                      {getContactRoleLabel(contact.role)}
                                    </span>
                                    {!!contact.unreadCount && (
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-rose-400 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                        {contact.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs mt-2 truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {contact.lastMessage?.content || contact.email}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          {activeChat ? (
            <>
              <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {activeChat.kind === 'group' ? (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : (
                    <img src={activeChatAvatar || currentUserAvatar} alt={activeChatTitle} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-slate-900 truncate">{activeChatTitle}</h3>
                    {activeChat.kind === 'dm' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${roleMeta[activeChat.contact.role].badge}`}>
                          {getContactRoleLabel(activeChat.contact.role)}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {activeChat.contact.role === 'admin'
                            ? 'Administrative Channel'
                            : (activeChat.contact.teacherschool_id || activeChat.contact.staffschool_id || activeChat.contact.role.replace('_', ' '))}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                        {(activeChat.group.members || []).length} members · {(activeChat.group.members || []).map((member) => member.user_name.split(' ')[0]).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeChat.kind === 'group' && activeChat.group.created_by === parentId && (
                    <button
                      onClick={() => setIsAddMemberOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Member
                    </button>
                  )}
                  <button
                    onClick={() => setActiveChat(null)}
                    className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-slate-200 bg-emerald-50/70 flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <p className="text-[11px] font-bold text-emerald-800">
                  Parent conversations are monitored by the school for safeguarding, continuity, and institutional support.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-[linear-gradient(180deg,rgba(240,253,250,0.75),rgba(255,255,255,0.98))]">
                {isLoadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-emerald-600">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Loading thread...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                    <div className="w-24 h-24 rounded-[2rem] bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
                      <MessageSquare className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-black text-slate-900">Start the conversation</h4>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm">
                      Ask a question, coordinate with school staff, or open a shared group channel for a focused discussion.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwn = message.sender_id === parentId;
                      const isOptimistic = message.id.startsWith('opt-');
                      const isDeleting = deletingMessageId === message.id;

                      let senderName = parentName;
                      let senderAvatar = currentUserAvatar;

                      if (!isOwn) {
                        if (activeChat.kind === 'dm') {
                          senderName = activeChat.contact.name;
                          senderAvatar = getAvatarUrl(activeChat.contact.name, activeChat.contact.avatar);
                        } else {
                          const senderMember = (activeChat.group.members || []).find((member) => member.user_id === message.sender_id);
                          senderName = senderMember?.user_name || 'Staff';
                          senderAvatar = getAvatarUrl(senderName, senderMember?.user_avatar);
                        }
                      }

                      return (
                        <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                          {!isOwn && (
                            <img src={senderAvatar} alt={senderName} className="w-8 h-8 rounded-xl object-cover mt-auto mr-3 shrink-0" />
                          )}
                          <div className="max-w-[72%] space-y-1">
                            {!isOwn && activeChat.kind === 'group' && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">{senderName}</p>
                            )}
                            <div
                              className={`relative rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                                isOwn
                                  ? 'bg-emerald-600 text-white rounded-br-md shadow-lg shadow-emerald-600/20'
                                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                              } ${isOptimistic ? 'opacity-70' : ''}`}
                            >
                              {isDeleting ? (
                                <div className="flex items-center gap-3">
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isOwn ? 'text-emerald-100' : 'text-rose-500'}`}>Delete this message?</span>
                                  <button
                                    onClick={() => void handleDeleteMessage(message.id)}
                                    className="px-3 py-1 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeletingMessageId(null)}
                                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                      isOwn ? 'bg-white/15 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {message.content}
                                  {isOwn && !isOptimistic && (
                                    <button
                                      onClick={() => setDeletingMessageId(message.id)}
                                      className="absolute -left-10 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                                      title="Delete message"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                            <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isOwn ? 'text-right text-emerald-700' : 'text-left text-slate-400'}`}>
                              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {isOwn && !isOptimistic && (
                                <span className="ml-1">{message.read_at ? 'Seen' : 'Sent'}</span>
                              )}
                              {isOptimistic && <span className="ml-1">Sending</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-200 bg-white">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder={`Message ${activeChatTitle}...`}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-14 h-14 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-600/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-28 h-28 rounded-[2rem] bg-emerald-100 text-emerald-700 flex items-center justify-center mb-6 shadow-inner">
                <Headset className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Select a school conversation</h3>
              <p className="text-sm text-slate-500 mt-3 max-w-md">
                Open a direct message, review an active group chat, or create a coordination room for your child’s school matters.
              </p>
            </div>
          )}
        </div>
      </div>

      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">Create Group Chat</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Invite teachers and staff into one room</p>
              </div>
              <button onClick={() => setIsCreateGroupOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="e.g. Math Support Circle"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Add Members ({selectedMemberIds.size})
                </label>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {groupEligibleContacts.map((contact) => {
                    const isSelected = selectedMemberIds.has(contact.id);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedMemberIds((previous) => {
                          const next = new Set(previous);
                          if (next.has(contact.id)) next.delete(contact.id);
                          else next.add(contact.id);
                          return next;
                        })}
                        className={`w-full rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
                      >
                        <img src={getAvatarUrl(contact.name, contact.avatar)} alt={contact.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-black text-slate-900">{contact.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                            {getContactRoleLabel(contact.role)}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {createGroupError && (
                <p className="text-sm font-semibold text-rose-600">{createGroupError}</p>
              )}

              <button
                onClick={() => void handleCreateGroup()}
                disabled={isCreatingGroup || !newGroupName.trim() || selectedMemberIds.size === 0}
                className="w-full rounded-2xl bg-emerald-600 text-white py-4 font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddMemberOpen && activeChat?.kind === 'group' && (
        <div className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Manage Members</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Add or remove staff participants</p>
              </div>
              <button onClick={() => setIsAddMemberOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Members</p>
                <div className="flex flex-wrap gap-2">
                  {(activeChat.group.members || []).map((member) => (
                    <div key={member.user_id} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                      <img src={getAvatarUrl(member.user_name, member.user_avatar)} alt={member.user_name} className="w-7 h-7 rounded-lg object-cover" />
                      <div>
                        <p className="text-xs font-black text-slate-900">{member.user_name.split(' ')[0]}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{String(member.user_role).replace('_', ' ')}</p>
                      </div>
                      {activeChat.group.created_by === parentId && member.user_id !== parentId && (
                        <button
                          onClick={() => void handleRemoveMember(member.user_id)}
                          disabled={removingMemberId === member.user_id}
                          className="ml-1 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 disabled:opacity-50"
                        >
                          {removingMemberId === member.user_id ? '...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add Staff</p>
                {nonMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                    All available staff contacts are already in this group.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {nonMembers.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => void handleAddMember(contact)}
                        disabled={addingMemberId === contact.id}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 transition-all disabled:opacity-60"
                      >
                        <img src={getAvatarUrl(contact.name, contact.avatar)} alt={contact.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-black text-slate-900">{contact.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                            {getContactRoleLabel(contact.role)}
                          </p>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          {addingMemberId === contact.id ? 'Adding' : 'Add'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentMessagingCenter;
