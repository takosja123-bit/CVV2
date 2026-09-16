import React, { useState } from 'react';
import { Download, Check, Loader2, AlertCircle } from 'lucide-react';
import { CVData, TemplateId } from '../../types';
import { downloadDirectPdf } from '../../utils/exportCV';

interface DownloadMenuProps {
  data: CVData;
  templateId?: TemplateId | string;
  primaryColor?: string;
  variant?: 'primary' | 'secondary' | 'compact';
  label?: string;
  className?: string;
}

export const DownloadMenu: React.FC<DownloadMenuProps> = ({
  data,
  templateId = 'template-ats-classic',
  primaryColor = '#1e3a5f',
  variant = 'primary',
  label = 'Download CV',
  className = '',
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);

  const handleDownloadDirectPdf = async () => {
    setIsGeneratingPdf(true);
    setFailed(false);
    // Let React actually paint the "Generating PDF..." spinner before the
    // heavy synchronous capture work begins — without this yield, the state
    // update and the capture can get batched into the same frame, so the
    // button just looks frozen for a moment instead of showing progress.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const result = await downloadDirectPdf(data, templateId, primaryColor);
      if (result.success) {
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 3000);
      } else {
        setFailReason(result.error || null);
        setFailed(true);
        setTimeout(() => setFailed(false), 6000);
      }
    } catch (err) {
      console.error('Failed to generate PDF', err);
      setFailReason(err instanceof Error ? err.message : String(err));
      setFailed(true);
      setTimeout(() => setFailed(false), 6000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const baseButtonStyles =
    variant === 'primary'
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 text-xs transition-all active:scale-98 cursor-pointer'
      : variant === 'secondary'
      ? 'bg-[#432874] hover:bg-[#351e5e] text-white font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 text-xs transition-all cursor-pointer'
      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1 cursor-pointer';

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={handleDownloadDirectPdf}
        disabled={isGeneratingPdf}
        className={`${baseButtonStyles} ${isGeneratingPdf ? 'opacity-75 cursor-wait' : ''}`}
      >
        {isGeneratingPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span>{isGeneratingPdf ? 'Generating PDF...' : label}</span>
      </button>

      {/* Confirmation Notification when downloaded */}
      {downloaded && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>PDF Document (.pdf) downloaded successfully!</span>
        </div>
      )}

      {/* Error notification, no dialogs or navigation — stays right here */}
      {failed && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-start gap-2 animate-in fade-in max-w-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>
            Couldn't generate the PDF.
            {failReason && <span className="block text-slate-300 mt-0.5 break-words">{failReason}</span>}
          </span>
        </div>
      )}
    </div>
  );
};
