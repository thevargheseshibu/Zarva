import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import dayjs from 'dayjs';

export default function CustomJobsPage() {
  const [pendingJobs, setPendingJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Form state
  const [adminNotes, setAdminNotes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingJobs();
  }, []);

  const fetchPendingJobs = async () => {
    try {
      const res = await api.get('/admin/custom-jobs');
      // filter only pending
      setPendingJobs((res.data.templates || []).filter(t => t.approval_status === 'pending'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setAdminNotes('');
    setEstimatedCost('');
  };

  const handleApprove = async () => {
    if (!estimatedCost) return alert("Please provide an estimated cost before approving.");
    
    setIsSubmitting(true);
    try {
      await api.post(`/admin/custom-jobs/${selectedJob.id}/approve`, {
        notes: adminNotes,
        estimatedCost: Number(estimatedCost)
      });
      alert(`Job Request Approved! Customer notified.`);
      setPendingJobs(pendingJobs.filter(j => j.id !== selectedJob.id));
      setSelectedJob(null);
    } catch (error) {
      alert("Failed to approve job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Rejection reason (required):');
    if (!reason) return alert('Rejection reason is required.');
    
    setIsSubmitting(true);
    try {
      await api.post(`/admin/custom-jobs/${selectedJob.id}/reject`, { reason });
      setPendingJobs(pendingJobs.filter(j => j.id !== selectedJob.id));
      setSelectedJob(null);
    } catch (error) {
      alert("Failed to reject job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="flex h-full text-white bg-zinc-950">
      
      {/* LEFT COLUMN: Pending Jobs List */}
      <div className="w-1/3 border-r border-zinc-800 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-6">Pending Custom Jobs</h2>
        <div className="flex flex-col gap-3">
          {pendingJobs.map(job => (
            <div 
              key={job.id} 
              onClick={() => handleSelectJob(job)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedJob?.id === job.id 
                  ? 'bg-emerald-900/20 border-emerald-500/50' 
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <strong className="text-emerald-400 text-lg block">{job.title}</strong>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-zinc-400">Customer ID: {job.customer_id}</span>
                <span className="text-xs text-zinc-500">{dayjs(job.created_at).format('MMM D')}</span>
              </div>
            </div>
          ))}
          {pendingJobs.length === 0 && <p className="text-zinc-500 text-center py-10">No pending jobs!</p>}
        </div>
      </div>

      {/* RIGHT COLUMN: Job Details & Action Panel */}
      <div className="w-2/3 p-8 overflow-y-auto">
        {selectedJob ? (
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold mb-2">{selectedJob.title}</h2>
            <div className="flex gap-4 mb-6 text-zinc-400 text-sm">
              <p><strong>Customer ID:</strong> {selectedJob.customer_id}</p>
              <p><strong>Date Requested:</strong> {dayjs(selectedJob.created_at).format('MMM D, YYYY')}</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-8">
              <h3 className="text-sm font-bold text-emerald-500 mb-2 uppercase tracking-wider">Customer Description</h3>
              <p className="text-zinc-300 leading-relaxed">{selectedJob.description}</p>
              
              <div className="mt-4 flex gap-4 text-sm text-zinc-400">
                <p>Location: {selectedJob.city}, {selectedJob.state}</p>
                <p>Suggested Rate: ₹{selectedJob.hourly_rate}/hr</p>
              </div>

              {selectedJob.photos && selectedJob.photos.length > 0 && (
                <div className="flex gap-3 mt-4">
                  {selectedJob.photos.map((url, i) => (
                    <img key={i} src={url} alt="job" className="w-20 h-20 rounded-lg object-cover border border-zinc-700" />
                  ))}
                </div>
              )}
            </div>

            {/* Admin Input Form */}
            <div className="flex flex-col gap-6">
              <div>
                <label className="block font-bold text-zinc-300 mb-2">Estimated Cost (₹)</label>
                <input 
                  type="number" 
                  value={estimatedCost} 
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="e.g. 1500"
                  className="p-3 w-48 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-2">Notes for Customer (Optional)</label>
                <textarea 
                  value={adminNotes} 
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. This will require bringing a specific type of valve..."
                  className="p-3 w-full h-24 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-4">
                <button 
                  onClick={handleApprove} 
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-5 h-5"/> {isSubmitting ? 'Approving...' : 'Approve & Notify Customer'}
                </button>
                <button 
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 bg-transparent border border-red-500/50 hover:bg-red-500/10 text-red-500 rounded-lg font-bold disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-5 h-5"/> Reject Job
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600 text-lg">
            <h2>Select a pending job from the left to review.</h2>
          </div>
        )}
      </div>

    </div>
  );
}
