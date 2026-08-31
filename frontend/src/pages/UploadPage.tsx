import { useState, useRef, useCallback, useEffect, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { documentsService } from '@/services/documents.service';
import { useDeleteDocument } from '@/features/documents/hooks/useDocuments';
import { Button, Dialog } from '@/components/ui';
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

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

const stageLabels: Record<string, string> = {
  queued: 'Queued',
  parsing: 'Reading document',
  chunking: 'Splitting into chunks',
  embedding: 'Generating embeddings',
  indexing: 'Indexing in database',
};

const stageConfig: Record<UploadStage, { color: string; label: string; gradient?: string }> = {
  idle: { color: '', label: '' },
  uploading: {
    color: 'bg-[rgb(var(--color-accent))]',
    label: 'Uploading...',
    gradient: 'from-[rgb(var(--color-accent))] to-indigo-500',
  },
  processing: {
    color: 'bg-[rgb(var(--color-accent))]',
    label: 'Processing...',
    gradient: 'from-[rgb(var(--color-accent))] to-violet-500',
  },
  completed: {
    color: 'bg-[rgb(var(--color-success))]',
    label: 'Completed',
    gradient: 'from-emerald-500 to-teal-500',
  },
  failed: {
    color: 'bg-[rgb(var(--color-danger))]',
    label: 'Failed',
    gradient: 'from-red-500 to-rose-500',
  },
};

const infoSpecs = [
  {
    label: 'Supported formats',
    value: 'PDF, TXT, DOCX, MD',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
  },
  {
    label: 'Max file size',
    value: '50 MB',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
  },
  {
    label: 'Processing',
    value: 'Async indexing',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
];

export function UploadPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const deleteDoc = useDeleteDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ stage: 'idle', progress: 0, stageLabel: '' });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  const resolvedStageLabel = upload.stage === 'processing'
    ? (stageLabels[upload.stageLabel] ?? 'Processing...')
    : stageConfig[upload.stage].label;

  const isActive = upload.stage !== 'idle';
  const config = stageConfig[upload.stage];

  return (
    <div className="flex flex-col gap-7 max-w-2xl">
      {/* Header */}
      <motion.div {...motionProps(0)}>
        <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">
          Upload documents
        </h1>
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
          Add sources to your research library for semantic search and Q&A.
        </p>
      </motion.div>

      {/* Drop zone */}
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.div key="dropzone" {...motionProps(0.05)}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-[16px] py-16 px-6 text-center cursor-pointer transition-all duration-200 overflow-hidden
                ${dragOver
                  ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/5'
                  : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-surface))]'
                }
              `}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              aria-label="Upload a document"
            >
              {/* Subtle background gradient when dragging */}
              {dragOver && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{ background: 'radial-gradient(circle at 50% 50%, rgb(var(--color-accent)) 0%, transparent 70%)' }}
                />
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileSelect}
                className="hidden"
                aria-hidden="true"
              />

              {/* Upload icon */}
              <div className={`w-14 h-14 mx-auto mb-5 rounded-[14px] flex items-center justify-center transition-all duration-200 ${
                dragOver
                  ? 'bg-[rgb(var(--color-accent))]/20 border border-[rgb(var(--color-accent))]/30'
                  : 'bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]'
              }`}>
                <svg
                  className={`w-6 h-6 transition-colors ${dragOver ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))]'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h2 className="text-[17px] font-display font-semibold mb-1.5 text-[rgb(var(--color-text))]">
                {dragOver ? 'Drop to upload' : 'Drop documents here'}
              </h2>
              <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-3">
                or click to choose files from your computer
              </p>
              <p className="text-[12px] font-code text-[rgb(var(--color-text-tertiary))]">
                PDF, TXT, DOCX, Markdown — up to 50MB
              </p>
            </div>
          </motion.div>
        ) : (
          /* Upload progress & status row */
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="p-5 rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] shadow-[var(--shadow-sm)]">
              <div className="flex flex-col gap-4">
                {/* File row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[10px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] text-[rgb(var(--color-text))] truncate">{upload.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {upload.stage === 'completed' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                        {upload.stage === 'failed' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        )}
                        {(upload.stage === 'uploading' || upload.stage === 'processing') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-accent))] flex-shrink-0 animate-pulse" />
                        )}
                        <p className={`text-[12px] font-medium ${
                          upload.stage === 'completed' ? 'text-emerald-500' :
                          upload.stage === 'failed' ? 'text-[rgb(var(--color-danger))]' :
                          'text-[rgb(var(--color-text-secondary))]'
                        }`}>
                          {resolvedStageLabel}
                        </p>
                        {upload.stage !== 'idle' && upload.progress > 0 && upload.stage !== 'completed' && (
                          <p className="text-[12px] text-[rgb(var(--color-text-tertiary))] font-code">{upload.progress}%</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {upload.stage === 'completed' && (
                      <>
                        <Button size="sm" onClick={() => upload.docId && navigate(`/documents/${upload.docId}`)}>
                          Open document
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          leftIcon={
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          }
                          onClick={() => setShowDeleteDialog(true)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                    {(upload.stage === 'failed' || upload.stage === 'completed') && (
                      <Button variant="secondary" size="sm" onClick={reset}>
                        Upload another
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[rgb(var(--color-border))] rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${config.gradient ?? config.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${upload.progress}%` }}
                    transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  />
                </div>

                {upload.stage === 'failed' && upload.error && (
                  <p className="text-[13px] text-[rgb(var(--color-danger))] font-medium">{upload.error}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info specs */}
      <motion.div {...motionProps(0.1)}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {infoSpecs.map((spec) => (
            <div key={spec.label} className="p-4 rounded-[12px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] flex items-center gap-3">
              <div className={`w-8 h-8 rounded-[8px] ${spec.iconBg} flex items-center justify-center flex-shrink-0`}>
                <svg className={`w-4 h-4 ${spec.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={spec.icon} />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[rgb(var(--color-text-tertiary))] uppercase tracking-wider">{spec.label}</p>
                <p className="text-[13px] font-semibold text-[rgb(var(--color-text))] mt-0.5">{spec.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} title="Delete document">
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete <strong className="text-[rgb(var(--color-text))]">{upload.filename}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (upload.docId) {
                deleteDoc.mutate(upload.docId, {
                  onSuccess: () => {
                    setShowDeleteDialog(false);
                    reset();
                  },
                });
              }
              setShowDeleteDialog(false);
            }}
            isLoading={deleteDoc.isPending}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}