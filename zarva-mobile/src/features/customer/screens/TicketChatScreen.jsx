import React, { useState, useEffect, useRef } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@infra/firebase/app';

import { useAuthStore } from '@auth/store';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import PremiumHeader from '@shared/ui/PremiumHeader';
import MainBackground from '@shared/ui/MainBackground';

// ⭐ FIX: Helper functions to safely parse strict SQL/Firebase dates on iOS/Android
const getSafeTimeMs = (dateInput) => {
    if (!dateInput) return 0;
    let d = new Date(dateInput);
    if (isNaN(d.getTime()) && typeof dateInput === 'string') {
        const fixedStr = dateInput.replace(' ', 'T') + (dateInput.includes('Z') ? '' : 'Z');
        d = new Date(fixedStr);
    }
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

const formatSafeTime = (dateInput) => {
    if (!dateInput) return '';
    let d = new Date(dateInput);
    if (isNaN(d.getTime()) && typeof dateInput === 'string') {
        const fixedStr = dateInput.replace(' ', 'T') + (dateInput.includes('Z') ? '' : 'Z');
        d = new Date(fixedStr);
    }
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function TicketChatScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const route = useRoute();
    const t = useT();
    const { user } = useAuthStore();

    const { ticketId } = route.params;

    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    const flatListRef = useRef(null);

    // Fetch initial ticket data
    useEffect(() => {
        const fetchTicket = async () => {
            try {
                const res = await apiClient.get(`/api/support/tickets/${ticketId}`);
                if (res.data?.success) {
                    setTicket(res.data.data.ticket);
                    setMessages(res.data.data.messages || []);
                }
            } catch (err) {
                console.error('Failed to load ticket details:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTicket();
    }, [ticketId]);

    // Firebase real-time sync for new messages
    useEffect(() => {
        if (!ticketId) return;

        const messagesRef = ref(database, `support_tickets/${ticketId}/messages`);

        const handleNewData = (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // ⭐ FIX: Apply safe time parser to sorting logic
                const msgsArray = Object.values(data).sort((a, b) => 
                    getSafeTimeMs(a.created_at) - getSafeTimeMs(b.created_at)
                );
                
                setMessages(msgsArray);

                // Scroll to bottom on new message
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 200);
            }
        };

        onValue(messagesRef, handleNewData);

        return () => {
            off(messagesRef, 'value', handleNewData);
        };
    }, [ticketId]);

    const sendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        const text = newMessage.trim();
        setNewMessage(''); // optimistic clear

        try {
            await apiClient.post(`/api/support/tickets/${ticketId}/messages`, {
                message_text: text,
                message_type: 'text'
            });
        } catch (error) {
            console.error('Failed to send ticket message:', error);
            setNewMessage(text); // Put text back on failure
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = item.sender_id === String(user.id);
        const isAdmin = item.sender_role === 'admin';

        return (
            <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                {!isMe && (
                    <Text style={styles.senderName}>
                        {isAdmin ? 'ZARVA Admin' : 'Agent'}
                    </Text>
                )}
                <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
                    {item.message_text || item.content}
                </Text>
                
                {/* ⭐ FIX: Apply safe time parser to bubble render */}
                <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
                    {formatSafeTime(item.created_at)}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <MainBackground>
                <PremiumHeader title={t('support_chat', { defaultValue: 'Support Chat' })} onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={tTheme.brand.primary} />
                </View>
            </MainBackground>
        );
    }

    const isResolved = ticket?.status === 'resolved' || ticket?.status === 'closed';

    return (
        <MainBackground>
            <PremiumHeader
                title={ticket?.ticket_number || 'Ticket Chat'}
                subtitle={ticket?.ticket_type === 'general_chat' ? 'General Inquiry' : 'Job Dispute'}
                onBack={() => {
                    // Navigate back correctly depending on entry stack depth
                    navigation.goBack();
                }}
            />

            {/* Status Banner */}
            {isResolved && (
                <View style={[styles.statusBanner, { backgroundColor: '#4CAF5022', borderColor: '#4CAF5044' }]}>
                    <Text style={[styles.statusBannerTxt, { color: '#4CAF50' }]}>This ticket is marked as Resolved.</Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : null}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => String(item.id || Math.random())}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListHeaderComponent={() => (
                        <View style={styles.chatStart}>
                            <Text style={styles.chatStartIcon}>🛡️</Text>
                            <Text style={styles.chatStartInfo}>
                                ZARVA Support joined the chat.{'\n'}We typically reply within a few minutes.
                            </Text>
                        </View>
                    )}
                />

                <View style={styles.inputContainer}>
                    {isResolved ? (
                        <Text style={styles.disabledText}>Chat is locked because the ticket is resolved.</Text>
                    ) : (
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="Type a message..."
                                placeholderTextColor={tTheme.text.tertiary}
                                value={newMessage}
                                onChangeText={setNewMessage}
                                multiline
                                maxLength={500}
                                editable={!sending}
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                                onPress={sendMessage}
                                disabled={!newMessage.trim() || sending}
                            >
                                <Text style={styles.sendIcon}>➤</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    keyboardView: { flex: 1 },

    statusBanner: {
        padding: t.spacing.md,
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    statusBannerTxt: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },

    listContent: {
        padding: t.spacing['2xl'],
        paddingBottom: 40,
        gap: t.spacing.lg,
    },
    chatStart: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    chatStartIcon: { fontSize: 40 },
    chatStartInfo: { color: t.text.tertiary, fontSize: 12, textAlign: 'center', lineHeight: 18 },

    messageBubble: {
        maxWidth: '85%',
        padding: t.spacing.lg,
        borderRadius: t.radius.lg,
    },
    myBubble: {
        alignSelf: 'flex-end',
        backgroundColor: t.brand.primary,
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        alignSelf: 'flex-start',
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1,
        borderColor: t.border.default + '11',
        borderBottomLeftRadius: 4,
    },
    senderName: {
        color: t.text.tertiary,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
        letterSpacing: 1,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 22,
        color: t.text.primary,
    },
    myText: {
        color: '#FFF',
    },
    theirText: {
        color: t.text.primary,
    },
    timeText: {
        fontSize: 10,
        marginTop: 6,
        alignSelf: 'flex-end',
    },
    myTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    theirTime: {
        color: t.text.tertiary,
    },

    inputContainer: {
        padding: t.spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 32 : t.spacing.lg,
        backgroundColor: t.background.surface,
        borderTopWidth: 1,
        borderTopColor: t.border.default + '11',
    },
    disabledText: {
        color: t.text.tertiary,
        textAlign: 'center',
        fontStyle: 'italic',
        fontSize: 14,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '33',
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
    },
    input: {
        flex: 1,
        color: t.text.primary,
        fontSize: 14,
        minHeight: 40,
        maxHeight: 120,
        paddingTop: 10,
        paddingBottom: 10,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: t.brand.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: t.spacing.md,
        marginBottom: 2,
    },
    sendButtonDisabled: {
        backgroundColor: t.background.surfaceRaised,
    },
    sendIcon: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        marginLeft: 2,
    }
});
