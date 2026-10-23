import type { RouterOutputs } from '../lib/trpc';

export type View = Extract<RouterOutputs['course']['view'], { status: 'ready' }>;
export type SDoc = View['doc'];
export type SModule = SDoc['modules'][number];
export type SSection = SModule['sections'][number];
export type SSlide = SModule['slides'][number];
export type SItem = SModule['quiz'][number];
export type Progress = View['progress'][number];
export type Mode = 'read' | 'podcast' | 'slides';
