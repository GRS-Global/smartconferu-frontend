/* Approved institution names: what the institution search offers (mirrors INSTITUTIONS in the prototype's
   src/shared/institutions.js). A name that isn't here can still be used; it is saved marked "pending".
   The Super Admin master-data edits (renames, additions, retirements) are not applied here: that module is
   on hold, so this is the static base list only. */
export interface Institution {
  id: string;
  name: string;
  aliases: string[];
  country: string;
  departments?: string[];
}

export const INSTITUTIONS: Institution[] = [
  {
    "id": "iitb",
    "name": "Indian Institute of Technology Bombay",
    "aliases": [
      "IIT Bombay",
      "IITB",
      "IIT Mumbai"
    ],
    "country": "India",
    "departments": [
      "Department of Computer Science & Engineering",
      "Department of Electrical Engineering",
      "Department of Civil Engineering",
      "Shailesh J. Mehta School of Management"
    ]
  },
  {
    "id": "iitd",
    "name": "Indian Institute of Technology Delhi",
    "aliases": [
      "IIT Delhi",
      "IITD"
    ],
    "country": "India",
    "departments": [
      "Department of Computer Science & Engineering",
      "Department of Electrical Engineering",
      "Department of Mechanical Engineering",
      "Department of Mathematics",
      "Department of Management Studies",
      "AI & Data Systems Lab",
      "Yardi School of Artificial Intelligence"
    ]
  },
  {
    "id": "iitm",
    "name": "Indian Institute of Technology Madras",
    "aliases": [
      "IIT Madras",
      "IITM",
      "IIT Chennai"
    ],
    "country": "India"
  },
  {
    "id": "iitk",
    "name": "Indian Institute of Technology Kanpur",
    "aliases": [
      "IIT Kanpur",
      "IITK"
    ],
    "country": "India"
  },
  {
    "id": "iitkgp",
    "name": "Indian Institute of Technology Kharagpur",
    "aliases": [
      "IIT Kharagpur",
      "IIT KGP",
      "IITKGP"
    ],
    "country": "India"
  },
  {
    "id": "iitr",
    "name": "Indian Institute of Technology Roorkee",
    "aliases": [
      "IIT Roorkee",
      "IITR"
    ],
    "country": "India"
  },
  {
    "id": "iitg",
    "name": "Indian Institute of Technology Guwahati",
    "aliases": [
      "IIT Guwahati",
      "IITG"
    ],
    "country": "India"
  },
  {
    "id": "iith",
    "name": "Indian Institute of Technology Hyderabad",
    "aliases": [
      "IIT Hyderabad",
      "IITH"
    ],
    "country": "India"
  },
  {
    "id": "iisc",
    "name": "Indian Institute of Science",
    "aliases": [
      "IISc",
      "IISc Bangalore",
      "IISc Bengaluru"
    ],
    "country": "India"
  },
  {
    "id": "iiith",
    "name": "International Institute of Information Technology Hyderabad",
    "aliases": [
      "IIIT Hyderabad",
      "IIITH"
    ],
    "country": "India"
  },
  {
    "id": "nitt",
    "name": "National Institute of Technology Tiruchirappalli",
    "aliases": [
      "NIT Trichy",
      "NITT"
    ],
    "country": "India"
  },
  {
    "id": "nitk",
    "name": "National Institute of Technology Karnataka",
    "aliases": [
      "NIT Surathkal",
      "NITK"
    ],
    "country": "India"
  },
  {
    "id": "iima",
    "name": "Indian Institute of Management Ahmedabad",
    "aliases": [
      "IIM Ahmedabad",
      "IIMA"
    ],
    "country": "India"
  },
  {
    "id": "iimb",
    "name": "Indian Institute of Management Bangalore",
    "aliases": [
      "IIM Bangalore",
      "IIMB",
      "IIM Bengaluru"
    ],
    "country": "India"
  },
  {
    "id": "iimc",
    "name": "Indian Institute of Management Calcutta",
    "aliases": [
      "IIM Calcutta",
      "IIMC",
      "IIM Kolkata"
    ],
    "country": "India"
  },
  {
    "id": "iimk",
    "name": "Indian Institute of Management Kozhikode",
    "aliases": [
      "IIM Kozhikode",
      "IIMK"
    ],
    "country": "India"
  },
  {
    "id": "iiml",
    "name": "Indian Institute of Management Lucknow",
    "aliases": [
      "IIM Lucknow",
      "IIML"
    ],
    "country": "India"
  },
  {
    "id": "iimi",
    "name": "Indian Institute of Management Indore",
    "aliases": [
      "IIM Indore",
      "IIMI"
    ],
    "country": "India"
  },
  {
    "id": "nmims",
    "name": "NMIMS School of Business Management",
    "aliases": [
      "NMIMS",
      "Narsee Monjee Institute of Management Studies"
    ],
    "country": "India"
  },
  {
    "id": "sibm",
    "name": "Symbiosis Institute of Business Management",
    "aliases": [
      "SIBM",
      "Symbiosis Pune"
    ],
    "country": "India"
  },
  {
    "id": "bits",
    "name": "Birla Institute of Technology and Science, Pilani",
    "aliases": [
      "BITS Pilani",
      "BITS"
    ],
    "country": "India"
  },
  {
    "id": "dtu",
    "name": "Delhi Technological University",
    "aliases": [
      "DTU",
      "Delhi College of Engineering",
      "DCE"
    ],
    "country": "India"
  },
  {
    "id": "du",
    "name": "University of Delhi",
    "aliases": [
      "Delhi University",
      "DU"
    ],
    "country": "India"
  },
  {
    "id": "jnu",
    "name": "Jawaharlal Nehru University",
    "aliases": [
      "JNU"
    ],
    "country": "India"
  },
  {
    "id": "anna",
    "name": "Anna University",
    "aliases": [
      "Anna Univ"
    ],
    "country": "India"
  },
  {
    "id": "psg",
    "name": "PSG College of Technology",
    "aliases": [
      "PSG Tech",
      "PSG"
    ],
    "country": "India"
  },
  {
    "id": "vit",
    "name": "Vellore Institute of Technology",
    "aliases": [
      "VIT",
      "VIT Vellore"
    ],
    "country": "India"
  },
  {
    "id": "srm",
    "name": "SRM Institute of Science and Technology",
    "aliases": [
      "SRM",
      "SRM University"
    ],
    "country": "India"
  },
  {
    "id": "manipal",
    "name": "Manipal Academy of Higher Education",
    "aliases": [
      "Manipal University",
      "MAHE"
    ],
    "country": "India"
  },
  {
    "id": "amity",
    "name": "Amity University",
    "aliases": [
      "Amity"
    ],
    "country": "India"
  },
  {
    "id": "jadavpur",
    "name": "Jadavpur University",
    "aliases": [
      "JU"
    ],
    "country": "India"
  },
  {
    "id": "eotd",
    "name": "Exploration of the Domain",
    "aliases": [],
    "country": "India",
    "departments": [
      "Department of Computer Science & Engineering",
      "Department of Information Technology",
      "Department of Business Analytics",
      "AI & Data Systems Lab"
    ]
  },
  {
    "id": "mit",
    "name": "Massachusetts Institute of Technology",
    "aliases": [
      "MIT"
    ],
    "country": "United States"
  },
  {
    "id": "stanford",
    "name": "Stanford University",
    "aliases": [
      "Stanford"
    ],
    "country": "United States"
  },
  {
    "id": "harvard",
    "name": "Harvard University",
    "aliases": [
      "Harvard"
    ],
    "country": "United States"
  },
  {
    "id": "cmu",
    "name": "Carnegie Mellon University",
    "aliases": [
      "CMU"
    ],
    "country": "United States"
  },
  {
    "id": "ucb",
    "name": "University of California, Berkeley",
    "aliases": [
      "UC Berkeley",
      "Berkeley",
      "UCB"
    ],
    "country": "United States"
  },
  {
    "id": "oxford",
    "name": "University of Oxford",
    "aliases": [
      "Oxford"
    ],
    "country": "United Kingdom"
  },
  {
    "id": "cambridge",
    "name": "University of Cambridge",
    "aliases": [
      "Cambridge"
    ],
    "country": "United Kingdom"
  },
  {
    "id": "imperial",
    "name": "Imperial College London",
    "aliases": [
      "Imperial"
    ],
    "country": "United Kingdom"
  },
  {
    "id": "eth",
    "name": "ETH Zurich",
    "aliases": [
      "ETH",
      "Swiss Federal Institute of Technology Zurich"
    ],
    "country": "Switzerland"
  },
  {
    "id": "nus",
    "name": "National University of Singapore",
    "aliases": [
      "NUS"
    ],
    "country": "Singapore"
  },
  {
    "id": "ntu",
    "name": "Nanyang Technological University",
    "aliases": [
      "NTU",
      "NTU Singapore"
    ],
    "country": "Singapore"
  },
  {
    "id": "utokyo",
    "name": "University of Tokyo",
    "aliases": [
      "UTokyo",
      "Todai"
    ],
    "country": "Japan"
  },
  {
    "id": "tsinghua",
    "name": "Tsinghua University",
    "aliases": [
      "Tsinghua"
    ],
    "country": "China"
  },
  {
    "id": "uoft",
    "name": "University of Toronto",
    "aliases": [
      "U of T",
      "UofT"
    ],
    "country": "Canada"
  },
  {
    "id": "unimelb",
    "name": "University of Melbourne",
    "aliases": [
      "UniMelb",
      "Melbourne University"
    ],
    "country": "Australia"
  }
];

