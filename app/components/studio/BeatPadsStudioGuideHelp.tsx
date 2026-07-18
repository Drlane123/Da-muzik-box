'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';
import {
  BEAT_PADS_SOCIAL_BLURB,
  BEAT_PADS_STUDIO_GUIDE,
  beatPadsGuideSectionPlainText,
  beatPadsStudioGuidePlainText,
  type BeatPadsGuideSection,
} from '@/app/lib/creationStation/beatPadsStudioGuide';

const BLUE = '#9fd4ff';
const BLUE_DIM = 'rgba(159, 212, 255, 0.45)';
const GOLD = '#ffe082';
const GOLD_DIM = 'rgba(255, 224, 130, 0.45)';

const blueTipBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  padding: 0,
  margin: 0,
  flexShrink: 0,
  borderRadius: 4,
  border: `1px solid ${BLUE_DIM}`,
  background: 'rgba(159, 212, 255, 0.14)',
  color: BLUE,
  fontFamily: "'Rajdhani', 'Exo 2', system-ui, sans-serif",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
  cursor: 'pointer',
  boxShadow: '0 0 8px rgba(159, 212, 255, 0.2)',
};

function copyBtnStyle(active: boolean, accent: 'gold' | 'blue'): CSSProperties {
  const dim = accent === 'gold' ? GOLD_DIM : BLUE_DIM;
  const color = accent === 'gold' ? GOLD : BLUE;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 22,
    padding: '0 8px',
    borderRadius: 4,
    border: `1px solid ${active ? 'rgba(124, 244, 198, 0.5)' : dim}`,
    background: active ? 'rgba(124, 244, 198, 0.12)' : accent === 'gold' ? 'rgba(255, 224, 130, 0.08)' : 'rgba(159, 212, 255, 0.08)',
    color: active ? '#7cf4c6' : color,
    fontSize: 8,
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0,
  };
}

function GuideSectionBody({
  section,
  featured,
  copiedId,
  onCopySection,
}: {
  section: BeatPadsGuideSection;
  featured?: boolean;
  copiedId: string | null;
  onCopySection: (id: string, text: string) => void;
}) {
  const isCopied = copiedId === section.id;
  return (
    <section style={{ marginBottom: featured ? 14 : 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {section.badge ? (
            <span
              style={{
                fontSize: 7,
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: featured ? GOLD : BLUE,
                border: `1px solid ${featured ? GOLD_DIM : BLUE_DIM}`,
                borderRadius: 3,
                padding: '2px 5px',
                background: featured ? 'rgba(255, 224, 130, 0.12)' : 'rgba(159, 212, 255, 0.08)',
                flexShrink: 0,
              }}
            >
              {section.badge}
            </span>
          ) : null}
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.06em',
              color: featured ? GOLD : '#e8eef8',
              textShadow: featured ? '0 0 10px rgba(255, 224, 130, 0.25)' : undefined,
            }}
          >
            {section.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onCopySection(section.id, beatPadsGuideSectionPlainText(section))}
          title={`Copy ${section.title} section`}
          style={copyBtnStyle(isCopied, featured ? 'gold' : 'blue')}
        >
          {isCopied ? <Check size={10} /> : <Copy size={10} />}
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {section.blocks.map((b) => (
        <div key={b.heading} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              color: featured ? '#ffd966' : BLUE,
              marginBottom: 3,
              letterSpacing: '0.04em',
            }}
          >
            {b.heading}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1.5,
              color: '#a8b0bc',
            }}
          >
            {b.body}
          </p>
        </div>
      ))}
    </section>
  );
}

function BeatPadsStudioGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(null), 2200);
    return () => clearTimeout(t);
  }, [copiedId]);

  const copyText = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
    } catch {
      /* */
    }
  }, []);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Beat Pads guide — VocalBox, Lane Placements, Auto Drum, Pad Spread & Match Chords"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100095,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(520px, 96vw)',
          maxHeight: 'min(680px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(165deg, #0c1018 0%, #060608 100%)',
          border: `1px solid ${BLUE_DIM}`,
          borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(159, 212, 255, 0.08) inset',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: `1px solid ${BLUE_DIM}`,
            flexShrink: 0,
            background: 'rgba(159, 212, 255, 0.06)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: BLUE, letterSpacing: '0.06em' }}>
            BEAT PADS GUIDE
          </span>
          <button
            type="button"
            onClick={() => void copyText(beatPadsStudioGuidePlainText(), 'all')}
            title="Copy entire guide — social post, VocalBox, Lane Placements, Auto Drum, Pad Spread, and overview"
            style={{
              ...copyBtnStyle(copiedId === 'all', 'blue'),
              height: 24,
              marginLeft: 4,
            }}
          >
            {copiedId === 'all' ? <Check size={11} /> : <Copy size={11} />}
            {copiedId === 'all' ? 'Copied!' : 'Copy everything'}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 5,
              border: '1px solid #2a2a32',
              background: '#12121a',
              color: '#9a9aa8',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.45,
              color: '#c8d0dc',
            }}
          >
            {BEAT_PADS_STUDIO_GUIDE.subtitle}
          </p>

          <div
            style={{
              marginBottom: 14,
              padding: '10px 11px',
              borderRadius: 8,
              border: `1px solid ${GOLD_DIM}`,
              background: 'linear-gradient(165deg, rgba(255, 224, 130, 0.1) 0%, rgba(8, 8, 12, 0.9) 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.12em', color: GOLD }}>
                COPY FOR SOCIAL
              </span>
              <button
                type="button"
                onClick={() => void copyText(BEAT_PADS_SOCIAL_BLURB, 'social')}
                style={copyBtnStyle(copiedId === 'social', 'gold')}
              >
                {copiedId === 'social' ? <Check size={10} /> : <Copy size={10} />}
                {copiedId === 'social' ? 'Copied!' : 'Copy post'}
              </button>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1.5,
                color: '#f8fafc',
              }}
            >
              {BEAT_PADS_SOCIAL_BLURB}
            </p>
          </div>

          {BEAT_PADS_STUDIO_GUIDE.highlights.map((sec) => (
            <GuideSectionBody
              key={sec.id}
              section={sec}
              featured
              copiedId={copiedId}
              onCopySection={(id, text) => void copyText(text, id)}
            />
          ))}

          {BEAT_PADS_STUDIO_GUIDE.sections.map((sec) => (
            <GuideSectionBody
              key={sec.id}
              section={sec}
              copiedId={copiedId}
              onCopySection={(id, text) => void copyText(text, id)}
            />
          ))}
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 600, color: '#6a7280' }}>
            Copy one section or everything above
          </span>
          <button
            type="button"
            onClick={() => void copyText(beatPadsStudioGuidePlainText(), 'all')}
            style={{
              ...copyBtnStyle(copiedId === 'all', 'blue'),
              height: 28,
              padding: '0 12px',
              fontSize: 9,
            }}
          >
            {copiedId === 'all' ? <Check size={11} /> : <Copy size={11} />}
            {copiedId === 'all' ? 'Everything copied!' : 'Copy everything'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Blue ? — Beat Pads quick guide with social copy (dock header). */
export function BeatPadsStudioGuideHelp({
  title = 'Beat Pads guide — VocalBox, Lane Placements, Auto Drum, Pad Spread & Match Chords',
}: {
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={title}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={blueTipBtnStyle}
      >
        ?
      </button>
      <BeatPadsStudioGuideModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
