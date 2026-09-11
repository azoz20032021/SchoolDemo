import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageCircle, Plus, Search, Send } from 'lucide-react';
import { UserData } from '../types';
import { api, ApiError, formatDay, formatTime } from '../lib/api';
import { Badge, ErrorBanner, Modal, Spinner, inputClass } from '../components/ui';
import { Chips, Nothing, Page, PageTitle, Panel, Row, Rows } from '../components/ui/shell';
import { roleLabel } from '../lib/roles';
import { t } from '../i18n';

/**
 * Messages between home and school.
 *
 * Two screens in one: the list of conversations, and one conversation open. On
 * a phone that is the right shape — you are either choosing who to talk to or
 * talking to them — and it avoids a split view that would leave both halves too
 * narrow to read.
 */

interface Conversation {
    id: string;
    other_id: string;
    other_name: string;
    other_role: string;
    student_name: string;
    last_message: string;
    last_at?: unknown;
    unread: number;
}

interface Contact {
    id: string;
    name: string;
    role: string;
    subtitle: string;
    student_id?: string;
    student_name?: string;
}

interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    body: string;
    createdAt?: unknown;
}

const FILTERS = [
    { key: 'all', label: 'الكل' },
    { key: 'teacher', label: 'الكادر التعليمي' },
    { key: 'admin', label: 'الإدارة' },
];

