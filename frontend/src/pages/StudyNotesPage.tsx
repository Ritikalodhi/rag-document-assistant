import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useStudyNotes } from '@/features/documents/hooks/useDocumentDetail';
import { recordNotesGenerated } from '@/utils/notesProgress';
import { Skeleton, ErrorState } from '@/components/ui';

type StudyTab = 'all' | 'concepts' | 'flashcards' | 'viva' | 'mcq';

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

export function StudyNotesPage() {
  const navigate = useNavigate();
  const { data: documents, isLoading: docsLoading, error: docsError } = useDocuments();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudyTab>('all');

  // Interactive flashcard state
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  // Interactive MCQ state: { [mcqIndex]: selectedOption }
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, string>>({});

  // Expanded viva questions state
  const [expandedViva, setExpandedViva] = useState<Record<number, boolean>>({});

  // Effective selected document
  const activeDoc = useMemo(() => {
    if (!documents || documents.length === 0) return null;
    if (selectedDocId) {
      return documents.find((d) => d.doc_id === selectedDocId) ?? documents[0];
    }
    return documents[0];
  }, [documents, selectedDocId]);

  const effectiveDocId = activeDoc?.doc_id ?? '';

  const {
    data: notesData,
    isLoading: notesLoading,
    isError: notesError,
    error: notesErr,
    refetch: refetchNotes,
  } = useStudyNotes(effectiveDocId);

  // Track documents with generated notes (drives the Workspace Overview stat)
  useEffect(() => {
    if (notesData && effectiveDocId) recordNotesGenerated(effectiveDocId);
  }, [notesData, effectiveDocId]);

  const toggleViva = (index: number) => {
    setExpandedViva((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSelectOption = (mcqIdx: number, option: string) => {
    setSelectedMcqAnswers((prev) => ({ ...prev, [mcqIdx]: option }));
  };

  if (docsLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-full">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={220} height={36} />
          <Skeleton variant="text" width={140} height={40} />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rectangular" width={160} height={42} className="rounded-[12px]" />
          <Skeleton variant="rectangular" width={160} height={42} className="rounded-[12px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton variant="rectangular" height={200} className="rounded-[16px]" />
          <Skeleton variant="rectangular" height={200} className="rounded-[16px]" />
        </div>
      </div>
    );
  }

  if (docsError) {
    return <ErrorState title="Failed to load documents" />;
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-full">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[rgb(var(--color-text))] font-ui">
            Study Notes
          </h1>
          <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
            Create structured study notes, flashcards, key concepts, viva questions, and MCQs.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center p-12 rounded-[20px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-center max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-[16px] bg-[rgb(var(--color-accent-muted))]/40 border border-[rgb(var(--color-accent))]/20 flex items-center justify-center mb-4 text-[rgb(var(--color-accent))]">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-[rgb(var(--color-text))] mb-2 font-ui">
            No documents in your library
          </h3>
          <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-6 max-w-sm">
            Upload a document to automatically generate structured study notes, interactive flashcards, and exam-ready questions.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[rgb(var(--color-btn-primary-text))] font-semibold text-[14px] bg-[rgb(var(--color-btn-primary))] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0)_42%)] hover:bg-[rgb(var(--color-btn-primary-hover))] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_18px_-6px_var(--glow-color)] transition-all duration-200 cursor-pointer active:scale-[0.98] min-h-[44px]"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload your first document</span>
          </button>
        </div>
      </div>
    );
  }

  const flashcards = notesData?.flashcards ?? [];
  const keyConcepts = notesData?.key_concepts ?? [];
  const vivaQuestions = notesData?.viva_questions ?? [];
  const mcqs = notesData?.mcqs ?? [];

  return (
    <div className="flex flex-col gap-6 pb-12 w-full max-w-full">
      {/* ── Page Header ── */}
      <motion.div {...motionProps(0)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[rgb(var(--color-text))] font-ui">
              Study Notes
            </h1>
            <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
              Structured summaries, flashcards, key concepts, viva questions, and MCQs generated from your documents.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/upload')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[rgb(var(--color-btn-primary-text))] font-semibold text-[13.5px] bg-[rgb(var(--color-btn-primary))] hover:bg-[rgb(var(--color-btn-primary-hover))] shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.98] min-h-[42px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Document</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Document Switcher Strip ── */}
      <motion.div {...motionProps(0.04)}>
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-bold text-[rgb(var(--color-text-secondary))] uppercase tracking-[0.1em]">
            Select Document
          </label>
          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-thin pb-1">
            {documents.map((doc) => {
              const isSelected = doc.doc_id === effectiveDocId;
              return (
                <button
                  key={doc.doc_id}
                  onClick={() => {
                    setSelectedDocId(doc.doc_id);
                    setFlashcardIndex(0);
                    setFlashcardFlipped(false);
                    setSelectedMcqAnswers({});
                    setExpandedViva({});
                  }}
                  className={`
                    flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] border text-[13.5px] font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0 cursor-pointer min-h-[42px]
                    ${
                      isSelected
                        ? 'bg-[rgb(var(--color-accent-muted))] border-[rgb(var(--color-accent))]/40 text-[rgb(var(--color-text))] font-semibold shadow-sm'
                        : 'bg-[rgb(var(--color-elevated))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-accent-muted))]'
                    }
                  `}
                >
                  <svg className={`w-4 h-4 ${isSelected ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Active Document Info & Tabs ── */}
      <motion.div {...motionProps(0.08)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[18px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-[42px] h-[42px] rounded-[12px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center flex-shrink-0 text-[rgb(var(--color-accent))]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] truncate font-ui">
                {activeDoc?.filename ?? 'Document'}
              </h2>
              <p className="text-[12.5px] text-[rgb(var(--color-text-secondary))] mt-0.5">
                {activeDoc?.chunk_count ? `${activeDoc.chunk_count} indexed chunks` : 'Indexed document'} · Ready for review
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-[rgb(var(--color-surface))] p-1.5 rounded-[12px] border border-[rgb(var(--color-border))] flex-shrink-0">
            {([
              { id: 'all' as StudyTab, label: 'Overview' },
              { id: 'concepts' as StudyTab, label: `Concepts (${keyConcepts.length})` },
              { id: 'flashcards' as StudyTab, label: `Flashcards (${flashcards.length})` },
              { id: 'viva' as StudyTab, label: `Viva Qs (${vivaQuestions.length})` },
              { id: 'mcq' as StudyTab, label: `MCQs (${mcqs.length})` },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-all duration-150 whitespace-nowrap cursor-pointer
                  ${
                    activeTab === tab.id
                      ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))] font-semibold shadow-sm'
                      : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))]'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Main Content Area ── */}
      {notesLoading && (
        <div className="flex flex-col gap-4 py-8">
          <Skeleton variant="text" width="50%" height={32} />
          <Skeleton variant="rectangular" height={120} className="rounded-[16px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <Skeleton variant="rectangular" height={140} className="rounded-[16px]" />
            <Skeleton variant="rectangular" height={140} className="rounded-[16px]" />
          </div>
        </div>
      )}

      {notesError && (
        <ErrorState
          title="Failed to load study notes"
          message={(notesErr as Error)?.message ?? 'An unexpected error occurred while generating notes.'}
          onRetry={() => refetchNotes()}
        />
      )}

      {!notesLoading && !notesError && notesData && (
        <div className="flex flex-col gap-8">

          {/* 1. Summary Card */}
          {(activeTab === 'all' || activeTab === 'concepts') && notesData.summary && (
            <motion.div {...motionProps(0.1)}>
              <div className="rounded-[20px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-6 sm:p-7 shadow-[var(--shadow-sm)]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--color-accent))] shadow-[0_0_10px_-2px_var(--glow-color)]" />
                  <h3 className="text-[17px] font-bold text-[rgb(var(--color-text))] font-ui">Executive Summary</h3>
                </div>
                <p className="text-[14.5px] leading-relaxed text-[rgb(var(--color-text))]/90">
                  {notesData.summary}
                </p>
              </div>
            </motion.div>
          )}

          {/* 2. Key Concepts */}
          {(activeTab === 'all' || activeTab === 'concepts') && keyConcepts.length > 0 && (
            <motion.div {...motionProps(0.12)}>
              <div className="flex flex-col gap-4">
                <h3 className="text-[18px] font-bold text-[rgb(var(--color-text))] font-ui flex items-center justify-between">
                  <span>Key Concepts</span>
                  <span className="text-[13px] font-normal text-[rgb(var(--color-text-secondary))]">{keyConcepts.length} total</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keyConcepts.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-[16px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent-muted))] hover:shadow-[var(--shadow-md),0_0_16px_-8px_var(--glow-color)] hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-[8px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-accent))] font-bold text-[12px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-bold text-[rgb(var(--color-text))] leading-snug">{item.concept}</h4>
                          <p className="text-[13.5px] text-[rgb(var(--color-text-secondary))] mt-1.5 leading-relaxed">{item.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. Interactive Flashcards */}
          {(activeTab === 'all' || activeTab === 'flashcards') && flashcards.length > 0 && (
            <motion.div {...motionProps(0.14)}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[18px] font-bold text-[rgb(var(--color-text))] font-ui">
                    Interactive Flashcards
                  </h3>
                  <span className="text-[13px] font-medium text-[rgb(var(--color-text-secondary))]">
                    Card {flashcardIndex + 1} of {flashcards.length}
                  </span>
                </div>

                {/* Flip Card Container */}
                <div
                  onClick={() => setFlashcardFlipped((prev) => !prev)}
                  className="relative min-h-[220px] rounded-[20px] border border-[rgb(var(--color-accent-muted))] bg-gradient-to-br from-[rgb(var(--color-elevated))] to-[rgb(var(--color-surface))] p-8 flex flex-col justify-between cursor-pointer group shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-[rgb(var(--color-accent))]/40 hover:shadow-[var(--shadow-md),0_0_20px_-8px_var(--glow-color)]"
                >
                  <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    <span>{flashcardFlipped ? 'Answer / Definition' : 'Question / Concept'}</span>
                    <span className="text-[rgb(var(--color-accent))]/70 group-hover:text-[rgb(var(--color-accent))] flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Click card to flip
                    </span>
                  </div>

                  <div className="py-6 text-center my-auto">
                    <p className={`text-[19px] sm:text-[21px] font-semibold leading-snug transition-all duration-200 ${flashcardFlipped ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text))]'}`}>
                      {flashcardFlipped
                        ? flashcards[flashcardIndex]?.back
                        : flashcards[flashcardIndex]?.front}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[rgb(var(--color-border))]">
                    <div className="flex items-center gap-1.5">
                      {flashcards.map((_, dotIdx) => (
                        <div
                          key={dotIdx}
                          className={`h-1.5 rounded-full transition-all duration-200 ${dotIdx === flashcardIndex ? 'w-6 bg-[rgb(var(--color-accent))]' : 'w-2 bg-[rgb(var(--color-border))]'}`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setFlashcardIndex((prev) => Math.max(0, prev - 1));
                          setFlashcardFlipped(false);
                        }}
                        disabled={flashcardIndex === 0}
                        className="p-2 rounded-[10px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] disabled:opacity-40 hover:bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent-muted))] transition-colors"
                        aria-label="Previous card"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          setFlashcardIndex((prev) => Math.min(flashcards.length - 1, prev + 1));
                          setFlashcardFlipped(false);
                        }}
                        disabled={flashcardIndex === flashcards.length - 1}
                        className="p-2 rounded-[10px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] disabled:opacity-40 hover:bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent-muted))] transition-colors"
                        aria-label="Next card"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. Viva Questions */}
          {(activeTab === 'all' || activeTab === 'viva') && vivaQuestions.length > 0 && (
            <motion.div {...motionProps(0.16)}>
              <div className="flex flex-col gap-4">
                <h3 className="text-[18px] font-bold text-[rgb(var(--color-text))] font-ui flex items-center justify-between">
                  <span>Viva & Oral Examination Questions</span>
                  <span className="text-[13px] font-normal text-[rgb(var(--color-text-secondary))]">{vivaQuestions.length} questions</span>
                </h3>

                <div className="flex flex-col gap-3">
                  {vivaQuestions.map((vq, idx) => {
                    const isOpen = !!expandedViva[idx];
                    return (
                      <div
                        key={idx}
                        className="rounded-[16px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] overflow-hidden transition-all duration-200 hover:border-[rgb(var(--color-accent-muted))] hover:shadow-[var(--shadow-sm),0_0_16px_-8px_var(--glow-color)]"
                      >
                        <button
                          onClick={() => toggleViva(idx)}
                          className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-[rgb(var(--color-surface))]/50 transition-colors"
                          aria-expanded={isOpen}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-[8px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[#93C5FD] font-bold text-[12px] flex items-center justify-center flex-shrink-0 mt-0.5">
                              Q{idx + 1}
                            </span>
                            <p className="text-[15px] font-semibold text-[rgb(var(--color-text))] leading-snug">
                              {vq.question}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 text-[rgb(var(--color-text-secondary))]">
                            <span className="text-[12px] hidden sm:inline">{isOpen ? 'Hide' : 'Reveal'} answer</span>
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[rgb(var(--color-accent))]' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="px-5 pb-5 pt-1 border-t border-[rgb(var(--color-border))]/60 bg-[rgb(var(--color-surface))]/60"
                            >
                              <div className="p-4 rounded-[12px] bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[14px] text-[rgb(var(--color-accent))] leading-relaxed">
                                <span className="font-semibold text-[rgb(var(--color-text))] block mb-1 text-[12.5px] uppercase tracking-wider">
                                  Expected Response:
                                </span>
                                {vq.answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* 5. Multiple Choice Questions (MCQs) */}
          {(activeTab === 'all' || activeTab === 'mcq') && mcqs.length > 0 && (
            <motion.div {...motionProps(0.18)}>
              <div className="flex flex-col gap-4">
                <h3 className="text-[18px] font-bold text-[rgb(var(--color-text))] font-ui flex items-center justify-between">
                  <span>Practice Multiple Choice Questions</span>
                  <span className="text-[13px] font-normal text-[rgb(var(--color-text-secondary))]">{mcqs.length} questions</span>
                </h3>

                <div className="flex flex-col gap-4">
                  {mcqs.map((mcq, idx) => {
                    const selected = selectedMcqAnswers[idx];
                    return (
                      <div
                        key={idx}
                        className="p-6 rounded-[18px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] flex flex-col gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-[8px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[#FCD34D] font-bold text-[12px] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-[15.5px] font-semibold text-[rgb(var(--color-text))] leading-snug">
                            {mcq.question}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-9">
                          {mcq.options.map((option, optIdx) => {
                            const isChosen = selected === option;
                            const isCorrect = option.startsWith(mcq.correct) || option === mcq.correct;
                            const showAnswer = !!selected;

                            let btnStyle = 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))]';
                            if (showAnswer) {
                              if (isCorrect) {
                                btnStyle = 'bg-[rgb(var(--color-btn-primary))] border-[rgb(var(--color-accent))]/50 text-[rgb(var(--color-btn-primary-text))] font-semibold shadow-[0_0_16px_-6px_var(--glow-color)]';
                              } else if (isChosen) {
                                btnStyle = 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-300';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectOption(idx, option)}
                                className={`
                                  flex items-center gap-3 p-3.5 rounded-[12px] border text-[13.5px] text-left transition-all duration-150 cursor-pointer min-h-[44px]
                                  ${btnStyle}
                                `}
                              >
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isCorrect && showAnswer ? 'border-[#B8EFC8] bg-[#B8EFC8] text-[#11151A]' : 'border-current'}`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="flex-1 leading-snug">{option}</span>
                                {showAnswer && isCorrect && (
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#B8EFC8] ml-auto">
                                    Correct
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

        </div>
      )}
    </div>
  );
}