// Lower-case, no punctuation, single spaces: "I.I.T. Bombay" and "iit  bombay" compare equal.
export const normalizeInstitution = (s: string | null | undefined): string =>
  String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// "Dept. of CSE", "Department of Computer Science & Engineering" and "computer science and engineering" compare equal enough to catch a duplicate.
export const normalizeDepartment = (s: string | null | undefined): string =>
  normalizeInstitution(String(s || "").replace(/^\s*(the\s+)?(dept\.?|department)\s+(of\s+)?/i, "").replace(/&/g, " and "));

export function institutionDepartments(institutionId: string | null | undefined): string[] {
  if (!institutionId) return [];
  return INSTITUTIONS.find((i) => i.id === institutionId)?.departments ?? [];
}

export function findDepartment(institutionId: string | null | undefined, name: string): string | null {
  const q = normalizeDepartment(name);
  return q ? institutionDepartments(institutionId).find((d) => normalizeDepartment(d) === q) ?? null : null;
}

/** How many institutions the box offers before anything is typed. */
const EMPTY_QUERY_LIMIT = 50;

/** Best matches for what was typed: an exact name/short form first, then names or short forms starting with it, then ones containing it. */
export function searchInstitutions(query: string, limit = 8): Institution[] {
  const q = normalizeInstitution(query);
  // Nothing typed yet: the list itself, A to Z, so a click in the box already shows something to pick (the box scrolls).
  if (!q) return [...INSTITUTIONS].sort((a, b) => a.name.localeCompare(b.name)).slice(0, Math.max(limit, EMPTY_QUERY_LIMIT));
  const scored: Array<{ inst: Institution; score: number }> = [];
  for (const inst of INSTITUTIONS) {
    const forms = [inst.name, ...inst.aliases].map(normalizeInstitution);
    let score = 0;
    if (forms.some((f) => f === q)) score = 3;
    else if (forms.some((f) => f.startsWith(q))) score = 2;
    else if (forms.some((f) => f.includes(q))) score = 1;
    if (score) scored.push({ inst, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.inst.name.localeCompare(b.inst.name)).slice(0, limit).map((s) => s.inst);
}

/** The approved institution a typed name stands for, if it is exactly one of its forms. */
export function findInstitution(name: string): Institution | null {
  const q = normalizeInstitution(name);
  return q ? INSTITUTIONS.find((i) => [i.name, ...i.aliases].some((f) => normalizeInstitution(f) === q)) ?? null : null;
}
