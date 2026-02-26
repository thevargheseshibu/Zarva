import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../../services/firebase';
import { colors, spacing, radius } from '../../../design-system/tokens';
import { fontSize, fontWeight } from '../../../design-system/typography';
import { useAuthStore } from '../../../stores/authStore';
import { useT } from '../../../hooks/useT';
import apiClient from '../../../services/api/client';
import PremiumHeader from '../../../components/PremiumHeader';
import MainBackground from '../../../components/MainBackground';

export default function TicketChatScreen() {
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
                const msgsArray = Object.values(data).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
                    {item.message_text}
                </Text>
                <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <MainBackground>
                <PremiumHeader title={t('support_chat', { defaultValue: 'Support Chat' })} onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.accent.primary} />
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
                    keyExtractor={(item) => item.id}
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
                                placeholderTextColor={colors.text.muted}
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

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    keyboardView: { flex: 1 },

    statusBanner: {
        padding: spacing[12],
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    statusBannerTxt: {
        fontSize: fontSize.small,
        fontWeight: fontWeight.bold,
        letterSpacing: 1,
    },

    listContent: {
        padding: spacing[24],
        paddingBottom: spacing[40],
        gap: spacing[16],
    },
    chatStart: {
        alignItems: 'center',
        paddingVertical: spacing[32],
        gap: 8,
    },
    chatStartIcon: { fontSize: 40 },
    chatStartInfo: { color: colors.text.muted, fontSize: fontSize.small, textAlign: 'center', lineHeight: 18 },

    messageBubble: {
        maxWidth: '85%',
        padding: spacing[16],
        borderRadius: radius.lg,
    },
    myBubble: {
        alignSelf: 'flex-end',
        backgroundColor: colors.accent.primary,
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.accent.border + '11',
        borderBottomLeftRadius: 4,
    },
    senderName: {
        color: colors.text.muted,
        fontSize: fontSize.micro,
        fontWeight: fontWeight.bold,
        marginBottom: 4,
        letterSpacing: 1,
    },
    messageText: {
        fontSize: fontSize.body,
        lineHeight: 22,
    },
    myText: {
        color: '#FFFFFF',
    },
    theirText: {
        color: colors.text.primary,
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
        color: colors.text.muted,
    },

    inputContainer: {
        padding: spacing[16],
        paddingBottom: Platform.OS === 'ios' ? spacing[32] : spacing[16],
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.accent.border + '11',
    },
    disabledText: {
        color: colors.text.muted,
        textAlign: 'center',
        fontStyle: 'italic',
        fontSize: fontSize.body,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '33',
        paddingHorizontal: spacing[12],
        paddingVertical: spacing[8],
    },
    input: {
        flex: 1,
        color: colors.text.primary,
        fontSize: fontSize.body,
        minHeight: 40,
        maxHeight: 120,
        paddingTop: 10,
        paddingBottom: 10,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.accent.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing[12],
        marginBottom: 2,
    },
    sendButtonDisabled: {
        backgroundColor: colors.elevated,
    },
    sendIcon: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        marginLeft: 2,
    }
});
