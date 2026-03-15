/**
 * src/services/api/chatApi.js
 */
import apiClient from '@infra/api/client';

export const getMessages = async (jobId, beforeMessageId = null) => {
    let url = `/api/jobs/${jobId}/chat/messages`;
    if (beforeMessageId) {
        url += `?before=${beforeMessageId}`;
    }
    const res = await apiClient.get(url);
    return res.data;
};

export const sendMessage = async (jobId, messageData) => {
    // messageData: { message_type, content, s3_key, client_message_id }
    const res = await apiClient.post(`/api/jobs/${jobId}/chat/messages`, messageData);
    return res.data;
};

export const deleteMessage = async (jobId, messageId) => {
    const res = await apiClient.delete(`/api/jobs/${jobId}/chat/messages/${messageId}`);
    return res.data;
};

export const markRead = async (jobId) => {
    const res = await apiClient.post(`/api/jobs/${jobId}/chat/read`);
    return res.data;
};

export const sendTyping = async (jobId) => {
    const res = await apiClient.post(`/api/jobs/${jobId}/chat/typing`);
    return res.data;
};
