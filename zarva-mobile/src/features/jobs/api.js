import apiClient from '@infra/api/client';

export const updateJobDetails = async (jobId, data) => {
    const res = await apiClient.patch(`/api/jobs/${jobId}`, data);
    return res.data;
};

export default { updateJobDetails };
