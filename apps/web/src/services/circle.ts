/**
 * Mothers' circle. Cartoon name and avatar only. Her real name is never written here.
 * Notes stay on this phone. The starter notes are written by Neema, not by other people.
 */

const ID_KEY = 'neema.circle.id';
const POSTS_KEY = 'neema.circle.posts';

export interface CircleSelf {
  id: string;
  nameEn: string;
  nameSw: string;
  /** Which drawing, 0–7. */
  avatar: number;
}

export interface CirclePost {
  id: string;
  authorEn: string;
  authorSw: string;
  avatar: number;
  text: string;
  atMs: number;
  mine: boolean;
}

const NAMES: { en: string; sw: string }[] = [
  { en: 'Quiet Sunbird', sw: 'Kiluwiluwi Mpole' },
  { en: 'Bright Weaver', sw: 'Kwaya Angavu' },
  { en: 'Soft Lark', sw: 'Leku Laini' },
  { en: 'Little Heron', sw: 'Korongo Mdogo' },
  { en: 'Warm Robin', sw: 'Chiriku Joto' },
  { en: 'Calm Dove', sw: 'Hua Tulivu' },
  { en: 'Kind Swallow', sw: 'Mbayuwayu Mwema' },
  { en: 'Gentle Owl', sw: 'Bundi Mpole' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function loadCircleSelf(): CircleSelf {
  let id = '';
  try {
    id = localStorage.getItem(ID_KEY) ?? '';
  } catch {
    id = '';
  }
  if (!id) {
    id = `c_${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(ID_KEY, id);
    } catch {
      /* ignore */
    }
  }
  const n = hash(id);
  const name = NAMES[n % NAMES.length]!;
  return { id, nameEn: name.en, nameSw: name.sw, avatar: n % 8 };
}

export function loadMyPosts(): CirclePost[] {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CirclePost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addMyPost(text: string, self: CircleSelf): CirclePost[] {
  const next: CirclePost = {
    id: `p_${Date.now().toString(36)}`,
    authorEn: self.nameEn,
    authorSw: self.nameSw,
    avatar: self.avatar,
    text: text.trim().slice(0, 500),
    atMs: Date.now(),
    mine: true,
  };
  const all = [next, ...loadMyPosts()].slice(0, 40);
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
  return all;
}

/** Written by Neema so the circle is not an empty room. Not live mothers. */
export function starterNotes(): CirclePost[] {
  return [
    {
      id: 'seed-1',
      authorEn: 'Quiet Sunbird',
      authorSw: 'Kiluwiluwi Mpole',
      avatar: 0,
      text: 'The night the baby would not settle, I sat by the window and just breathed. It did not fix the night. It made the next minute possible.',
      atMs: 0,
      mine: false,
    },
    {
      id: 'seed-2',
      authorEn: 'Bright Weaver',
      authorSw: 'Kwaya Angavu',
      avatar: 1,
      text: 'I was afraid to say I felt flat. Another mother said she had felt that too, and that a person at the clinic helped. I went.',
      atMs: 0,
      mine: false,
    },
    {
      id: 'seed-3',
      authorEn: 'Soft Lark',
      authorSw: 'Leku Laini',
      avatar: 2,
      text: 'Ask for the heavy chore to be someone else’s today. Rest is part of healing, not a favour you have to earn.',
      atMs: 0,
      mine: false,
    },
  ];
}
