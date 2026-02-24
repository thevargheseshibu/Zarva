import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../../utils/firebase';
import * as chatApi from '../../services/api/chatApi';
import { useT } from '../../hooks/useT';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import dayjs from 'dayjs';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function ChatScreen({ route, navigation }) {
    const t = useT();
    const { jobId, userRole, otherUserId } = route.params;

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [remoteTyping, setRemoteTyping] = useState(false);

    const flatListRef = useRef();
    const typingTimeout = useRef(null);

    const isCustomer = userRole === 'customer';

    useEffect(() => {
        loadMessages();
        markAsRead();

        // Setup Firebase Listeners for real-time Sync
        const chatUnreadRef = ref(db, `active_jobs/${jobId}/chat_unread/${userRole === 'customer' ? 'customer' : 'worker'}`);
        const chatLastMsgRef = ref(db, `active_jobs/${jobId}/chat_last_message`);
        const chatTypingRef = ref(db, `active_jobs/${jobId}/chat_typing/${otherUserId}`);

        const lastMsgListener = onValue(chatLastMsgRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.sender_id !== 'system') {
                // Background refresh when new message arrives remotely
                loadMessages(true);
                markAsRead();
            }
        });

        const typingListener = onValue(chatTypingRef, (snapshot) => {
            const lastTypedAt = snapshot.val();
            if (lastTypedAt && (Date.now() - lastTypedAt < 5000)) {
                setRemoteTyping(true);
            } else {
                setRemoteTyping(false);
            }
        });

        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            if (messages.length > 0) flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });

        return () => {
            off(chatLastMsgRef, 'value', lastMsgListener);
            off(chatTypingRef, 'value', typingListener);
            keyboardDidShowListener.remove();
        };
    }, []);

    const markAsRead = async () => {
        try {
            await chatApi.markRead(jobId);
        } catch (e) {
            console.warn('[Chat] Failed to mark read');
        }
    };

    const loadMessages = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await chatApi.getMessages(jobId);
            setMessages(data.messages || []);
        } catch (err) {
            console.error('[Chat] Failed to load messages', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (loadingMore || messages.length === 0) return;
        try {
            setLoadingMore(true);
            const lastMsg = messages[messages.length - 1];
            if (!lastMsg || lastMsg.is_optimistic || isNaN(Number(lastMsg.id))) {
                console.warn('[ChatUI] Cannot load more: Last message is not synced yet');
                return;
            }
            const oldestMessageId = lastMsg.id;
            console.log(`[ChatUI] handleLoadMore | JobID:${jobId} | Before:${oldestMessageId} | MsgCount:${messages.length}`);

            if (!jobId || jobId === 'undefined') {
                console.error('[ChatUI] jobId is invalid', jobId);
                return;
            }

            const data = await chatApi.getMessages(jobId, oldestMessageId);
            if (data.messages && data.messages.length > 0) {
                setMessages(prev => [...prev, ...data.messages]);
            }
        } catch (err) {
            console.error('[Chat] Load more error', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleTextChange = (text) => {
        setInput(text);
        if (!isTyping) {
            setIsTyping(true);
            chatApi.sendTyping(jobId).catch(() => { });
        }
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            setIsTyping(false);
        }, 2000);
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text) return;

        const optimisticMessage = {
            id: 'temp-' + Date.now(),
            client_message_id: uuidv4(),
            job_id: jobId,
            sender_role: userRole,
            message_type: 'text',
            content: text,
            created_at: new Date().toISOString(),
            is_optimistic: true // UI flag
        };

        setMessages(prev => [optimisticMessage, ...prev]);
        setInput('');

        try {
            const result = await chatApi.sendMessage(jobId, {
                message_type: 'text',
                content: text,
                client_message_id: optimisticMessage.client_message_id
            });

            // Replace optimistic with real
            if (result && result.message) {
                setMessages(prev => prev.map(m =>
                    m.client_message_id === optimisticMessage.client_message_id ? result.message : m
                ));
            } else {
                console.error('[Chat] sendMessage result missing message object', result);
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('[Chat] handleSend error', err);
            // Revert changes or show error state
            setMessages(prev => prev.map(m =>
                m.client_message_id === optimisticMessage.client_message_id ? { ...m, is_error: true } : m
            ));
        }
    };

    const renderItem = ({ item }) => {
        const isMe = item.sender_role === userRole;

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
                        {item.is_error && <Text style={{ color: colors.danger }}> • Failed</Text>}
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
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{isCustomer ? t('chat_with_worker') : t('chat_with_customer')}</Text>
                    {remoteTyping && <Text style={styles.typingTxt}>{t('typing')}</Text>}
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.accent.primary} />
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
                    ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent.primary} style={{ padding: 20 }} /> : null}
                />
            )}

            {/* Input Bar */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder={t('type_a_message')}
                    placeholderTextColor={colors.text.muted}
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

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.elevated
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: colors.text.primary, fontSize: 20 },
    headerCenter: { alignItems: 'center' },
    headerTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    typingTxt: { color: colors.accent.primary, fontSize: 10, fontStyle: 'italic', position: 'absolute', bottom: -12 },

    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },

    systemMessageWrap: { alignItems: 'center', marginVertical: spacing.md },
    systemMessage: { backgroundColor: colors.elevated, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.full },
    systemText: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold },

    messageRow: { flexDirection: 'row', width: '100%', marginVertical: 4 },
    messageRowMe: { justifyContent: 'flex-end' },
    messageRowThem: { justifyContent: 'flex-start' },

    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.xl,
    },
    messageBubbleThem: {
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.elevated
    },
    messageBubbleMe: {
        backgroundColor: colors.accent.primary,
        borderBottomRightRadius: 4,
        ...shadows.accentGlow
    },
    messageText: {
        color: colors.text.primary,
        fontSize: fontSize.caption,
        lineHeight: 22
    },
    messageTextMe: {
        color: '#FFFFFF'
    },
    deletedText: {
        fontStyle: 'italic',
        color: colors.text.muted
    },
    timeText: {
        fontSize: 9,
        color: colors.text.muted,
        marginTop: 4,
        alignSelf: 'flex-end'
    },
    timeTextMe: {
        color: 'rgba(255,255,255,0.7)'
    },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? 30 : spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.elevated
    },
    input: {
        flex: 1,
        backgroundColor: colors.elevated,
        color: colors.text.primary,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingTop: 12,
        paddingBottom: 12,
        minHeight: 44,
        maxHeight: 120,
        fontSize: fontSize.body
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.accent.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
        marginBottom: 2
    },
    sendBtnDisabled: {
        backgroundColor: colors.elevated
    },
    sendIcon: {
        color: '#FFF',
        fontSize: 16,
        marginLeft: 2
    },
    sendIconDisabled: {
        color: colors.text.muted
    }
});
