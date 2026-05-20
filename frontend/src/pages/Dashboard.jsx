import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api';

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const [userResponse, historyResponse] = await Promise.all([
          api.get('/auth/me'),
          api.get('/predict/history'),
        ]);

        setUser(userResponse.data);
        setPredictions(historyResponse.data.predictions || []);
      } catch (requestError) {
        if (requestError?.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        setError(requestError?.response?.data?.detail || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate]);

  const totalScans = predictions.length;
  const fakeCount = predictions.filter((item) => item.label === 'FAKE').length;
  const realCount = predictions.filter((item) => item.label === 'REAL').length;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-purple-300/70">Mission Control</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              {user ? (
                <span className="gradient-text">Welcome back, {user.name}</span>
              ) : (
                <span className="gradient-text">Unveil Dashboard</span>
              )}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-300 sm:text-base">
              Review your scans, track recent predictions, and move straight into a new detection run.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/detect')}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-blue-500"
          >
            Start New Scan
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-400/30 border-t-purple-400" />
          </div>
        ) : error ? (
          <div className="glass-card border-red-500/20 bg-red-500/10 p-6 text-red-100">{error}</div>
        ) : (
          <div className="space-y-8">
            <section className="grid gap-4 md:grid-cols-3">
              {[
                { label: 'Total Scans', value: totalScans, accent: 'purple' },
                { label: 'Fakes Found', value: fakeCount, accent: 'red' },
                { label: 'Reals Found', value: realCount, accent: 'green' },
              ].map((item) => (
                <div key={item.label} className="glass-card p-6">
                  <p className="text-sm uppercase tracking-[0.25em] text-gray-400">{item.label}</p>
                  <div className="mt-3 text-4xl font-black text-white">{item.value}</div>
                  <div
                    className={[
                      'mt-4 h-1.5 w-24 rounded-full',
                      item.accent === 'purple'
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500'
                        : item.accent === 'red'
                          ? 'bg-gradient-to-r from-red-500 to-orange-400'
                          : 'bg-gradient-to-r from-green-500 to-emerald-400',
                    ].join(' ')}
                  />
                </div>
              ))}
            </section>

            <section className="glass-card overflow-hidden p-0">
              <div className="border-b border-white/10 px-6 py-5">
                <h2 className="text-xl font-bold text-white">Recent Predictions</h2>
                <p className="mt-1 text-sm text-gray-400">Latest 20 scans stored in your history.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-white/5 text-gray-300">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Filename</th>
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold">Verdict</th>
                      <th className="px-6 py-4 font-semibold">Confidence</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {predictions.length ? (
                      predictions.map((prediction, index) => (
                        <tr key={`${prediction.filename}-${index}`} className="transition hover:bg-white/5">
                          <td className="px-6 py-4 font-medium text-white">{prediction.filename}</td>
                          <td className="px-6 py-4">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200">
                              {prediction.file_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={[
                                'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]',
                                prediction.label === 'FAKE'
                                  ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                                  : 'border border-green-500/30 bg-green-500/10 text-green-200',
                              ].join(' ')}
                            >
                              {prediction.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-200">{Number(prediction.confidence || 0).toFixed(2)}%</td>
                          <td className="px-6 py-4 text-gray-300">{formatDate(prediction.created_at)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                          No predictions yet. Run your first scan to populate this table.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
