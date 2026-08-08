import { BadRequestException } from '@nestjs/common';

type TipTapNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: TipTapNode[];
};

type RenderedNode = { html: string; plainText: string };

export type NormalizedEditorialContent = {
  contentHtml: string;
  plainText: string;
};

const ALLOWED_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'hardBreak',
  'text',
  'image',
]);

const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function assertSafeAttributes(attrs: Record<string, unknown> | undefined) {
  if (!attrs) return;
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase().startsWith('on') || key.toLowerCase() === 'style') {
      throw new BadRequestException(`Attribut Tiptap interdit: ${key}`);
    }
  }
}

function safeUrl(value: unknown, kind: 'link' | 'image') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`URL ${kind === 'link' ? 'de lien' : "d'image"} invalide.`);
  }

  const url = value.trim();
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    throw new BadRequestException(`URL ${kind === 'link' ? 'de lien' : "d'image"} non autorisée.`);
  }

  if (kind === 'link' && (url.startsWith('/') || url.startsWith('#') || url.startsWith('mailto:'))) {
    return url;
  }
  if (kind === 'image' && url.startsWith('/')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('unsafe protocol');
    }
    return url;
  } catch {
    throw new BadRequestException(`URL ${kind === 'link' ? 'de lien' : "d'image"} non autorisée.`);
  }
}

function parseNode(value: unknown): TipTapNode {
  if (!isRecord(value) || typeof value.type !== 'string' || !ALLOWED_NODES.has(value.type)) {
    throw new BadRequestException('Le contenu Tiptap contient un noeud non autorisé.');
  }

  const attrs = isRecord(value.attrs) ? value.attrs : undefined;
  assertSafeAttributes(attrs);

  const content = value.content === undefined ? undefined : value.content;
  if (content !== undefined && !Array.isArray(content)) {
    throw new BadRequestException('La structure du contenu Tiptap est invalide.');
  }

  const marks = value.marks === undefined ? undefined : value.marks;
  if (marks !== undefined && !Array.isArray(marks)) {
    throw new BadRequestException('Les marques du contenu Tiptap sont invalides.');
  }

  return {
    type: value.type,
    text: typeof value.text === 'string' ? value.text : undefined,
    attrs,
    content: content?.map(parseNode),
    marks: marks?.map((mark) => {
      if (!isRecord(mark) || typeof mark.type !== 'string' || !ALLOWED_MARKS.has(mark.type)) {
        throw new BadRequestException('Le contenu Tiptap contient une marque non autorisée.');
      }
      const markAttrs = isRecord(mark.attrs) ? mark.attrs : undefined;
      assertSafeAttributes(markAttrs);
      return { type: mark.type, attrs: markAttrs };
    }),
  };
}

function renderChildren(node: TipTapNode) {
  return (node.content ?? []).map(renderNode).reduce(
    (combined, child) => ({
      html: combined.html + child.html,
      plainText: combined.plainText + child.plainText,
    }),
    { html: '', plainText: '' },
  );
}

function renderText(node: TipTapNode): RenderedNode {
  let html = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'link': {
        const href = safeUrl(mark.attrs?.href, 'link');
        html = `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${html}</a>`;
        break;
      }
    }
  }
  return { html, plainText: node.text ?? '' };
}

function renderNode(node: TipTapNode): RenderedNode {
  if (node.type === 'text') return renderText(node);
  if (node.type === 'hardBreak') return { html: '<br>', plainText: '\n' };

  const children = renderChildren(node);
  switch (node.type) {
    case 'doc':
      return children;
    case 'paragraph':
      return { html: `<p>${children.html}</p>`, plainText: `${children.plainText}\n\n` };
    case 'heading': {
      const requestedLevel = Number(node.attrs?.level ?? 1);
      const level = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 6
        ? requestedLevel
        : 1;
      return {
        html: `<h${level}>${children.html}</h${level}>`,
        plainText: `${children.plainText}\n\n`,
      };
    }
    case 'bulletList':
      return { html: `<ul>${children.html}</ul>`, plainText: `${children.plainText}\n` };
    case 'orderedList':
      return { html: `<ol>${children.html}</ol>`, plainText: `${children.plainText}\n` };
    case 'listItem':
      return { html: `<li>${children.html}</li>`, plainText: `• ${children.plainText}\n` };
    case 'blockquote':
      return { html: `<blockquote>${children.html}</blockquote>`, plainText: `${children.plainText}\n` };
    case 'image': {
      const src = safeUrl(node.attrs?.src, 'image');
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      return { html: `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`, plainText: alt };
    }
    default:
      throw new BadRequestException('Le contenu Tiptap contient un noeud non autorisé.');
  }
}

/**
 * The API accepts only the Tiptap/ProseMirror JSON document. HTML and plain text
 * are regenerated here from a small allowlist, so client-provided markup never
 * becomes public content.
 */
export function normalizeEditorialContent(contentJson: unknown): NormalizedEditorialContent {
  const document = parseNode(contentJson);
  if (document.type !== 'doc') {
    throw new BadRequestException('Le contenu Tiptap doit commencer par un document.');
  }

  const rendered = renderNode(document);
  const plainText = rendered.plainText.replace(/\n{3,}/g, '\n\n').trim();
  if (!plainText) {
    throw new BadRequestException('Le contenu éditorial ne peut pas être vide.');
  }

  return { contentHtml: rendered.html, plainText };
}
