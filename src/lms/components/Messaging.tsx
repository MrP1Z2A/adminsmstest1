
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../src/supabaseClient';
import { Contact, Message, User } from '../types';

interface MessagingProps {
  currentUser: User;
  schoolId: string;
}

const Messaging: React.FC<MessagingProps> = ({ currentUser, schoolId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContacts();
  }, [schoolId]);

  // Global listener for all incoming messages (unopened chats)
  useEffect(() => {
    if (!supabase || !currentUser.id) return;

    const globalChannel = supabase
      .channel(`global-messages:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq."${currentUser.id}"`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new as Message;
            if (activeContact && msg.sender_id === activeContact.id) {
              setMessages((prev) => {
                const alreadyExists = prev.some(m => m.id === msg.id);
                if (alreadyExists) return prev;
                return [...prev, msg];
              });
              markAsRead(msg.id);
            }
            // Always refresh contacts to update unread count, last message preview, and re-sort
            fetchContacts();
          } else if (payload.eventType === 'DELETE') {
            const oldMsg = payload.old as { id: string };
            setMessages((prev) => prev.filter(m => m.id !== oldMsg.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq."${currentUser.id}"`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(globalChannel);
    };
  }, [currentUser.id, activeContact?.id]);

  useEffect(() => {
    if (activeContact) {
      fetchMessages(activeContact.id);
      
      const channel = supabase
        ?.channel(`messages:${currentUser.id}:${activeContact.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq."${currentUser.id}"`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const msg = payload.new as Message;
              if (msg.sender_id === activeContact.id) {
                setMessages((prev) => {
                  const alreadyExists = prev.some(m => m.id === msg.id);
                  if (alreadyExists) return prev;
                  return [...prev, msg];
                });
                markAsRead(msg.id);
              }
            } else if (payload.eventType === 'DELETE') {
              const oldMsg = payload.old as { id: string };
              setMessages((prev) => prev.filter(m => m.id !== oldMsg.id));
            }
          }
        )
        .subscribe();

      return () => {
        if (channel) supabase?.removeChannel(channel);
      };
    }
  }, [activeContact, currentUser.id]);

  useEffect(() => {
    if (activeContact) {
      scrollToBottom();
    }
  }, [activeContact?.id]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchContacts = async () => {
    if (!supabase) return;
    setIsLoadingContacts(true);
    try {
      // Fetch Teachers
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, name, email, avatar')
        .eq('school_id', schoolId);

      // Fetch Peers (students in the same school)
      const { data: students } = await supabase
        .from('students')
        .select('id, name, email, avatar')
        .eq('school_id', schoolId)
        .neq('id', currentUser.id);

      // Fetch Student Services
      const { data: services } = await supabase
        .from('student_services')
        .select('id, name, email, avatar')
        .eq('school_id', schoolId);

      const allContacts: Contact[] = [
        ...(teachers?.map(t => ({ ...t, auth_user_id: t.id, role: 'teacher' as const })) || []),
        ...(students?.map(s => ({ ...s, auth_user_id: s.id, role: 'student' as const })) || []),
        ...(services?.map(sv => ({ ...sv, auth_user_id: sv.id, role: 'student_service' as const })) || []),
      ];

      const allContactIds = allContacts.map(c => c.id);

      // Fetch all messages involving the current user in bulk
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at, read_at')
        .or(`sender_id.eq."${currentUser.id}",receiver_id.eq."${currentUser.id}"`)
        .order('created_at', { ascending: false });

      // Build per-contact metadata from the messages
      const contactLastMsgMap: Record<string, { lastAt: string; lastContent: string }> = {};
      const unreadCounts: Record<string, number> = {};

      for (const msg of (allMessages || [])) {
        const otherId =
          msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;

        if (!allContactIds.includes(otherId)) continue;

        // Track last message timestamp (messages are desc, so first hit = latest)
        if (!contactLastMsgMap[otherId]) {
          contactLastMsgMap[otherId] = {
            lastAt: msg.created_at,
            lastContent: msg.content,
          };
        }

        // Count unread messages from others
        if (msg.receiver_id === currentUser.id && !msg.read_at) {
          unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
        }
      }

      const enrichedContacts = allContacts.map(c => ({
        ...c,
        unreadCount: unreadCounts[c.id] || 0,
        lastMessageAt: contactLastMsgMap[c.id]?.lastAt,
        lastMessage: contactLastMsgMap[c.id]
          ? ({ content: contactLastMsgMap[c.id].lastContent, created_at: contactLastMsgMap[c.id].lastAt } as Message)
          : undefined,
      }));

      // Sort: contacts with messages first (most recent on top), then alphabetically
      enrichedContacts.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(enrichedContacts);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!supabase) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq."${currentUser.id}",receiver_id.eq."${contactId}"),and(sender_id.eq."${contactId}",receiver_id.eq."${currentUser.id}")`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const fetchedMessages = data || [];
      setMessages(fetchedMessages);

      // Mark unread incoming messages as read
      const unreadIncoming = fetchedMessages.filter(m => m.receiver_id === currentUser.id && !m.read_at);
      if (unreadIncoming.length > 0) {
        await Promise.all(unreadIncoming.map(m => markAsRead(m.id)));
        fetchContacts();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeContact || !supabase) return;

    const messageData = {
      sender_id: currentUser.id,
      receiver_id: activeContact.id,
      content: newMessage.trim(),
      school_id: schoolId,
    };

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      ...messageData,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
      // Refresh contacts to update last message and sort order
      fetchContacts();
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!supabase) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setDeletingMessageId(null);
      fetchContacts();
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  const formatLastMessageTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getRoleBadgeColor = (role: Contact['role']) => {
    switch (role) {
      case 'teacher': return 'text-amber-400';
      case 'student_service': return 'text-purple-400';
      default: return 'text-[#4ea59d]';
    }
  };

  return (
    <div className="flex bg-[#0a1a19]/40 backdrop-blur-2xl rounded-[40px] border border-white/20 h-[700px] overflow-hidden shadow-2xl animate-in fade-in duration-500">
      {/* Sidebar: Contact List */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#0a1a19]/60">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-comments text-[#4ea59d]"></i> Messages
          </h3>
          <div className="mt-4 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-10 pr-9 text-xs text-white focus:outline-none focus:border-[#4ea59d] transition-all placeholder:text-slate-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {isLoadingContacts ? (
             <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
               <div className="w-8 h-8 border-4 border-[#4ea59d] border-t-transparent rounded-full animate-spin"></div>
               <p className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Loading contacts...</p>
             </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-40 px-4 text-center">
              {searchQuery ? (
                <>
                  <i className="fa-solid fa-magnifying-glass text-3xl mb-3 text-slate-400"></i>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No results for</p>
                  <p className="text-sm font-bold text-white mt-1">"{searchQuery}"</p>
                </>
              ) : (
                <p className="text-xs text-slate-500 font-bold">No contacts found</p>
              )}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveContact(contact)}
                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all group relative ${
                  activeContact?.id === contact.id 
                    ? 'bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20' 
                    : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <div className="relative shrink-0">
                  <img 
                    src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=4ea59d&color=fff`} 
                    className="w-11 h-11 rounded-xl object-cover" 
                    alt={contact.name}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a1a19]"></div>
                </div>
                <div className="flex-1 text-left overflow-hidden min-w-0">
                  <div className="flex justify-between items-center gap-1">
                    <h4 className={`text-xs font-black truncate ${
                      contact.unreadCount && contact.unreadCount > 0 && activeContact?.id !== contact.id
                        ? 'text-white'
                        : ''
                    }`}>{contact.name}</h4>
                    <span className={`text-[8px] font-bold shrink-0 ${
                      activeContact?.id === contact.id ? 'text-white/70' : 'text-slate-500'
                    }`}>
                      {formatLastMessageTime(contact.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className={`text-[10px] truncate ${
                      activeContact?.id === contact.id 
                        ? 'text-white/70' 
                        : contact.lastMessage 
                          ? 'text-slate-400'
                          : getRoleBadgeColor(contact.role)
                    }`}>
                      {contact.lastMessage 
                        ? contact.lastMessage.content 
                        : contact.role.replace('_', ' ')}
                    </p>
                    {contact.unreadCount && contact.unreadCount > 0 && activeContact?.id !== contact.id ? (
                      <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#fa6d64] text-[9px] font-black text-white animate-pulse">
                        {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer: contact count */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 text-center">
            {searchQuery
              ? `${filteredContacts.length} of ${contacts.length} contacts`
              : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0a1a19]/20">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img 
                    src={activeContact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeContact.name)}&background=4ea59d&color=fff`} 
                    className="w-10 h-10 rounded-xl object-cover" 
                    alt={activeContact.name}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a1a19]"></div>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{activeContact.name}</h4>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${getRoleBadgeColor(activeContact.role)}`}>
                    {activeContact.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  title="Close conversation"
                  onClick={() => setActiveContact(null)}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>

            {/* Message Feed */}
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
                messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUser.id;
                  const isConfirmingDelete = deletingMessageId === msg.id;
                  const isOptimistic = msg.id.startsWith('optimistic-');

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 duration-300`}>
                      {!isOwn && (
                        <img
                          src={activeContact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeContact.name)}&background=4ea59d&color=fff`}
                          className="w-7 h-7 rounded-lg object-cover mr-2 mt-auto shrink-0"
                          alt={activeContact.name}
                        />
                      )}
                      <div className={`max-w-[70%] space-y-1 relative`}>
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed relative ${
                          isOwn 
                            ? `bg-[#4ea59d] text-white rounded-tr-sm shadow-lg shadow-[#4ea59d]/10 ${isOptimistic ? 'opacity-70' : ''}` 
                            : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-sm'
                        }`}>
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-4 py-1">
                              <span className="font-bold text-[10px] uppercase tracking-widest text-rose-200">Delete?</span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="px-3 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-rose-600 transition-all"
                                >
                                  Yes
                                </button>
                                <button 
                                  onClick={() => setDeletingMessageId(null)}
                                  className="px-3 py-1 bg-white/10 text-white rounded-lg text-[9px] font-black uppercase hover:bg-white/20 transition-all"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.content}
                              {isOwn && !isOptimistic && (
                                <button 
                                  onClick={() => setDeletingMessageId(msg.id)}
                                  className="absolute -left-9 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Delete message"
                                >
                                  <i className="fa-solid fa-trash-can text-[9px]"></i>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <p className={`text-[8px] font-black uppercase tracking-widest text-slate-600 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOwn && !isOptimistic && (
                            <span className="ml-1">
                              {msg.read_at ? (
                                <i className="fa-solid fa-check-double text-[#4ea59d]" title="Seen"></i>
                              ) : (
                                <i className="fa-solid fa-check opacity-60" title="Sent"></i>
                              )}
                            </span>
                          )}
                          {isOptimistic && <span className="ml-1 opacity-50"><i className="fa-solid fa-clock text-[7px]"></i></span>}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-[#0a1a19]/40 border-t border-white/10">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message ${activeContact.name}...`}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white focus:outline-none focus:border-[#4ea59d] transition-all placeholder:text-slate-600"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-12 h-12 bg-[#4ea59d] text-white rounded-2xl flex items-center justify-center hover:bg-[#3d8c85] transition-all shadow-lg shadow-[#4ea59d]/20 disabled:opacity-40 disabled:cursor-not-allowed group shrink-0"
                >
                  <i className="fa-solid fa-paper-plane group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-sm"></i>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 mix-blend-overlay">
            <div className="w-32 h-32 bg-[#4ea59d]/20 rounded-[40px] flex items-center justify-center text-[60px] text-[#4ea59d] mb-8 animate-pulse">
              <i className="fa-solid fa-comments"></i>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-[0.3em]">Select a contact</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">To start your communication journey</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messaging;
