/**
 * Lets TitleBar / saveService capture the current Studio timeline without prop drilling.
 * StudioEditorScreen registers an exporter on mount.
 */

type Exporter = () => Promise<string>;

let exporter: Exporter | null = null;

export function registerStudioProjectCloudExporter(fn: Exporter | null) {
  exporter = fn;
}

export async function getStudioProjectJsonForCloudSave(): Promise<string | null> {
  if (!exporter) return null;
  try {
    return await exporter();
  } catch (e) {
    console.warn('Studio cloud save: exporter failed', e);
    return null;
  }
}
