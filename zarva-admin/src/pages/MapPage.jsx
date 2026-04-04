import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '../lib/api';
import { Radio, BarChart3, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export default function MapPage() {
  const [mapData, setMapData] = useState({ workers: [], demand: [] });
  const [regionalStats, setRegionalStats] = useState([]);
  const [showWorkers, setShowWorkers] = useState(true);
  const [showJobs, setShowJobs] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [mapRes, statsRes] = await Promise.all([
          api.get('/admin/analytics/worker-density'),
          api.get('/admin/analytics/regional-stats')
        ]);
        setMapData(mapRes.data.heatmaps || { workers: [], demand: [] });
        setRegionalStats(statsRes.data.regional_stats || []);
      } catch (error) {
        console.error('[MapPage] analytics error:', error);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const defaultCenter = [10.8505, 76.2711];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs shadow-xl">
        <p className="mb-1 font-medium text-zinc-300">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold text-white">{p.value}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Marketplace Radar</h1>
        <p className="text-sm text-zinc-400">Supply & demand in real-time</p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Map — 2/3 */}
        <Card className="relative flex flex-col overflow-hidden border-zinc-800 bg-zinc-900/50 xl:col-span-2">
          {/* Floating controls */}
          <div className="absolute left-4 top-4 z-[1000] space-y-2">
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 shadow-xl backdrop-blur">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={showWorkers} onChange={() => setShowWorkers(!showWorkers)}
                  className="h-3.5 w-3.5 rounded border-zinc-600 accent-blue-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Workers ({mapData.workers?.length || 0})
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={showJobs} onChange={() => setShowJobs(!showJobs)}
                  className="h-3.5 w-3.5 rounded border-zinc-600 accent-red-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Pending Jobs ({mapData.demand?.length || 0})
              </label>
            </div>
          </div>

          <CardContent className="relative flex-1 p-0" style={{ minHeight: '500px' }}>
            <MapContainer
              center={defaultCenter}
              zoom={7}
              className="absolute inset-0 h-full w-full"
              style={{ background: '#09090b' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />

              {showWorkers && mapData.workers?.map((w, i) => (
                <CircleMarker
                  key={`w-${i}`}
                  center={[w.lat, w.lng]}
                  radius={5}
                  pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup className="dark-popup">
                    <span className="text-xs">Worker • {w.category || 'General'}</span>
                  </Popup>
                </CircleMarker>
              ))}

              {showJobs && mapData.demand?.map((j, i) => (
                <CircleMarker
                  key={`j-${i}`}
                  center={[j.lat, j.lng]}
                  radius={7}
                  pathOptions={{ color: '#ef4444', fillColor: '#f87171', fillOpacity: 0.85, weight: 1.5 }}
                >
                  <Popup className="dark-popup">
                    <span className="text-xs">Searching • {j.category || 'General'} • ₹{j.hourly_rate}/hr</span>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </CardContent>
        </Card>

        {/* Regional Chart — 1/3 */}
        <Card className="flex flex-col border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <CardTitle className="text-sm font-semibold text-white">Regional Pipeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalStats} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="district" type="category" width={70} tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pending_jobs" fill="#ef4444" name="Pending" radius={[0, 3, 3, 0]} />
                <Bar dataKey="active_jobs" fill="#3b82f6" name="Active" radius={[0, 3, 3, 0]} />
                <Bar dataKey="completed_jobs" fill="#34d399" name="Completed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
