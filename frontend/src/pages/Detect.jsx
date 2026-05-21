import { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import Navbar from '../components/Navbar';
import { api } from '../api';

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';
const VIDEO_ACCEPT = '.mp4,.avi,.mov';

function getAcceptValue(mode) {
  return mode === 'image' ? IMAGE_ACCEPT : VIDEO_ACCEPT;
}

function isModeCompatibleFile(mode, file) {
  if (!file) {
    return false;
  }

  const type = file.type || '';
  if (mode === 'image') {
    return type.startsWith('image/');
  }

  return type.startsWith('video/');
}

export default function Detect() {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('image');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    setSelectedFile(null);
    setResult(null);
    setError('');
  }, [mode]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const selectFile = (file) => {
    if (!isModeCompatibleFile(mode, file)) {
      setError(mode === 'image' ? 'Please upload an image file.' : 'Please upload a video file.');
      return;
    }

    setError('');
    setResult(null);
    setSelectedFile(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      selectFile(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      selectFile(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Choose a file before running detection.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    let requestUrl = '';
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const endpoint = mode === 'image' ? '/predict/image' : '/predict/video';
      // build readable URL for logging (don't rely on it for requests)
      requestUrl = `${api.defaults.baseURL?.replace(/\/$/, '') || ''}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      console.log('Uploading file to', requestUrl, { name: selectedFile.name, size: selectedFile.size });

      // Let axios set the multipart Content-Type (including boundary)
      const response = await api.post(endpoint, formData);

      setResult({
        ...response.data,
        previewUrl,
        fileType: mode,
        filename: selectedFile.name,
      });
    } catch (requestError) {
      // Detailed logging to help debug server responses
      console.error('Detection error', {
        url: requestUrl,
        error: requestError,
        response: requestError?.response,
        status: requestError?.response?.status,
        data: requestError?.response?.data,
      });

      if (requestError?.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const backendMessage = requestError?.response?.data?.detail || requestError?.response?.data?.message || requestError?.message;
      setError(backendMessage || 'Detection failed. Try another file.');
    } finally {
      setLoading(false);
    }
  };

  const verdict = result?.label || 'READY';
  const confidence = Number(result?.confidence || 0);
  const heatmapSrc = result?.heatmap ? `data:image/png;base64,${result.heatmap}` : '';
  const verdictIsFake = verdict === 'FAKE';
  const chartData = [
    {
      name: 'Confidence',
      value: confidence,
      fill: verdictIsFake ? '#ef4444' : '#22c55e',
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-purple-300/70">Detection Lab</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
            <span className="gradient-text">Scan Media</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-300 sm:text-base">
            Upload a photo or video clip, then inspect the verdict and the generated Grad-CAM overlay.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="glass-card p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap gap-3">
              {[
                { key: 'image', label: 'Image' },
                { key: 'video', label: 'Video' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item.key)}
                  className={[
                    'rounded-full px-5 py-2 text-sm font-semibold transition',
                    mode === item.key
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={[
                'flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition',
                dragActive ? 'border-purple-400 bg-purple-500/10' : 'border-white/15 bg-white/5 hover:bg-white/7',
              ].join(' ')}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={getAcceptValue(mode)}
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/20 bg-white/5 text-3xl text-purple-300">
                ⇪
              </div>
              <p className="text-lg font-semibold text-white">Drag and drop your {mode} here</p>
              <p className="mt-2 text-sm text-gray-400">
                Or click to browse. Accepted formats: {mode === 'image' ? '.jpg, .jpeg, .png, .webp' : '.mp4, .avi, .mov'}
              </p>
              {selectedFile ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-200">
                  Selected file: <span className="font-semibold text-white">{selectedFile.name}</span>
                </div>
              ) : null}
            </div>

            {previewUrl ? (
              <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                {mode === 'image' ? (
                  <img src={previewUrl} alt="Preview" className="h-72 w-full object-contain" />
                ) : (
                  <video src={previewUrl} controls className="h-72 w-full object-contain bg-black" />
                )}
              </div>
            ) : null}

            {error ? <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || !selectedFile}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white transition hover:from-purple-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Analyzing...' : 'Analyze Now'}
              </button>
              <span className="text-sm text-gray-400">
                The backend samples every 10th frame for videos and keeps the run fast.
              </span>
            </div>
          </section>

          <section className="space-y-6">
            <div className="glass-card p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-gray-400">Verdict</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                    <span className={verdictIsFake ? 'text-red-300' : 'text-green-300'}>{verdict}</span>
                  </h2>
                </div>
                {mode === 'video' && result?.frames_analyzed ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200">
                    Frames Analyzed: {result.frames_analyzed}
                  </span>
                ) : null}
              </div>

              <div className={['rounded-3xl border p-4', verdictIsFake ? 'border-red-500/20 glow-red' : 'border-green-500/20 glow-green'].join(' ')}>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-300">Confidence</p>
                    <p className="text-3xl font-black text-white">{confidence.toFixed(2)}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full border border-white/10 bg-white/5" />
                </div>
                <div className="h-3 rounded-full bg-white/10">
                  <div
                    className={['h-3 rounded-full transition-all duration-700', verdictIsFake ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-gradient-to-r from-green-500 to-emerald-400'].join(' ')}
                    style={{ width: `${Math.min(confidence, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-6">
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={18}
                    data={chartData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background clockWise dataKey="value" cornerRadius={999} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <p className="-mt-2 text-center text-sm text-gray-300">Confidence Gauge</p>
            </div>
          </section>
        </div>

        {result ? (
          <section className="mt-8 glass-card p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-gray-400">Explainability</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Original and Heatmap</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200">
                {result.filename}
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-gray-200">Original</div>
                {mode === 'image' ? (
                  <img src={result.previewUrl} alt="Original upload" className="h-[360px] w-full object-contain" />
                ) : (
                  <video src={result.previewUrl} controls className="h-[360px] w-full bg-black object-contain" />
                )}
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-gray-200">Grad-CAM Heatmap</div>
                {heatmapSrc ? (
                  <img src={heatmapSrc} alt="Grad-CAM heatmap" className="h-[360px] w-full object-contain" />
                ) : (
                  <div className="flex h-[360px] items-center justify-center text-sm text-gray-400">Heatmap not available for this scan.</div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
