/**
 * Da Music Box — tabbed product overview for demos and commercial intros.
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';

import {
  CREATION_STATION_OVERVIEW_TABS,
  MUSIC_BOX_OVERVIEW_BLOCKS,
  MUSIC_BOX_OVERVIEW_MAIN_TABS,
  STUDIO_EDITOR2_OVERVIEW_TABS,
  musicBoxOverviewAllPlainText,
  musicBoxOverviewCurrentPlainText,
  type CreationStationOverviewTabId,
  type MusicBoxOverviewMainTabId,
  type StudioEditor2OverviewTabId,
} from '@/app/lib/musicBoxOverview';

const PLATINUM = '#d4dce8';
const PLATINUM_DIM = 'rgba(212, 220, 232, 0.45)';
const ACCENT = '#00E5FF';
const COPY_OK = '#7cf4c6';

function tabChipStyle(active: boolean, highlight?: boolean): CSSProperties {
  return {
    padding: '3px 7px',
    borderRadius: 4,
    border: `1px solid ${active ? 'rgba(0, 229, 255, 0.55)' : highlight ? 'rgba(212, 220, 232, 0.35)' : 'rgba(255,255,255,0.1)'}`,
    background: active
      ? 'rgba(0, 229, 255, 0.14)'
      : highlight
        ? 'rgba(212, 220, 232, 0.06)'
        : 'rgba(255,255,255,0.04)',
    color: active ? ACCENT : highlight ? PLATINUM : '#9a9aa8',
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 0.3,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: highlight && !active ? '0 0 10px rgba(212, 220, 232, 0.08)' : undefined,
  };
}

function copyBtnStyle(copied: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 22,
    padding: '0 8px',
    borderRadius: 4,
    border: `1px solid ${copied ? 'rgba(124, 244, 198, 0.5)' : 'rgba(0, 229, 255, 0.35)'}`,
    background: copied ? 'rgba(124, 244, 198, 0.12)' : 'rgba(0, 229, 255, 0.08)',
    color: copied ? COPY_OK : ACCENT,
    fontSize: 8,
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0,
  };
}

export function MusicBoxOverviewModal({
  open,
  onClose,
  initialMainTab = 'welcome',
}: {
  open: boolean;
  onClose: () => void;
  initialMainTab?: MusicBoxOverviewMainTabId;
}) {
  const [mainTab, setMainTab] = useState<MusicBoxOverviewMainTabId>(initialMainTab);
  const [creationTab, setCreationTab] = useState<CreationStationOverviewTabId>('cs-intro');
  const [se2Tab, setSe2Tab] = useState<StudioEditor2OverviewTabId>('se2-intro');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setMainTab(initialMainTab);
  }, [open, initialMainTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copyText = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } catch {
      /* clipboard blocked */
    }
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const contentKey =
    mainTab === 'creation-station'
      ? creationTab
      : mainTab === 'studio-editor-2'
        ? se2Tab
        : mainTab;
  const block = MUSIC_BOX_OVERVIEW_BLOCKS[contentKey];
  const isWelcome = mainTab === 'welcome';
  const isSe2 = mainTab === 'studio-editor-2';

  const modalMaxHeight = isWelcome
    ? 'min(720px, 92vh)'
    : isSe2
      ? 'min(700px, 92vh)'
      : mainTab === 'creation-station'
        ? 'min(640px, 90vh)'
        : 'min(620px, 90vh)';

  return createPortal(
    <div
      role="dialog"
      aria-label="Da Music Box overview"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10085,
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
          width: 'min(580px, 96vw)',
          maxHeight: modalMaxHeight,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(165deg, #0a0c10 0%, #07090c 100%)',
          border: '1px solid rgba(212, 220, 232, 0.28)',
          borderRadius: 12,
          boxShadow: '0 24px 56px rgba(0,0,0,0.72), 0 0 40px rgba(0, 229, 255, 0.06)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 12px',
            borderBottom: '1px solid rgba(212, 220, 232, 0.12)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.6,
              background: 'linear-gradient(180deg, #f0f4f8 0%, #a8b4c4 55%, #d4dce8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            DA MUSIC BOX — OVERVIEW
          </span>
          <button
            type="button"
            onClick={() =>
              void copyText(
                musicBoxOverviewCurrentPlainText({ mainTab, creationTab, se2Tab }),
                'tab',
              )
            }
            title="Copy this tab — paragraphs and bullets as plain text"
            style={copyBtnStyle(copiedId === 'tab')}
          >
            {copiedId === 'tab' ? <Check size={11} /> : <Copy size={11} />}
            Copy tab
          </button>
          <button
            type="button"
            onClick={() => void copyText(musicBoxOverviewAllPlainText(), 'all')}
            title="Copy entire product overview — all tabs, social blurb, Creation Station, Studio Editor 2"
            style={copyBtnStyle(copiedId === 'all')}
          >
            {copiedId === 'all' ? <Check size={11} /> : <Copy size={11} />}
            Copy all
          </button>
          <button
            type="button"
            aria-label="Close overview"
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

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: '8px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          {MUSIC_BOX_OVERVIEW_MAIN_TABS.map((t) => {
            const active = mainTab === t.id;
            const highlight = t.id === 'welcome' || t.id === 'studio-editor-2' || t.id === 'mastering-bay';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMainTab(t.id)}
                style={tabChipStyle(active, highlight)}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {mainTab === 'creation-station' && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              padding: '6px 10px 8px',
              borderBottom: '1px solid rgba(0, 229, 255, 0.08)',
              flexShrink: 0,
              background: 'rgba(0, 229, 255, 0.03)',
            }}
          >
            {CREATION_STATION_OVERVIEW_TABS.map((t) => {
              const active = creationTab === t.id;
              const highlight = t.id === 'beat-lab' || t.id === 'groove-lab';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCreationTab(t.id)}
                  style={tabChipStyle(active, highlight)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {mainTab === 'studio-editor-2' && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              padding: '6px 10px 8px',
              borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
              flexShrink: 0,
              background: 'rgba(124, 244, 198, 0.04)',
            }}
          >
            {STUDIO_EDITOR2_OVERVIEW_TABS.map((t) => {
              const active = se2Tab === t.id;
              const highlight =
                t.id === 'se2-beat-pads' ||
                t.id === 'se2-chord-generator' ||
                t.id === 'se2-intro';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSe2Tab(t.id)}
                  style={tabChipStyle(active, highlight)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ padding: '12px 14px 14px', overflowY: 'auto', flex: '1 1 auto' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#f0f2f8', marginBottom: 4, lineHeight: 1.3 }}>
            {block.title}
            {block.highlight ? (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 8,
                  fontWeight: 800,
                  color: ACCENT,
                  letterSpacing: 0.4,
                  verticalAlign: 'middle',
                }}
              >
                ★ FEATURED
              </span>
            ) : null}
          </div>
          {block.tagline ? (
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: PLATINUM_DIM,
                margin: '0 0 10px',
                letterSpacing: 0.2,
                lineHeight: 1.45,
              }}
            >
              {block.tagline}
            </p>
          ) : null}
          {block.paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                fontSize: 10,
                lineHeight: 1.55,
                color: '#b8bcc8',
                margin: i === block.paragraphs.length - 1 ? '0 0 12px' : '0 0 8px',
              }}
            >
              {p}
            </p>
          ))}
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 14px',
              listStyle: 'disc',
            }}
          >
            {block.bullets.map((b, i) => (
              <li
                key={i}
                style={{
                  fontSize: 9,
                  lineHeight: 1.5,
                  color: '#9aa0b0',
                  marginBottom: 4,
                }}
              >
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