export const Messages: React.FC<{ user: UserData }> = ({ user }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [open, setOpen] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const endRef = useRef<HTMLDivElement>(null);
    const openId = useRef<string | null>(null);
    const lastListRefresh = useRef<number>(Date.now());

    useEffect(() => {
        openId.current = open?.id || null;
    }, [open]);

    const loadConversations = useCallback(async () => {
        try {
            setConversations(await api.get<Conversation[]>('/api/conversations'));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل المحادثات'));
        }
    }, []);

    useEffect(() => {
        loadConversations().finally(() => setLoading(false));
        api.get<Contact[]>('/api/messages/contacts').then(setContacts).catch(() => setContacts([]));
    }, [loadConversations]);

    /** Re-reads the open thread without the spinner or the scroll jump. */
    const refreshThread = useCallback(async (conversationId: string) => {
        try {
            const res = await api.get<{ data: Message[] }>(`/api/conversations/${conversationId}/messages`);
            const fresh = [...(res.data || [])].reverse();
            setMessages((prev) => (prev.length === fresh.length ? prev : fresh));
        } catch {
            /* a dropped poll is not worth an error banner */
        }
    }, []);

    const openThread = async (conversation: Conversation) => {
        setOpen(conversation);
        setMessages([]);
        setLoadingThread(true);
        try {
            const res = await api.get<{ data: Message[] }>(`/api/conversations/${conversation.id}/messages`);
            // The API returns newest first; a conversation reads oldest first.
            setMessages([...(res.data || [])].reverse());
            if (conversation.unread > 0) {
                await api.post(`/api/conversations/${conversation.id}/read`);
                setConversations((prev) =>
                    prev.map((c) => (c.id === conversation.id ? { ...c, unread: 0 } : c))
                );
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل الرسائل'));
        } finally {
            setLoadingThread(false);
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    };

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        const body = draft.trim();
        if (!body || !open) return;

        setSending(true);
        try {
            await api.post(`/api/conversations/${open.id}/messages`, { body });
            setDraft('');
            const res = await api.get<{ data: Message[] }>(`/api/conversations/${open.id}/messages`);
            setMessages([...(res.data || [])].reverse());
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            loadConversations();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر إرسال الرسالة'));
        } finally {
            setSending(false);
        }
    };

    /*
     * The poll. Ten seconds inside a conversation is what makes it feel like a
     * conversation; thirty on the list is enough to notice a new one. Both stop
     * the moment the tab goes to the background.
     */
    useEffect(() => {
        const tick = () => {
            if (document.hidden) return;
            if (openId.current) {
                refreshThread(openId.current);
                if (Date.now() - lastListRefresh.current > 30000) {
                    lastListRefresh.current = Date.now();
                    loadConversations();
                }
            } else {
                lastListRefresh.current = Date.now();
                loadConversations();
            }
        };

        const timer = window.setInterval(tick, openId.current ? 10000 : 30000);
        document.addEventListener('visibilitychange', tick);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [open, loadConversations, refreshThread]);

    const startWith = async (contact: Contact) => {
        setShowNew(false);
        try {
            const res = await api.post<{ id: string }>('/api/conversations', {
                user_id: contact.id,
                student_id: contact.student_id,
            });
            await loadConversations();
            await openThread({
                id: res.id,
                other_id: contact.id,
                other_name: contact.name,
                other_role: contact.role,
                student_name: contact.student_name || '',
                last_message: '',
                unread: 0,
            });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر بدء المحادثة'));
        }
    };

    if (loading) return <div className="p-6"><Spinner label={t('جاري تحميل المحادثات')} /></div>;

    /* ------------------------------ one thread ------------------------------ */

    if (open) {
        return (
            <div className="flex flex-col h-[calc(100dvh-10.5rem)] max-w-3xl mx-auto">
                <div className="flex items-center gap-3 p-4 bg-white/85 backdrop-blur-xl border-b border-slate-900/[0.06] shrink-0">
                    <button
                        onClick={() => { setOpen(null); loadConversations(); }}
                        className="p-2 bg-slate-50 rounded-xl text-slate-500 hover:bg-slate-100"
                        aria-label={t('رجوع')}
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 truncate">{open.other_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">
                            {t(roleLabel(open.other_role))}
                            {open.student_name ? ` · ${t('بخصوص')} ${open.student_name}` : ''}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/70">
                    {loadingThread ? (
                        <Spinner />
                    ) : messages.length === 0 ? (
                        <Nothing
                            icon={<MessageCircle className="w-10 h-10" />}
                            message="ابدأ المحادثة برسالة"
                        />
                    ) : (
                        messages.map((message, index) => {
                            const mine = message.sender_id === user.id;
                            const day = formatDay(message.createdAt);
                            const newDay = day && day !== formatDay(messages[index - 1]?.createdAt);

                            return (
                                <React.Fragment key={message.id}>
                                    {newDay && (
                                        <div className="flex justify-center py-1.5">
                                            <span className="bg-slate-900/[0.06] text-slate-500 text-[10px] font-black px-3 py-1 rounded-full">
                                                {day}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                                                mine
                                                    ? 'bg-gradient-to-br from-brand-600 to-brand-400 text-white rounded-bl-md shadow-brand-700/25'
                                                    : 'bg-white text-slate-800 ring-1 ring-slate-900/[0.06] rounded-br-md'
                                            }`}
                                        >
                                            <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap break-words">
                                                {message.body}
                                            </p>
                                            <p
                                                className={`text-[9px] font-bold mt-1 tabular ${
                                                    mine ? 'text-brand-200' : 'text-slate-400'
                                                }`}
                                                dir="ltr"
                                            >
                                                {formatTime(message.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                    <div ref={endRef} />
                </div>

                {error && <div className="p-3"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}

                <form onSubmit={send} className="p-3 bg-white/90 backdrop-blur-xl border-t border-slate-900/[0.06] flex gap-2 shrink-0">
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className={inputClass}
                        placeholder={t('اكتب رسالتك...')}
                        maxLength={2000}
                    />
                    <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="bg-gradient-to-br from-brand-600 to-brand-400 text-white w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-700/30 disabled:opacity-40 disabled:shadow-none active:scale-95 transition-all"
                        aria-label={t('إرسال')}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        );
    }

    /* ---------------------------- the list of them ---------------------------- */

    const term = search.trim();
    const visible = conversations.filter((c) => {
        if (filter === 'teacher' && c.other_role !== 'teacher') return false;
        if (filter === 'admin' && !['admin', 'assistant_admin'].includes(c.other_role)) return false;
        if (term && !c.other_name.includes(term) && !c.student_name.includes(term)) return false;
        return true;
    });

    const contactTerm = search.trim();

    return (
        <Page>
            <PageTitle
                title={t('الرسائل')}
                subtitle={t('تواصل مباشر مع المدرسة')}
                action={
                    <button
                        onClick={() => setShowNew(true)}
                        className="bg-gradient-to-l from-brand-700 to-brand-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-brand-700/30 flex items-center gap-1.5 active:scale-[0.98] transition-transform"
                    >
                        <Plus className="w-4 h-4" />
                        {t('محادثة جديدة')}
                    </button>
                }
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3.5 pointer-events-none" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder={t('ابحث بالاسم')}
                />
            </div>

            <Chips items={FILTERS.map((f) => ({ key: f.key, label: t(f.label) }))} active={filter} onPick={setFilter} />

            <Panel>
                {visible.length === 0 ? (
                    <Nothing
                        icon={<MessageCircle className="w-10 h-10" />}
                        message="لا توجد محادثات بعد"
                        hint="ابدأ محادثة جديدة من الزر بالأعلى"
                    />
                ) : (
                    <Rows>
                        {visible.map((conversation) => (
                            <Row
                                key={conversation.id}
                                onClick={() => openThread(conversation)}
                                icon={<MessageCircle className="w-4 h-4" />}
                                tone={conversation.unread > 0 ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'}
                                title={conversation.other_name}
                                subtitle={`${t(roleLabel(conversation.other_role))}${
                                    conversation.student_name ? ' · ' + conversation.student_name : ''
                                } — ${conversation.last_message || t('لا توجد رسائل بعد')}`}
                                trailing={
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <span className="text-[9px] font-black text-slate-400 tabular">
                                            {formatDay(conversation.last_at)}
                                        </span>
                                        {conversation.unread > 0 && (
                                            <span className="min-w-5 h-5 px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm shadow-rose-500/40">
                                                {conversation.unread}
                                            </span>
                                        )}
                                    </div>
                                }
                            />
                        ))}
                    </Rows>
                )}
            </Panel>

            <Modal
                open={showNew}
                onClose={() => setShowNew(false)}
                title={t('محادثة جديدة')}
                subtitle={t('اختر من يمكنك مراسلته')}
            >
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {contacts.length === 0 ? (
                        <Nothing message="لا يوجد أشخاص متاحون للمراسلة" />
                    ) : (
                        contacts
                            .filter((c) => !contactTerm || c.name.includes(contactTerm))
                            .map((contact, index) => (
                                <button
                                    key={`${contact.id}-${contact.student_id || index}`}
                                    onClick={() => startWith(contact)}
                                    className="w-full text-right bg-slate-50 hover:bg-brand-50 rounded-2xl p-3 flex items-center gap-3 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-2xl bg-white text-brand-700 font-black flex items-center justify-center shrink-0">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-slate-800 truncate">{contact.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold truncate">{contact.subtitle}</p>
                                    </div>
                                    <Badge tone="indigo">{t(roleLabel(contact.role))}</Badge>
                                </button>
                            ))
                    )}
                </div>
            </Modal>
        </Page>
    );
};
