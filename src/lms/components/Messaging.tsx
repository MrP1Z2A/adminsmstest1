
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../src/supabaseClient';
import { Contact, Message, User, MessageGroup, GroupMember } from '../types';

interface MessagingProps {
  currentUser: User;
  schoolId: string;
}

type ActiveChat =
  | { kind: 'dm'; contact: Contact }
  | { kind: 'group'; group: MessageGroup };

const Messaging: React.FC<MessagingProps> = ({ currentUser, schoolId }) => {
  // ── Contacts & Groups ──────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  // ── Messages ───────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // ── Loading ────────────────────────────────────────────────
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // ── Sidebar UI ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isGroupsCollapsed, setIsGroupsCollapsed] = useState(false);

  // ── Create Group Modal ─────────────────────────────────────
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  // ── Add Member Modal ───────────────────────────────────────
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Initial Fetch ──────────────────────────────────────────
  useEffect(() => {
    void fetchContacts();
    void fetchGroups();
  }, [schoolId]);

  // ── Realtime DM listener ───────────────────────────────────
  useEffect(() => {
    if (!supabase || !currentUser.id) return;
    const channel = supabase
      .channel(`global-dm:${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq."${currentUser.id}"` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as Message;
          if (activeChat?.kind === 'dm' && msg.sender_id === activeChat.contact.id) {
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
            void markAsRead(msg.id);
          }
          void fetchContacts();
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { if (supabase) supabase.removeChannel(channel); };
  }, [currentUser.id, activeChat]);

  // ── Realtime Group listener ────────────────────────────────
  useEffect(() => {
    if (!supabase || !currentUser.id || activeChat?.kind !== 'group') return;
    const gid = activeChat.group.id;
    const channel = supabase
      .channel(`group-msgs:${gid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${gid}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as Message;
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
        void fetchGroups();
      })
      .subscribe();
    return () => { if (supabase) supabase.removeChannel(channel); };
  }, [activeChat]);

  // ── Auto-scroll ────────────────────────────────────────────
  useEffect(() => { scrollToBottom(); }, [messages.length]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // ── Fetch Contacts ─────────────────────────────────────────
  const fetchContacts = async () => {
    if (!supabase) return;
    setIsLoadingContacts(true);
    try {
      const [{ data: teachers }, { data: students }, { data: services }] = await Promise.all([
        supabase.from('teachers').select('id, name, email, avatar').eq('school_id', schoolId),
        supabase.from('students').select('id, name, email, avatar').eq('school_id', schoolId).neq('id', currentUser.id),
        supabase.from('student_services').select('id, name, email, avatar').eq('school_id', schoolId),
      ]);

      const allContacts: Contact[] = [
        ...(teachers?.map(t => ({ ...t, auth_user_id: t.id, role: 'teacher' as const })) || []),
        ...(students?.map(s => ({ ...s, auth_user_id: s.id, role: 'student' as const })) || []),
        ...(services?.map(sv => ({ ...sv, auth_user_id: sv.id, role: 'student_service' as const })) || []),
      ];

      const allIds = allContacts.map(c => c.id);
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at, read_at')
        .or(`sender_id.eq."${currentUser.id}",receiver_id.eq."${currentUser.id}"`)
        .is('group_id', null)
        .order('created_at', { ascending: false });

      const lastMsgMap: Record<string, { lastAt: string; lastContent: string }> = {};
      const unreadCounts: Record<string, number> = {};

      for (const msg of (allMessages || [])) {
        const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!otherId || !allIds.includes(otherId)) continue;
        if (!lastMsgMap[otherId]) lastMsgMap[otherId] = { lastAt: msg.created_at, lastContent: msg.content };
        if (msg.receiver_id === currentUser.id && !msg.read_at) {
          unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
        }
      }

      const enriched = allContacts.map(c => ({
        ...c,
        unreadCount: unreadCounts[c.id] || 0,
        lastMessageAt: lastMsgMap[c.id]?.lastAt,
        lastMessage: lastMsgMap[c.id] ? ({ content: lastMsgMap[c.id].lastContent, created_at: lastMsgMap[c.id].lastAt } as Message) : undefined,
      }));

      enriched.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(enriched);
    } catch (err) { console.error('fetchContacts:', err); }
    finally { setIsLoadingContacts(false); }
  };

  // ── Fetch Groups ───────────────────────────────────────────
  const fetchGroups = async () => {
    if (!supabase) return;
    try {
      // Get groups where user is a member
      const { data: memberOf } = await supabase
        .from('message_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id);

      const groupIds = (memberOf || []).map((m: any) => m.group_id);
      if (groupIds.length === 0) { setGroups([]); return; }

      const { data: groupData } = await supabase
        .from('message_groups')
        .select('*, message_group_members(*)')
        .in('id', groupIds)
        .eq('school_id', schoolId);

      if (!groupData) return;

      // Fetch last message per group
      const enrichedGroups: MessageGroup[] = await Promise.all(
        groupData.map(async (g: any) => {
          const { data: lastMsgs } = await supabase!
            .from('messages')
            .select('*')
            .eq('group_id', g.id)
            .order('created_at', { ascending: false })
            .limit(1);
          const lastMsg = lastMsgs?.[0];
          return {
            ...g,
            members: g.message_group_members as GroupMember[],
            lastMessageAt: lastMsg?.created_at,
            lastMessage: lastMsg,
          };
        })
      );

      enrichedGroups.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.name.localeCompare(b.name);
      });

      setGroups(enrichedGroups);
    } catch (err) { console.error('fetchGroups:', err); }
  };

  // ── Fetch Messages ─────────────────────────────────────────
  const fetchMessages = async (chat: ActiveChat) => {
    if (!supabase) return;
    setIsLoadingMessages(true);
    setMessages([]);
    try {
      let query;
      if (chat.kind === 'dm') {
        query = supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq."${currentUser.id}",receiver_id.eq."${chat.contact.id}"),and(sender_id.eq."${chat.contact.id}",receiver_id.eq."${currentUser.id}")`)
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
      setMessages(data || []);

      // Mark DMs as read
      if (chat.kind === 'dm') {
        const unread = (data || []).filter(m => m.receiver_id === currentUser.id && !m.read_at);
        if (unread.length > 0) {
          await Promise.all(unread.map(m => markAsRead(m.id)));
          void fetchContacts();
        }
      }
    } catch (err) { console.error('fetchMessages:', err); }
    finally { setIsLoadingMessages(false); }
  };

  useEffect(() => {
    if (activeChat) void fetchMessages(activeChat);
  }, [activeChat]);

  // ── Send Message ───────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !supabase) return;

    const isGroup = activeChat.kind === 'group';
    const messageData: any = {
      sender_id: currentUser.id,
      content: newMessage.trim(),
      school_id: schoolId,
      ...(isGroup
        ? { group_id: activeChat.group.id, receiver_id: null }
        : { receiver_id: activeChat.contact.id, group_id: null }),
    };

    const optimistic: Message = { id: `opt-${Date.now()}`, ...messageData, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');

    try {
      const { data, error } = await supabase.from('messages').insert([messageData]).select().single();
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m));
      if (isGroup) void fetchGroups(); else void fetchContacts();
    } catch (err) {
      console.error('sendMessage:', err);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
  };

  // ── Delete Message ─────────────────────────────────────────
  const handleDeleteMessage = async (messageId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setDeletingMessageId(null);
      if (activeChat?.kind === 'group') void fetchGroups(); else void fetchContacts();
    } catch (err) { console.error('deleteMessage:', err); }
  };

  const markAsRead = async (messageId: string) => {
    if (!supabase) return;
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', messageId);
  };

  // ── Create Group ───────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!supabase || !newGroupName.trim() || selectedMemberIds.size === 0) {
      setCreateGroupError('Please enter a group name and select at least one member.');
      return;
    }
    setIsCreatingGroup(true);
    setCreateGroupError(null);
    try {
      const { data: group, error: gErr } = await supabase
        .from('message_groups')
        .insert([{ name: newGroupName.trim(), created_by: currentUser.id, school_id: schoolId }])
        .select()
        .single();
      if (gErr) throw gErr;

      // Add creator as member
      const members = [
        { group_id: group.id, user_id: currentUser.id, user_role: currentUser.role, user_name: currentUser.name, user_avatar: currentUser.avatar },
        ...contacts.filter(c => selectedMemberIds.has(c.id)).map(c => ({
          group_id: group.id, user_id: c.id, user_role: c.role, user_name: c.name, user_avatar: c.avatar,
        })),
      ];
      const { error: mErr } = await supabase.from('message_group_members').insert(members);
      if (mErr) throw mErr;

      setIsCreateGroupOpen(false);
      setNewGroupName('');
      setSelectedMemberIds(new Set());
      await fetchGroups();
      // Open the newly created group
      setGroups(prev => {
        const newGroup = prev.find(g => g.id === group.id);
        if (newGroup) setActiveChat({ kind: 'group', group: newGroup });
        return prev;
      });
    } catch (err) {
      console.error('createGroup:', err);
      setCreateGroupError('Failed to create group. Please try again.');
    } finally { setIsCreatingGroup(false); }
  };

  // ── Add Member ─────────────────────────────────────────────
  const handleAddMember = async (contact: Contact) => {
    if (!supabase || activeChat?.kind !== 'group') return;
    setAddingMemberId(contact.id);
    try {
      const { error } = await supabase.from('message_group_members').insert([{
        group_id: activeChat.group.id,
        user_id: contact.id,
        user_role: contact.role,
        user_name: contact.name,
        user_avatar: contact.avatar,
      }]);
      if (error) throw error;
      await fetchGroups();
      setIsAddMemberOpen(false);
    } catch (err) { console.error('addMember:', err); }
    finally { setAddingMemberId(null); }
  };

  // ── Remove Member ──────────────────────────────────────────
  const handleRemoveMember = async (memberId: string) => {
    if (!supabase || activeChat?.kind !== 'group') return;
    try {
      await supabase.from('message_group_members').delete().eq('group_id', activeChat.group.id).eq('user_id', memberId);
      await fetchGroups();
    } catch (err) { console.error('removeMember:', err); }
  };

  // ── Helpers ────────────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const groupedContacts = useMemo(() => {
    const g: Record<string, { label: string; icon: string; color: string; bgColor: string; contacts: Contact[] }> = {
      teacher: { label: 'Teachers', icon: 'fa-chalkboard-teacher', color: 'text-amber-400', bgColor: 'bg-amber-400/10', contacts: [] },
      student: { label: 'Students', icon: 'fa-user-graduate', color: 'text-[#4ea59d]', bgColor: 'bg-[#4ea59d]/10', contacts: [] },
      student_service: { label: 'Student Services', icon: 'fa-headset', color: 'text-purple-400', bgColor: 'bg-purple-400/10', contacts: [] },
    };
    for (const c of filteredContacts) { if (g[c.role]) g[c.role].contacts.push(c); }
    return g;
  }, [filteredContacts]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const diffHrs = (Date.now() - date.getTime()) / 3_600_000;
    if (diffHrs < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffHrs < 168) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getRoleColor = (role: Contact['role']) => {
    if (role === 'teacher') return 'text-amber-400';
    if (role === 'student_service') return 'text-purple-400';
    return 'text-[#4ea59d]';
  };

  const activeChatTitle = activeChat?.kind === 'dm' ? activeChat.contact.name : activeChat?.group?.name ?? '';
  const activeChatAvatar = activeChat?.kind === 'dm'
    ? (activeChat.contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeChat.contact.name)}&background=4ea59d&color=fff`)
    : null;

  // Members NOT yet in group — for Add Member modal
  const nonMembers = useMemo(() => {
    if (activeChat?.kind !== 'group') return [];
    const memberIds = new Set((activeChat.group.members || []).map(m => m.user_id));
    return contacts.filter(c => !memberIds.has(c.id));
  }, [contacts, activeChat]);

  return (
    <div className="flex bg-[#0a1a19]/40 backdrop-blur-2xl rounded-[40px] border border-white/20 h-[700px] overflow-hidden shadow-2xl">
      {/* ──────────────── SIDEBAR ──────────────── */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#0a1a19]/60">
        {/* Header */}
        <div className="p-5 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <i className="fa-solid fa-comments text-[#4ea59d]"></i> Messages
            </h3>
            <button
              onClick={() => { setIsCreateGroupOpen(true); setCreateGroupError(null); setNewGroupName(''); setSelectedMemberIds(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4ea59d]/20 hover:bg-[#4ea59d]/30 border border-[#4ea59d]/30 text-[#4ea59d] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              title="Create Group"
            >
              <i className="fa-solid fa-user-group text-[9px]"></i> New Group
            </button>
          </div>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none"></i>
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contacts & groups..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-9 pr-8 text-xs text-white focus:outline-none focus:border-[#4ea59d] transition-all placeholder:text-slate-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isLoadingContacts ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
              <div className="w-8 h-8 border-4 border-[#4ea59d] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Loading...</p>
            </div>
          ) : (
            <>
              {/* ── GROUP CHATS Section ── */}
              {filteredGroups.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsGroupsCollapsed(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 mt-1 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <i className="fa-solid fa-user-group text-sm text-indigo-400"></i>
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Group Chats</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-indigo-400 opacity-70">{filteredGroups.length}</span>
                    </div>
                    <i className={`fa-solid fa-chevron-right text-xs text-slate-400 transition-transform duration-300 ${isGroupsCollapsed ? '' : 'rotate-90'}`}></i>
                  </button>
                  {!isGroupsCollapsed && (
                    <div className="space-y-0.5 mt-1">
                      {filteredGroups.map(grp => {
                        const isActive = activeChat?.kind === 'group' && activeChat.group.id === grp.id;
                        return (
                          <button key={grp.id} onClick={() => setActiveChat({ kind: 'group', group: grp })}
                            className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${isActive ? 'bg-indigo-500/30 border border-indigo-500/40 text-white' : 'hover:bg-white/5 text-slate-300'}`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-users text-indigo-400"></i>
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black truncate">{grp.name}</h4>
                                <span className="text-[8px] font-bold text-slate-500 shrink-0">{formatTime(grp.lastMessageAt)}</span>
                              </div>
                              <p className="text-[10px] truncate text-slate-400 mt-0.5">
                                {grp.lastMessage ? grp.lastMessage.content : `${(grp.members || []).length} members`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── DIRECT MESSAGES ── */}
              {filteredContacts.length === 0 && filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 opacity-40 text-center px-4">
                  <i className="fa-solid fa-magnifying-glass text-2xl mb-2 text-slate-400"></i>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No results for "{searchQuery}"</p>
                </div>
              ) : (
                (Object.entries(groupedContacts) as [string, { label: string; icon: string; color: string; bgColor: string; contacts: Contact[] }][]).map(([roleKey, group]) => {
                  if (group.contacts.length === 0) return null;
                  const isCollapsed = collapsedGroups[roleKey];
                  const hasUnread = group.contacts.some(c => (c.unreadCount ?? 0) > 0 && !(activeChat?.kind === 'dm' && activeChat.contact.id === c.id));
                  return (
                    <div key={roleKey}>
                      <button
                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [roleKey]: !prev[roleKey] }))}
                        className={`w-full flex items-center justify-between px-4 py-3 mt-1 rounded-2xl border transition-all ${isCollapsed ? 'bg-white/3 border-white/5 hover:bg-white/8' : 'bg-white/5 border-white/10 hover:bg-white/8'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${group.bgColor}`}>
                            <i className={`fa-solid ${group.icon} text-sm ${group.color}`}></i>
                          </div>
                          <span className={`text-xs font-black uppercase tracking-widest ${group.color}`}>{group.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 ${group.color} opacity-70`}>{group.contacts.length}</span>
                          {hasUnread && <span className="w-2 h-2 rounded-full bg-[#fa6d64] animate-pulse"></span>}
                        </div>
                        <i className={`fa-solid fa-chevron-right text-xs text-slate-400 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-90'}`}></i>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-0.5 mt-1">
                          {group.contacts.map(contact => {
                            const isActive = activeChat?.kind === 'dm' && activeChat.contact.id === contact.id;
                            return (
                              <button key={contact.id} onClick={() => setActiveChat({ kind: 'dm', contact })}
                                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${isActive ? 'bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20' : 'hover:bg-white/5 text-slate-300'}`}
                              >
                                <div className="relative shrink-0">
                                  <img src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=4ea59d&color=fff`}
                                    className="w-10 h-10 rounded-xl object-cover" alt={contact.name} />
                                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0a1a19]"></div>
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="flex justify-between items-center gap-1">
                                    <h4 className={`text-xs font-black truncate ${contact.unreadCount && contact.unreadCount > 0 && !isActive ? 'text-white' : ''}`}>{contact.name}</h4>
                                    <span className={`text-[8px] font-bold shrink-0 ${isActive ? 'text-white/70' : 'text-slate-500'}`}>{formatTime(contact.lastMessageAt)}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-1 mt-0.5">
                                    <p className={`text-[10px] truncate ${isActive ? 'text-white/70' : contact.lastMessage ? 'text-slate-400' : getRoleColor(contact.role)}`}>
                                      {contact.lastMessage ? contact.lastMessage.content : contact.role.replace('_', ' ')}
                                    </p>
                                    {contact.unreadCount && contact.unreadCount > 0 && !isActive
                                      ? <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#fa6d64] text-[9px] font-black text-white animate-pulse">{contact.unreadCount > 9 ? '9+' : contact.unreadCount}</span>
                                      : null}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {isCollapsed && hasUnread && (
                        <div className="mx-2 mb-1 px-3 py-1.5 rounded-xl bg-[#fa6d64]/10 border border-[#fa6d64]/20">
                          <p className="text-[9px] font-black text-[#fa6d64] uppercase tracking-widest">
                            {group.contacts.filter(c => (c.unreadCount ?? 0) > 0).length} unread
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 text-center">
            {contacts.length} contacts · {groups.length} groups
          </p>
        </div>
      </div>

      {/* ──────────────── MAIN CHAT AREA ──────────────── */}
      <div className="flex-1 flex flex-col relative">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0a1a19]/20">
              <div className="flex items-center gap-4">
                {activeChat.kind === 'dm' ? (
                  <div className="relative">
                    <img src={activeChatAvatar!} className="w-10 h-10 rounded-xl object-cover" alt={activeChatTitle} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a1a19]"></div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-users text-indigo-400"></i>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-black text-white">{activeChatTitle}</h4>
                  {activeChat.kind === 'dm' ? (
                    <p className={`text-[10px] font-black uppercase tracking-widest ${getRoleColor(activeChat.contact.role)}`}>
                      {activeChat.contact.role.replace('_', ' ')}
                    </p>
                  ) : (
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">
                      {(activeChat.group.members || []).length} members
                      {' · '}
                      {(activeChat.group.members || []).map(m => m.user_name.split(' ')[0]).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {activeChat.kind === 'group' && (
                  <button
                    onClick={() => setIsAddMemberOpen(true)}
                    title="Add member"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    <i className="fa-solid fa-user-plus text-xs"></i> Add
                  </button>
                )}
                <button onClick={() => setActiveChat(null)} title="Close"
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-[#4ea59d] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20">
                  <i className="fa-solid fa-message text-6xl mb-4"></i>
                  <p className="text-sm font-black uppercase tracking-[0.2em]">Start a conversation</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.sender_id === currentUser.id;
                  const isOpt = msg.id.startsWith('opt-');
                  const isConfirming = deletingMessageId === msg.id;

                  // For group messages, find sender name
                  const senderMember = activeChat.kind === 'group'
                    ? (activeChat.group.members || []).find(m => m.user_id === msg.sender_id)
                    : null;

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                      {!isOwn && activeChat.kind === 'group' && (
                        <img
                          src={senderMember?.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderMember?.user_name || 'User')}&background=4ea59d&color=fff`}
                          className="w-7 h-7 rounded-lg object-cover mr-2 mt-auto shrink-0" alt=""
                        />
                      )}
                      {!isOwn && activeChat.kind === 'dm' && (
                        <img src={activeChatAvatar!} className="w-7 h-7 rounded-lg object-cover mr-2 mt-auto shrink-0" alt="" />
                      )}
                      <div className="max-w-[70%] space-y-0.5">
                        {!isOwn && activeChat.kind === 'group' && senderMember && (
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 pl-1">{senderMember.user_name}</p>
                        )}
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed relative ${
                          isOwn
                            ? `bg-[#4ea59d] text-white rounded-tr-sm shadow-lg shadow-[#4ea59d]/10 ${isOpt ? 'opacity-60' : ''}`
                            : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-sm'
                        }`}>
                          {isConfirming ? (
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-[10px] uppercase tracking-widest text-rose-200">Delete?</span>
                              <button onClick={() => void handleDeleteMessage(msg.id)} className="px-3 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-rose-600 transition-all">Yes</button>
                              <button onClick={() => setDeletingMessageId(null)} className="px-3 py-1 bg-white/10 text-white rounded-lg text-[9px] font-black uppercase hover:bg-white/20 transition-all">No</button>
                            </div>
                          ) : (
                            <>
                              {msg.content}
                              {isOwn && !isOpt && (
                                <button onClick={() => setDeletingMessageId(msg.id)}
                                  className="absolute -left-9 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Delete">
                                  <i className="fa-solid fa-trash-can text-[9px]"></i>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <p className={`text-[8px] font-black uppercase tracking-widest text-slate-600 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOwn && !isOpt && (
                            <span className="ml-1">{msg.read_at ? <i className="fa-solid fa-check-double text-[#4ea59d]"></i> : <i className="fa-solid fa-check opacity-60"></i>}</span>
                          )}
                          {isOpt && <span className="ml-1 opacity-40"><i className="fa-solid fa-clock"></i></span>}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-5 bg-[#0a1a19]/40 border-t border-white/10">
              <form onSubmit={e => void handleSendMessage(e)} className="flex gap-3">
                <input
                  type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeChatTitle}...`}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white focus:outline-none focus:border-[#4ea59d] transition-all placeholder:text-slate-600"
                />
                <button type="submit" disabled={!newMessage.trim()}
                  className="w-12 h-12 bg-[#4ea59d] text-white rounded-2xl flex items-center justify-center hover:bg-[#3d8c85] transition-all shadow-lg disabled:opacity-40 group shrink-0">
                  <i className="fa-solid fa-paper-plane group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-sm"></i>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40">
            <div className="w-32 h-32 bg-[#4ea59d]/20 rounded-[40px] flex items-center justify-center text-[60px] text-[#4ea59d] mb-8 animate-pulse">
              <i className="fa-solid fa-comments"></i>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-[0.3em]">Select a chat</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Direct message or group chat</p>
          </div>
        )}
      </div>

      {/* ──────────────── CREATE GROUP MODAL ──────────────── */}
      {isCreateGroupOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[40px]">
          <div className="bg-[#0d2624] border border-white/20 rounded-[32px] shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-user-group text-indigo-400"></i>
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">Create Group</h3>
              </div>
              <button onClick={() => setIsCreateGroupOpen(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Group Name</label>
                <input
                  type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  placeholder="e.g. Grade 5 Science Team"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Add Members <span className="text-indigo-400">({selectedMemberIds.size} selected)</span>
                </label>
                <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {contacts.map(c => {
                    const selected = selectedMemberIds.has(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setSelectedMemberIds(prev => { const s = new Set(prev); selected ? s.delete(c.id) : s.add(c.id); return s; })}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selected ? 'bg-indigo-500/20 border border-indigo-500/40' : 'hover:bg-white/5 border border-transparent'}`}
                      >
                        <img src={c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=4ea59d&color=fff`}
                          className="w-8 h-8 rounded-lg object-cover shrink-0" alt={c.name} />
                        <div className="flex-1 text-left">
                          <p className="text-xs font-black text-white">{c.name}</p>
                          <p className={`text-[9px] font-bold uppercase ${getRoleColor(c.role)}`}>{c.role.replace('_', ' ')}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'}`}>
                          {selected && <i className="fa-solid fa-check text-[8px] text-white"></i>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {createGroupError && (
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{createGroupError}</p>
              )}
              <button
                onClick={() => void handleCreateGroup()}
                disabled={isCreatingGroup || !newGroupName.trim() || selectedMemberIds.size === 0}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/20"
              >
                {isCreatingGroup ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Creating...</span> : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── ADD MEMBER MODAL ──────────────── */}
      {isAddMemberOpen && activeChat?.kind === 'group' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[40px]">
          <div className="bg-[#0d2624] border border-white/20 rounded-[32px] shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Add Members</h3>
              <button onClick={() => setIsAddMemberOpen(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-4">
              {/* Current members */}
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Current Members</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {(activeChat.group.members || []).map(m => (
                  <div key={m.user_id} className="flex items-center gap-1.5 bg-white/5 rounded-xl px-2.5 py-1.5">
                    <img src={m.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user_name)}&background=4ea59d&color=fff`}
                      className="w-5 h-5 rounded-md object-cover" alt="" />
                    <span className="text-[10px] font-bold text-white">{m.user_name.split(' ')[0]}</span>
                    {m.user_id !== currentUser.id && activeChat.group.created_by === currentUser.id && (
                      <button onClick={() => void handleRemoveMember(m.user_id)} className="text-slate-500 hover:text-rose-400 transition-colors ml-0.5">
                        <i className="fa-solid fa-xmark text-[8px]"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new members */}
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Add to Group</p>
              {nonMembers.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">All contacts are already in this group.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                  {nonMembers.map(c => (
                    <button key={c.id} onClick={() => void handleAddMember(c)} disabled={addingMemberId === c.id}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-indigo-500/20 hover:border-indigo-500/30 border border-transparent transition-all"
                    >
                      <img src={c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=4ea59d&color=fff`}
                        className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                      <div className="flex-1 text-left">
                        <p className="text-xs font-black text-white">{c.name}</p>
                        <p className={`text-[9px] font-bold uppercase ${getRoleColor(c.role)}`}>{c.role.replace('_', ' ')}</p>
                      </div>
                      {addingMemberId === c.id
                        ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                        : <i className="fa-solid fa-plus text-indigo-400 text-xs"></i>
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messaging;
