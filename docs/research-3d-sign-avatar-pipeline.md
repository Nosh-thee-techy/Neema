# Research note: 3D text-to-sign avatar pipeline

Status: **research only** — not implemented. Do not ship as clinical messaging or as Kenyan Sign Language.

## Source summary (external architecture sketch)

A production 3D signing avatar usually stacks three layers:

1. **Translation** — written text → sign grammar / gloss / HamNoSys→SiGML (not word-for-word).
2. **Motion** — notation player, neural pose synthesis (e.g. SMPL-X), or blended verified clips.
3. **Presentation** — rigged character + face blendshapes in Blender / Unity / Three.js (glTF).

| Approach | Idea | Fit |
| --- | --- | --- |
| Notation (HamNoSys → SiGML → CWASA/JASigning) | Editable dictionary, rule facial markers | Precision, web demos |
| Neural text/gloss → motion | Diffusion/transformer → SMPL-X (+ MANO hands) | Fluid co-articulation; heavy models |
| Hybrid gloss → clip library | NLP gloss + curated 3D clips + blend | Fastest to ship safely |

Pitfalls called out (valid): finger collisions, missing facial grammar, and **language mismatch** (ASL ≠ BSL ≠ KSL).

## Neema assessment

### What is right about this sketch

- Text ≠ sign grammar is the correct first principle.
- Facial non-manuals matter; a blank face with correct hands can flip meaning.
- SMPL-X / MANO is the right skeleton if we ever leave 2D pose packets.
- Hybrid gloss→clip is the only path that matches Neema’s “don’t invent clinical content” rule: only verified clips play.

### What does **not** fit Neema yet

- **Language:** Product care copy is Kenya-facing; current packets are **How2Sign ASL research**. A neural or HamNoSys stack trained/authored for ASL must stay labeled research — never “KSL” or “patient message.”
- **Offline PWA:** On-device diffusion / SignAvatars-class inference is unrealistic for field phones. Prebaked motion (JSON poses today, glTF clips later) wins.
- **Safety:** Free text → avatar must not invent medical advice. Keep scripted chapters / curated gloss lists; hand danger taps to SMS/facility as today.
- **Scope jump:** Unity/Unreal/Blender offline render is the wrong first platform for `neema-web`. Prefer Three.js + glTF **or** keep improving pose-driven canvas until a real KSL/clinical partner owns the dictionary.

### Recommended ladder (when we build)

1. **Now (done-ish):** Passport-framed 2D woman + slowed How2Sign packets + chapter scripts. Honest ASL research label.
2. **Next experiment:** Hybrid — same scripts, swap painter for a **single glTF woman** driven by existing joint streams or short verified clips (no open text→sign).
3. **Later (partnered):** Gloss dictionary for the **target** sign language + facial blendshapes; only then consider CWASA/SiGML or neural retarget.
4. **Not yet:** Live LLM text→sign in the maternal guardian path.

## Decision for this branch

Document architecture only. **No build / no Fly deploy** of a 3D stack from this note.
