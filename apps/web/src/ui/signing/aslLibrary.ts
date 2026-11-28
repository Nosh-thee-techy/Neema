/**
 * How2Sign (ASL) research clip map for Neema message keys.
 * CC BY-NC 4.0 — NEVER label as Kenyan Sign Language or as approved patient messaging.
 */

export const ASL_LABEL =
  'ASL RESEARCH: How2Sign sentence. Not a patient message. Not Kenyan Sign Language. Not reviewed.';

export const ASL_CITATION =
  'Duarte et al. How2Sign: A Large-scale Multimodal Dataset for Continuous American Sign Language. CVPR 2021. Motion: How2Sign-MV3D. CC BY-NC 4.0.';

/** Static packets under /signing/asl/packets/{id}.json */
export const MESSAGE_TO_ASL_CLIP: Record<string, string> = {
  green_calm: '--8pSDeC-fg_0-5', // Hi.
  yellow_recheck_bp: '1xKU91ggLeI_2-5', // How are you?
  yellow_fever: 'CE23zzfUBDw_7-5', // Have you seen any problems…
  yellow_pulse_baseline: '06jk1stVwMI_2-5', // Are you comfortable?
  yellow_baby_movement: 'cQBrXCcfDyc_22-5', // Are you ready?
  yellow_signal_lost: 'CE23zzfUBDw_7-5',
  red_go_now: 'g1HXoDkax5A_20-3', // It's extremely painful.
  red_bleeding: 'g1HXoDkax5A_20-3',
  red_sos: 'g1HXoDkax5A_20-3',
  unknown_check_band: '1xKU91ggLeI_2-5',
  epds_ok: '-0N0jbyBW6g_11-5', // Thank you.
  epds_talk_to_person: '--8pSDeC-fg_7-5', // How do you feel about yourself?
};

export function clipUrl(clipId: string): string {
  return `/signing/asl/packets/${encodeURIComponent(clipId)}.json`;
}

export type ClipCaption = { id: string; sentence: string; frames: number };

let captionsPromise: Promise<ClipCaption[]> | null = null;

/** The sentence for each clip, from the small manifest, before the motion file arrives. */
export function loadClipCaptions(): Promise<ClipCaption[]> {
  captionsPromise ??= fetch('/signing/asl/packets/manifest.json')
    .then((res) => (res.ok ? (res.json() as Promise<ClipCaption[]>) : []))
    .catch(() => []);
  return captionsPromise;
}
