'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, RotateCcw, Sparkles, X } from 'lucide-react';
import type {
  StructuredReading,
  StructuredRitual,
  StructuredSection,
} from './reading-workspace.types';

interface StructuredReadingEditorProps {
  reading: StructuredReading;
  readOnly: boolean;
  savingBlockId: string | null;
  revisingBlockId: string | null;
  onSaveBlock: (blockId: string, value: unknown) => Promise<void>;
  onReviseBlock: (blockId: string, instruction: string) => Promise<void>;
}

const DOMAIN_LABELS: Record<string, string> = {
  spirituel: 'Spirituel',
  relations: 'Relations',
  mission: 'Mission',
  creativite: 'Créativité',
  emotions: 'Émotions',
  travail: 'Travail',
  sante: 'Santé',
  finance: 'Finance',
};

export function StructuredReadingEditor({
  reading,
  readOnly,
  savingBlockId,
  revisingBlockId,
  onSaveBlock,
  onReviseBlock,
}: StructuredReadingEditorProps) {
  const blocks = useMemo(
    () => [
      { id: 'introduction', label: 'Introduction', value: reading.pdf_content.introduction },
      {
        id: 'archetype_reveal',
        label: `Archétype — ${reading.synthesis.archetype}`,
        value: reading.pdf_content.archetype_reveal,
      },
      ...reading.pdf_content.sections.map((section) => ({
        id: `section.${section.domain}`,
        label: DOMAIN_LABELS[section.domain] ?? section.domain,
        value: section,
      })),
      ...reading.pdf_content.karmic_insights.map((insight, index) => ({
        id: `insight.${index}`,
        label: `Insight karmique ${index + 1}`,
        value: insight,
      })),
      { id: 'life_mission', label: 'Mission de vie', value: reading.pdf_content.life_mission },
      ...reading.pdf_content.rituals.map((ritual, index) => ({
        id: `ritual.${index}`,
        label: `Rituel ${index + 1}`,
        value: ritual,
      })),
      { id: 'conclusion', label: 'Conclusion', value: reading.pdf_content.conclusion },
    ],
    [reading],
  );

  return (
    <div className="space-y-3 pb-28">
      {blocks.map((block) => (
        <ReadingBlockCard
          key={block.id}
          blockId={block.id}
          label={block.label}
          value={block.value}
          readOnly={readOnly}
          isSaving={savingBlockId === block.id}
          isRevising={revisingBlockId === block.id}
          onSave={(value) => onSaveBlock(block.id, value)}
          onRevise={(instruction) => onReviseBlock(block.id, instruction)}
        />
      ))}
    </div>
  );
}

interface ReadingBlockCardProps {
  blockId: string;
  label: string;
  value: string | StructuredSection | StructuredRitual;
  readOnly: boolean;
  isSaving: boolean;
  isRevising: boolean;
  onSave: (value: unknown) => Promise<void>;
  onRevise: (instruction: string) => Promise<void>;
}

function ReadingBlockCard({
  blockId,
  label,
  value,
  readOnly,
  isSaving,
  isRevising,
  onSave,
  onRevise,
}: ReadingBlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [instruction, setInstruction] = useState('');
  const [showRevision, setShowRevision] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  const isSection = typeof value !== 'string' && 'domain' in value;
  const isRitual = typeof value !== 'string' && 'instructions' in value;
  const textForDisplay =
    typeof value === 'string'
      ? value
      : isSection
        ? value.content
        : `${value.description}\n\n${value.instructions.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;

  const canRevise = !isRitual;

  const save = async () => {
    await onSave(draft);
    setEditing(false);
  };

  const revise = async () => {
    if (!instruction.trim()) return;
    await onRevise(instruction.trim());
    setInstruction('');
    setShowRevision(false);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-desk-border bg-desk-surface">
      <header className="flex items-center justify-between gap-3 border-b border-desk-border bg-desk-card/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-desk-text">{label}</p>
          <p className="mt-0.5 text-[11px] text-desk-subtle">{countWords(textForDisplay)} mots</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            {canRevise && (
              <button
                type="button"
                onClick={() => setShowRevision((current) => !current)}
                disabled={isRevising}
                title="Corriger ce bloc avec EDITOR"
                className="rounded-lg p-2 text-amber-600 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {isRevising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing((current) => !current);
              }}
              title={editing ? 'Annuler la modification' : 'Modifier le bloc'}
              className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover hover:text-desk-text"
            >
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>
        )}
      </header>

      {showRevision && !readOnly && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 p-3">
          <label className="text-xs font-medium text-amber-700">Instruction ciblée pour EDITOR</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Ex. Corrige les répétitions sans changer le sens."
              className="min-h-10 flex-1 rounded-lg border border-desk-border bg-desk-input px-3 text-sm text-desk-text outline-none focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={() => void revise()}
              disabled={!instruction.trim() || isRevising}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" /> Corriger
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        {editing && !readOnly ? (
          <BlockEditor value={draft} onChange={setDraft} />
        ) : (
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-desk-text">{textForDisplay}</div>
        )}
      </div>

      {editing && !readOnly && (
        <footer className="flex items-center justify-end gap-2 border-t border-desk-border bg-desk-card/40 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-desk-muted hover:bg-desk-hover"
          >
            <RotateCcw className="h-4 w-4" /> Annuler
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer
          </button>
        </footer>
      )}
    </article>
  );
}

function BlockEditor({
  value,
  onChange,
}: {
  value: string | StructuredSection | StructuredRitual;
  onChange: (value: string | StructuredSection | StructuredRitual) => void;
}) {
  if (typeof value === 'string') {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={10}
        className="w-full resize-y rounded-xl border border-desk-border bg-desk-input px-4 py-3 text-sm leading-6 text-desk-text outline-none focus:border-amber-500/50"
      />
    );
  }

  if ('domain' in value) {
    return (
      <div className="space-y-3">
        <input
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          className="min-h-10 w-full rounded-lg border border-desk-border bg-desk-input px-3 text-sm font-semibold text-desk-text outline-none focus:border-amber-500/50"
        />
        <textarea
          value={value.content}
          onChange={(event) => onChange({ ...value, content: event.target.value })}
          rows={12}
          className="w-full resize-y rounded-xl border border-desk-border bg-desk-input px-4 py-3 text-sm leading-6 text-desk-text outline-none focus:border-amber-500/50"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Nom du rituel"
        className="min-h-10 w-full rounded-lg border border-desk-border bg-desk-input px-3 text-sm font-semibold text-desk-text outline-none focus:border-amber-500/50"
      />
      <textarea
        value={value.description}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
        rows={4}
        placeholder="Objectif et description"
        className="w-full resize-y rounded-xl border border-desk-border bg-desk-input px-4 py-3 text-sm leading-6 text-desk-text outline-none focus:border-amber-500/50"
      />
      <div className="space-y-2">
        {value.instructions.map((instruction, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-700">{index + 1}</span>
            <textarea
              value={instruction}
              onChange={(event) => {
                const instructions = [...value.instructions];
                instructions[index] = event.target.value;
                onChange({ ...value, instructions });
              }}
              rows={2}
              className="w-full resize-y rounded-lg border border-desk-border bg-desk-input px-3 py-2 text-sm text-desk-text outline-none focus:border-amber-500/50"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}
