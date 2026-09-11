import { useState, useEffect } from 'react';
import { X, Terminal, CheckCircle2, Play, Copy, Check } from 'lucide-react';
import { api, buildApiUrl, getStoredToken } from '../services/api';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiDocsModal({ isOpen, onClose }: ApiDocsModalProps) {
  const [spec, setSpec] = useState<any>(null);
  const [selectedPath, setSelectedPath] = useState<string>('/customers');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && !spec) {
      api.getOpenApiSpec().then(setSpec).catch(console.error);
    }
  }, [isOpen, spec]);

  if (!isOpen) return null;

  const paths = spec?.paths || {};
  const currentPathData = paths[selectedPath];
  const method = currentPathData ? Object.keys(currentPathData)[0] : 'get';
  const endpointDetail = currentPathData ? currentPathData[method] : null;

  const handleTestEndpoint = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(buildApiUrl(`/api${selectedPath}`), { headers });
      const data = await res.json();
      setTestResult({
        status: res.status,
        statusText: res.statusText,
        data,
      });
    } catch (err: any) {
      setTestResult({
        status: 'Error',
        data: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const copySpec = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const methodColors: Record<string, string> = {
    get: 'bg-blue-100 text-blue-700 border-blue-300',
    post: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    put: 'bg-amber-100 text-amber-700 border-amber-300',
    delete: 'bg-rose-100 text-rose-700 border-rose-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl neu-accent-btn flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                OpenAPI v3 REST Documentation & Explorer
              </h3>
              <p className="text-xs text-slate-500">
                Interactive API specification conforming to project requirements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copySpec}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-button text-xs font-semibold text-slate-700"
              title="Copy OpenAPI JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied JSON' : 'Export Spec'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden min-h-0">
          {/* Endpoint List */}
          <div className="md:col-span-5 overflow-y-auto pr-1 space-y-2 max-h-[60vh]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
              Registered Endpoints
            </span>
            {Object.keys(paths).map((pathKey) => {
              const itemMethods = Object.keys(paths[pathKey]);
              const activeMethod = itemMethods[0];
              const isSelected = selectedPath === pathKey;

              return (
                <button
                  key={pathKey}
                  onClick={() => {
                    setSelectedPath(pathKey);
                    setTestResult(null);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'neu-pressed bg-[#e0e7f1] text-indigo-700 font-bold border border-indigo-200'
                      : 'neu-button text-slate-700'
                  }`}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      methodColors[activeMethod] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {activeMethod}
                  </span>
                  <span className="font-mono text-[11px] truncate flex-1">{pathKey}</span>
                </button>
              );
            })}
          </div>

          {/* Endpoint detail & Live Test Console */}
          <div className="md:col-span-7 flex flex-col overflow-y-auto max-h-[60vh] space-y-4">
            {endpointDetail ? (
              <div className="space-y-4">
                <div className="neu-flat p-4 rounded-2xl border border-white/60">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                        methodColors[method] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {method}
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-800">
                      /api{selectedPath}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    {endpointDetail.summary || 'RESTful endpoint'}
                  </p>

                  {endpointDetail.parameters && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Query / Path Parameters
                      </span>
                      <div className="space-y-1">
                        {endpointDetail.parameters.map((p: any, i: number) => (
                          <div key={i} className="text-[11px] flex items-center gap-2 font-mono">
                            <span className="text-indigo-600 font-semibold">{p.name}</span>
                            <span className="text-slate-400">({p.in})</span>
                            <span className="text-slate-500">{p.schema?.type}</span>
                            {p.description && <span className="text-slate-400 text-[10px]">- {p.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Auth: Bearer JWT / Cookie
                    </span>
                    {method === 'get' && (
                      <button
                        onClick={handleTestEndpoint}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-accent-btn text-xs font-semibold shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{loading ? 'Running...' : 'Execute Live GET'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Test Output */}
                {testResult && (
                  <div className="neu-flat p-4 rounded-2xl border border-white/60 bg-slate-900 text-emerald-400">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white font-mono">
                          HTTP Status: {testResult.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">Live Backend Response</span>
                    </div>
                    <pre className="text-[11px] font-mono overflow-x-auto max-h-48 text-slate-200">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="neu-flat p-6 rounded-2xl text-center text-slate-500 text-xs">
                Select an endpoint from the left to inspect parameters and schemas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
