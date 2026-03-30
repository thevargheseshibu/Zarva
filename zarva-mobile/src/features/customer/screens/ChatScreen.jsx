import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { ref, onValue, off, get } from 'firebase/database';
import { db } from '@infra/firebase/app';
import * as chatApi from '@customer/api';
import { useT } from '@shared/i18n/useTranslation';
import { useAuthStore } from '@auth/store';

import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import dayjs from 'dayjs';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function ChatScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { user } = useAuthStore();

    // 1. Robust Param Extraction (Handles Push Notification Entry)
    const { jobId, chatId } = route.params || {};
    const activeJobId = jobId || chatId;

    // 2. Deduce Role natively (Push notifications don't pass this prop)
    const myRole = user?.role || 'customer';
    const isCustomer = myRole === 'customer';

    const [otherId, setOtherId] = useState(route.params?.otherUserId || null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true); // FIX: Add the lock
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [remoteTyping, setRemoteTyping] = useState(false);

    const lastReadRef = useRef(null);
    const flatListRef = useRef();
    const typingTimeout = useRef(null);

    const markAsRead = useCallback(async () => {
        try { await chatApi.markRead(activeJobId); } catch (e) {}
    }, [activeJobId]);

    const loadMessages = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await chatApi.getMessages(activeJobId);
            if (data.messages) {
                setMessages(data.messages);
                // FIX: If the server returns fewer than 50 messages (the limit), 
                // we know we already have the entire history. Lock the scroller.
                if (data.messages.length < 50) {
                    setHasMore(false);
                }
            }
        } catch (err) {
            console.error('[Chat] Failed to load messages', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [activeJobId]);

    useEffect(() => {
        if (!activeJobId) return;

        loadMessages();
        markAsRead();

        // Resolve otherUserId if missing (Critical for Push Notifications)
        if (!otherId) {
            get(ref(db, `active_jobs/${activeJobId}`)).then((snap) => {
                const d = snap.val();
                if (d) setOtherId(isCustomer ? d.worker_id : d.customer_id);
            });
        }

        // Real-time Firebase Sync for incoming messages
        const chatLastMsgRef = ref(db, `active_jobs/${activeJobId}/chat_last_message`);
        const lastMsgListener = onValue(chatLastMsgRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // FIX: Only trigger fetch if this is a NEW message we haven't seen yet
            const msgId = data.id || data.created_at;
            if (lastReadRef.current === msgId) return;
            lastReadRef.current = msgId;

            // If the message is from the OTHER person, silently fetch and append it
            if (data.sender_id && String(data.sender_id) !== String(user?.id) && data.sender_id !== 'system') {
                chatApi.getMessages(activeJobId).then(res => {
                    if (res.messages) {
                        setMessages(prev => {
                            const newMessages = res.messages.filter(nm => !prev.some(pm => pm.id === nm.id));
                            if (newMessages.length === 0) return prev;
                            return [...newMessages, ...prev].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                        });
                    }
                });
                markAsRead();
            }
        });

        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            if (messages.length > 0) flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });

        return () => {
            off(chatLastMsgRef, 'value', lastMsgListener);
            keyboardDidShowListener.remove();
        };
    }, [activeJobId, user?.id]); // Added user?.id to dependencies to ensure comparison uses latest ID

    // Separate effect for Typing Indicator so it works after otherId resolves
    useEffect(() => {
        if (!activeJobId || !otherId) return;
        const chatTypingRef = ref(db, `active_jobs/${activeJobId}/chat_typing/${otherId}`);
        const typingListener = onValue(chatTypingRef, (snapshot) => {
            const lastTypedAt = snapshot.val();
            setRemoteTyping(lastTypedAt && (Date.now() - lastTypedAt < 5000));
        });
        return () => off(chatTypingRef, 'value', typingListener);
    }, [activeJobId, otherId]);

    const handleLoadMore = async () => {
        // FIX: Abort immediately if the hasMore lock is false
        if (loadingMore || messages.length === 0 || !hasMore) return;
        
        try {
            setLoadingMore(true);
            const lastMsg = messages[messages.length - 1];
            if (!lastMsg || lastMsg.is_optimistic || isNaN(Number(lastMsg.id))) return;
            
            const data = await chatApi.getMessages(activeJobId, lastMsg.id);
            if (data.messages && data.messages.length > 0) {
                setMessages(prev => [...prev, ...data.messages]);
                // FIX: If we hit the end of the history, lock it
                if (data.messages.length < 50) setHasMore(false);
            } else {
                // FIX: Server returned 0 messages, lock it permanently
                setHasMore(false);
            }
        } catch (err) {} finally {
            setLoadingMore(false);
        }
    };

    const handleTextChange = (text) => {
        setInput(text);
        if (!isTyping) {
            setIsTyping(true);
            chatApi.sendTyping(activeJobId).catch(() => { });
        }
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text) return;

        const optimisticMessage = {
            id: 'temp-' + Date.now(),
            client_message_id: uuidv4(),
            job_id: activeJobId,
            sender_role: myRole,
            message_type: 'text',
            content: text,
            created_at: new Date().toISOString(),
            is_optimistic: true
        };

        setMessages(prev => [optimisticMessage, ...prev]);
        setInput('');

        try {
            const result = await chatApi.sendMessage(activeJobId, {
                message_type: 'text',
                content: text,
                client_message_id: optimisticMessage.client_message_id
            });

            if (result && result.message) {
                setMessages(prev => prev.map(m =>
                    m.client_message_id === optimisticMessage.client_message_id ? result.message : m
                ));
            }
        } catch (err) {
            setMessages(prev => prev.map(m =>
                m.client_message_id === optimisticMessage.client_message_id ? { ...m, is_error: true } : m
            ));
        }
    };

    const renderItem = ({ item }) => {
        const isMe = item.sender_role === myRole;

        if (item.sender_role === 'system') {
            return (
                <View style={styles.systemMessageWrap}>
                    <View style={styles.systemMessage}>
                        <Text style={styles.systemText}>{item.content}</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
                <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
                    {item.is_deleted ? (
                        <Text style={[styles.messageText, styles.deletedText, isMe && styles.messageTextMe]}>
                            🚫 {t('message_deleted')}
                        </Text>
                    ) : (
                        <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
                    )}
                    <Text style={[styles.timeText, isMe && styles.timeTextMe]}>
                        {dayjs(item.created_at).format('h:mm A')}
                        {item.is_error && <Text style={{ color: tTheme.status.error.base }}> • Failed</Text>}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{isCustomer ? 'Professional' : 'Customer'}</Text>
                    {remoteTyping && <Text style={styles.typingTxt}>{t('typing') || 'typing...'}</Text>}
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={tTheme.brand.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderItem}
                    inverted
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator color={tTheme.brand.primary} style={{ padding: 20 }} /> : null}
                />
            )}

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder={t('type_a_message') || 'Message...'}
                    placeholderTextColor={tTheme.text.tertiary}
                    value={input}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={500}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                    disabled={!input.trim()}
                    onPress={handleSend}
                >
                    <Text style={[styles.sendIcon, !input.trim() && styles.sendIconDisabled]}>➤</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: {
        paddingTop: 60, paddingHorizontal: t.spacing.lg, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingBottom: t.spacing.sm, backgroundColor: t.background.surface,
        borderBottomWidth: 1, borderBottomColor: t.background.surfaceRaised
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerCenter: { alignItems: 'center' },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    typingTxt: { color: t.brand.primary, fontSize: 10, fontStyle: 'italic', position: 'absolute', bottom: -12 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.md, gap: t.spacing.sm },
    systemMessageWrap: { alignItems: 'center', marginVertical: t.spacing.md },
    systemMessage: { backgroundColor: t.background.surfaceRaised, paddingHorizontal: 16, paddingVertical: 6, borderRadius: t.radius.full },
    systemText: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold },
    messageRow: { flexDirection: 'row', width: '100%', marginVertical: 4 },
    messageRowMe: { justifyContent: 'flex-end' },
    messageRowThem: { justifyContent: 'flex-start' },
    messageBubble: { maxWidth: '80%', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, borderRadius: t.radius.xl },
    messageBubbleThem: { backgroundColor: t.background.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: t.background.surfaceRaised },
    messageBubbleMe: { backgroundColor: t.brand.primary, borderBottomRightRadius: 4, ...t.shadows.accentGlow },
    messageText: { color: t.text.primary, fontSize: t.typography.size.caption, lineHeight: 22 },
    messageTextMe: { color: '#FFFFFF' },
    deletedText: { fontStyle: 'italic', color: t.text.tertiary },
    timeText: { fontSize: 9, color: t.text.tertiary, marginTop: 4, alignSelf: 'flex-end' },
    timeTextMe: { color: 'rgba(255,255,255,0.7)' },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm, paddingBottom: Platform.OS === 'ios' ? 30 : t.spacing.md, backgroundColor: t.background.surface, borderTopWidth: 1, borderTopColor: t.background.surfaceRaised },
    input: { flex: 1, backgroundColor: t.background.surfaceRaised, color: t.text.primary, borderRadius: t.radius.lg, paddingHorizontal: t.spacing.md, paddingTop: 12, paddingBottom: 12, minHeight: 44, maxHeight: 120, fontSize: t.typography.size.body },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.brand.primary, justifyContent: 'center', alignItems: 'center', marginLeft: t.spacing.sm, marginBottom: 2 },
    sendBtnDisabled: { backgroundColor: t.background.surfaceRaised },
    sendIcon: { color: '#FFF', fontSize: 16, marginLeft: 2 },
    sendIconDisabled: { color: t.text.tertiary }
});
