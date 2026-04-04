import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '../lib/api';
import 'leaflet/dist/leaflet.css';

export default function MapPage() {
  const [mapData, setMapData] = useState({ workers: [], demand: [] });
  const [regionalStats, setRegionalStats] = useState([]);

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
        console.error('Failed to fetch analytics:', error);
      }
    };

    fetchAnalytics();
    // Refresh every 30 seconds for a "Live" feel
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  // Center on Kerala (Update with your specific default coordinates)
  const defaultCenter = [10.8505, 76.2711];

  return (
    <div className="p-6 h-screen flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Marketplace Radar</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
        
        {/* The Live Map (Takes up 2/3 of the screen) */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Live Geospatial Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow p-0 overflow-hidden rounded-b-xl relative z-0 min-h-[400px]">
            <MapContainer center={defaultCenter} zoom={7} className="h-full w-full absolute inset-0">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />
              
              {/* Plot Workers (Blue) */}
              {mapData.workers?.map((worker, i) => (
                <CircleMarker 
                  key={`w-${i}`} 
                  center={[worker.lat, worker.lng]} 
                  radius={6}
                  pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.7 }}
                >
                  <Popup>Worker ({worker.category})</Popup>
                </CircleMarker>
              ))}

              {/* Plot Pending Jobs (Red) */}
              {mapData.demand?.map((job, i) => (
                <CircleMarker 
                  key={`j-${i}`} 
                  center={[job.lat, job.lng]} 
                  radius={8}
                  pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.8 }}
                >
                  <Popup>Pending Job: {job.category}</Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </CardContent>
        </Card>

        {/* Regional Stats Chart (Takes up 1/3 of the screen) */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Regional Demand Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalStats} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="district" type="category" width={80} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="pending_jobs" fill="#ef4444" name="Pending Jobs" radius={[0, 4, 4, 0]} />
                <Bar dataKey="active_jobs" fill="#3b82f6" name="Active Jobs" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
