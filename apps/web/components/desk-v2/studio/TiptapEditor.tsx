'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { useEffect, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Sparkles,
  Wand2,
  RotateCcw,
  RotateCw,
  Check,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface TiptapEditorProps {
  orderId: string;
  initialContent: string;
  onContentChange?: (content: string) => void;
  onSeal?: () => void;
  readOnly?: boolean;
}

export function TiptapEditor({
  orderId,
  initialContent,
  onContentChange,
  onSeal,
  readOnly = false,
}: TiptapEditorProps) {
  const [isRefining, setIsRefining] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Commencez à écrire ou utilisez l\'IA pour générer du contenu...',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-amber max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  });

  // Update content when initialContent changes
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  // AI refinement actions
  const refineContent = useCallback(async (action: string) => {
    if (!editor) return;

    const selectedText = editor.state.selection.empty
      ? editor.getText()
      : editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to
        );

    if (!selectedText.trim()) {
      toast.error('Sélectionnez du texte à affiner');
      return;
    }

    setIsRefining(true);
    setShowAIMenu(false);

    try {
      const { data } = await api.post(`/expert/orders/${orderId}/refine`, {
        instruction: action,
        selectedText,
      });

      if (data.refinedText) {
        if (editor.state.selection.empty) {
          editor.commands.setContent(data.refinedText);
        } else {
          editor.commands.insertContentAt(
            { from: editor.state.selection.from, to: editor.state.selection.to },
            data.refinedText
          );
        }
        toast.success('Texte affiné avec succès');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'affinage');
      console.error(error);
    } finally {
      setIsRefining(false);
    }
  }, [editor, orderId]);

  const AI_ACTIONS = [
    { id: 'shorten', label: 'Raccourcir', icon: '✂️', action: 'Raccourcis ce texte tout en gardant l\'essentiel' },
    { id: 'expand', label: 'Développer', icon: '📖', action: 'Développe et enrichis ce texte avec plus de détails spirituels' },
    { id: 'mystify', label: 'Mystifier', icon: '🔮', action: 'Rends ce texte plus mystique et poétique' },
    { id: 'simplify', label: 'Simplifier', icon: '💡', action: 'Simplifie ce texte pour le rendre plus accessible' },
    { id: 'tone', label: 'Adoucir', icon: '🕊️', action: 'Adoucis le ton pour le rendre plus bienveillant' },
  ];

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 bg-slate-900/80">
        {/* Formatting */}
        <div className="flex items-center gap-0.5 pr-3 border-r border-white/10">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Gras"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italique"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 px-3 border-r border-white/10">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Titre 1"
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Titre 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Titre 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 px-3 border-r border-white/10">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Liste"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Liste numérotée"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Citation"
          >
            <Quote className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* History */}
        <div className="flex items-center gap-0.5 px-3 border-r border-white/10">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Annuler"
          >
            <RotateCcw className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Rétablir"
          >
            <RotateCw className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* AI Actions */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowAIMenu(!showAIMenu)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg
              text-sm font-medium transition-all
              ${showAIMenu 
                ? 'bg-amber-500 text-slate-900' 
                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }
            `}
          >
            {isRefining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            <span>IA</span>
          </button>

          <AnimatePresence>
            {showAIMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl
                           bg-slate-800 border border-white/10 shadow-xl z-50"
              >
                {AI_ACTIONS.map(action => (
                  <button
                    key={action.id}
                    onClick={() => refineContent(action.action)}
                    disabled={isRefining}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left
                               text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Seal button */}
        {onSeal && (
          <button
            onClick={onSeal}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg ml-2
                       bg-emerald-500 text-white text-sm font-medium
                       hover:bg-emerald-400 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Sceller</span>
          </button>
        )}
      </div>

      {/* Selection AI Menu (custom replacement for BubbleMenu) */}
      <AnimatePresence>
        {editor && !editor.state.selection.empty && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-16 right-4 z-40 flex items-center gap-1 p-1 rounded-lg 
                       bg-slate-800 border border-white/10 shadow-xl"
          >
            {AI_ACTIONS.slice(0, 3).map(action => (
              <button
                key={action.id}
                onClick={() => refineContent(action.action)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs
                           text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {isRefining && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm
                       flex items-center justify-center z-50"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
              <span className="text-sm text-slate-400">L&apos;Oracle affine votre texte...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ToolbarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
}

function ToolbarButton({ children, onClick, isActive, disabled, title }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded-lg transition-colors
        ${isActive 
          ? 'bg-amber-500/20 text-amber-400' 
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}
