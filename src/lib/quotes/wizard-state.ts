import type { Quote } from '#lib/gen/unisource/v2/quotes_pb.js';

export const wizardStages = ['import', 'review', 'details', 'agent', 'preview'] as const;
export type WizardStage = (typeof wizardStages)[number] | 'summary';
export interface WizardEditorState {
	quote?: Quote;
	dirty: boolean;
	saving: boolean;
	busy: boolean;
	pdfCurrent: boolean;
	navigate?: (stage: WizardStage, editing?: boolean) => Promise<boolean>;
}
export interface QuoteWizardMode {
	stage: WizardStage;
	editing: boolean;
	resume?: boolean;
	initialFile?: File;
	onstagechange: (stage: WizardStage, editing?: boolean) => void | Promise<void>;
	onstatechange: (state: WizardEditorState) => void;
}
export interface WizardLocation { stage: WizardStage; editing: boolean }
export function readWizardLocation(url: { searchParams: { get(name: string): string | null } }, fallback: WizardStage = 'review'): WizardLocation {
	const requested = url.searchParams.get('step');
	const stage = (requested === 'summary' || wizardStages.includes(requested as (typeof wizardStages)[number])) ? requested as WizardStage : fallback;
	return { stage, editing: url.searchParams.get('edit') === '1' && stage !== 'import' && stage !== 'summary' };
}
export function wizardHref(url: { href: string }, stage: WizardStage, editing = false): string {
	const next = new URL(url.href);
	next.searchParams.set('step', stage);
	if (editing && stage !== 'import' && stage !== 'summary') next.searchParams.set('edit', '1');
	else next.searchParams.delete('edit');
	return `${next.pathname}${next.search}${next.hash}`;
}

export const wizardLabels: Record<WizardStage, string> = {
 import: 'Import danych', review: 'Sprawdź dane', details: 'Dane wyceny', agent: 'Asystent AI', preview: 'Podgląd i zatwierdzenie', summary: 'Gotowa wycena'
};
// The server persists the five original workflow stages. Document details are
// a separate screen within review; explicit URLs retain that screen on reload.
export function persistedStage(stage: WizardStage): Exclude<WizardStage, 'details'> {
 return stage === 'details' ? 'review' : stage;
}
export function wizardStep(stage: WizardStage): number {
 return wizardStages.indexOf(stage === 'summary' ? 'preview' : stage);
}
