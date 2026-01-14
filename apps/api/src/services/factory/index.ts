/**
 * @fileoverview Factory module barrel export.
 * Exports all Internal Factory services and types.
 */

// VertexOracle - Vertex AI / Gemini integration
export { VertexOracle } from './VertexOracle';
export type {
    UserProfile,
    OrderContext,
    ReadingSynthesis,
    TimelineDay,
    OracleResponse,
} from './VertexOracle';

// PdfFactory - Handlebars + Gotenberg PDF generation
export { PdfFactory } from './PdfFactory';
export type {
    TemplateName,
    PdfOptions,
    ReadingPdfData,
} from './PdfFactory';

// DigitalSoul - Spiritual journey agent (skeleton)
export { DigitalSoul } from './DigitalSoul';
export type {
    Timeline,
    TimelineStep,
} from './DigitalSoul';

// DigitalSoulService - Main orchestration service
export { DigitalSoulService } from './DigitalSoulService';
export type { GenerationResult } from './DigitalSoulService';
