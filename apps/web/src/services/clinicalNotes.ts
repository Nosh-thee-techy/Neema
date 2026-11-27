/**
 * Nurse / CHW clinical notes. Separate from the mother's own health notes.
 * The mother's UI only ever reads these; adding one needs the nurse to enter her name.
 * Not tamper-proof: a clinic backend should sign and sync these (see docs/BACKEND_CONTRACT.md).
 */
import { db, type ClinicalNoteRow } from '../storage/db';

export type { ClinicalNoteRow };

export async function listClinicalNotes(): Promise<ClinicalNoteRow[]> {
  return db.clinicalNotes.orderBy('tsMs').reverse().toArray();
}

export async function addClinicalNote(
  note: Omit<ClinicalNoteRow, 'id' | 'tsMs'> & { tsMs?: number },
): Promise<ClinicalNoteRow> {
  const text = note.text.trim();
  const authorName = note.authorName.trim();
  if (!text) throw new Error('Note is empty.');
  if (!authorName) throw new Error('Author name is required.');
  const row: ClinicalNoteRow = {
    id: `cn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    tsMs: note.tsMs ?? Date.now(),
    authorRole: note.authorRole,
    authorName,
    text,
    ...(note.facilityName?.trim() ? { facilityName: note.facilityName.trim() } : {}),
  };
  await db.clinicalNotes.put(row);
  return row;
}
