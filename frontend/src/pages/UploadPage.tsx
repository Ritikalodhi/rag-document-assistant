import { useState, useRef, useCallback, useEffect, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { documentsService } from '@/services/documents.service';
import { Button } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';

const ACCEPTED_TYPES = ['.pdf', '.txt', '.docx', '.md'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

type UploadStage = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

interface UploadState {
  stage: UploadStage;
  progress: number;
  stageLabel: string;
  filename?: string;
  error?: string;
  jobId?: string;
  docId?: string;
}

export function UploadPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ stage: 'idle', progress: 0, stageLabel: '' });
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const reset = useCallback(() => {
    setUpload({ stage: 'idle', progress: 0, stageLabel: '' });
  }, []);

  const startUpload = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      addToast('error', `Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }
    if (file.size > MAX_SIZE) {
      addToast('error', 'File exceeds 50MB limit');
      return;
    }

    setUpload({ stage: 'uploading', progress: 0, stageLabel: 'Uploading...', filename: file.name });

    try {
      const asyncJob = await documentsService.uploadAsync(file);
      setUpload((prev) => ({
        ...prev,
        stage: 'processing',
        stageLabel: 'Queued',
        progress: 0,
        jobId: asyncJob.job_id,
      }));

      // Poll for job status
      pollRef.current = setInterval(async () => {
        try {
          const status = await documentsService.getAsyncJobStatus(asyncJob.job_id);
          setUpload((prev) => ({
            ...prev,
            stage: status.status === 'completed' ? 'completed' : status.status === 'failed' ? 'failed' : 'processing',
            progress: status.progress ?? prev.progress,
            stageLabel: status.stage ?? prev.stageLabel,
            error: status.error,
            docId: status.result?.doc_id,
          }));

          if (status.status === 'completed' || status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            if (status.status === 'completed') {
              addToast('success', 'Document processed successfully');
            }
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setUpload((prev) => ({ ...prev, stage: 'failed', error: 'Failed to check processing status' }));
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Upload failed'
        : 'Upload failed';
      setUpload((prev) => ({ ...prev, stage: 'failed', error: msg }));
    }
  }, [addToast]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) startUpload(file);
  }, [startUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
  }, [startUpload]);

  const stageLabels: Record<string, string> = {
    queued: 'Queued',
    parsing: 'Reading document',
    chunking: 'Splitting into chunks',
    embedding: 'Generating embeddings',
    indexing: 'Indexing in database',
  };

  const stageConfig: Record<UploadStage, { color: string; label: string }> = {
    idle: { color: '', label: '' },
    uploading: { color: 'bg-[rgb(var(--color-accent))]', label: 'Uploading...' },
    processing: { color: 'bg-[rgb(var(--color-accent))]', label: stageLabels[upload.stageLabel] ?? 'Processing...' },
    completed: { color: 'bg-emerald-500', label: 'Completed' },
    failed: { color: 'bg-red-500', label: 'Failed' },
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-h1 font-display">Upload documents</h1>
        <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">Add sources to your research library.</p>
      </div>

      {/* Drop zone */}
      {upload.stage === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-[12px] py-16 px-8 text-center cursor-pointer transition-colors
            ${dragOver
              ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))]'
              : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-text-secondary))]'
            }
          `}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          aria-label="Upload a document"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />
          <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-[rgb(var(--color-surface))] flex items-center justify-center">
            <svg className="w-6 h-6 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-h3 font-display font-semibold mb-2">Drop documents here</h2>
          <p className="text-body text-[rgb(var(--color-text-secondary))] mb-4">
            or click to choose files
          </p>
          <p className="text-caption text-[rgb(var(--color-text-secondary))]">
            PDF, TXT, DOCX, Markdown — up to 50MB
          </p>
        </div>
      )}

      {/* Progress */}
      {upload.stage !== 'idle' && (
        <div className="p-5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[8px] bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-body truncate">{upload.filename}</p>
                  <p className="text-caption text-[rgb(var(--color-text-secondary))]">{upload.stageLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {upload.stage === 'completed' && (
                  <Button size="sm" onClick={() => upload.docId && navigate(`/documents/${upload.docId}`)}>
                    Open document
                  </Button>
                )}
                {(upload.stage === 'failed' || upload.stage === 'completed') && (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Upload another
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-[rgb(var(--color-border))] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${stageConfig[upload.stage].color}`}
                initial={{ width: 0 }}
                animate={{ width: `${upload.progress}%` }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              />
            </div>

            {upload.stage === 'failed' && upload.error && (
              <p className="text-caption text-red-500">{upload.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))]">Supported formats</p>
          <p className="text-body mt-1">PDF, TXT, DOCX, MD</p>
        </div>
        <div className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))]">Max file size</p>
          <p className="text-body mt-1">50 MB</p>
        </div>
        <div className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))]">Processing</p>
          <p className="text-body mt-1">Async with progress</p>
        </div>
      </div>
    </div>
  );
}