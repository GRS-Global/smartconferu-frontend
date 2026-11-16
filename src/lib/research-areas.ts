/* The research-area taxonomy My Profile › About picks from, generated from the prototype's src/shared/researchAreas.js
   (the same list conferences use). The Super Admin's additions to it are not applied: that module is on hold. */

export const RESEARCH_AREA_GROUPS: { label: string; areas: string[] }[] = [
  {
    label: "Computing & Engineering",
    areas: [
      "Computer Science & AI",
      "Electrical & Electronics Engineering",
      "Mechanical & Industrial Engineering",
      "Civil Engineering & Built Environment",
      "Chemical Engineering",
      "Materials Science & Nanotechnology",
      "Energy",
    ],
  },
  {
    label: "Natural Sciences",
    areas: [
      "Mathematics & Statistics",
      "Physics & Astronomy",
      "Chemistry",
      "Life Sciences & Biotechnology",
      "Environmental & Earth Sciences",
      "Agriculture & Food Science",
    ],
  },
  {
    label: "Health",
    areas: ["Health & Medicine"],
  },
  {
    label: "Business & Social Sciences",
    areas: [
      "Business & Management",
      "Economics & Finance",
      "Social Sciences",
      "Psychology",
      "Law",
      "Education",
    ],
  },
  {
    label: "Arts & Humanities",
    areas: ["Arts & Humanities"],
  },
  {
    label: "Multidisciplinary",
    areas: ["Multidisciplinary"],
  },
];

export const RESEARCH_AREAS = RESEARCH_AREA_GROUPS.flatMap((g) => g.areas);

export const RESEARCH_SUBAREAS: Record<string, string[]> = {
  // ---------- Computing & Engineering ----------
  "Computer Science & AI": [
    "Artificial Intelligence", "Machine Learning & Deep Learning", "Generative AI & Large Language Models",
    "Data Science & Big Data", "Computer Vision & Image Processing", "Natural Language Processing",
    "Cybersecurity & Privacy", "Cloud, Edge & Distributed Computing", "Internet of Things",
    "Computer Networks", "Software Engineering", "Human–Computer Interaction",
    "Databases & Information Systems", "Information Retrieval & Recommender Systems",
    "Blockchain & Distributed Ledgers", "Algorithms & Theory of Computation",
    "High-Performance & Quantum Computing", "Computer Graphics, AR & VR", "Multimedia Computing",
  ],
  "Electrical & Electronics Engineering": [
    "Power Systems & Smart Grids", "Power Electronics & Drives", "Electric Vehicles",
    "VLSI & Embedded Systems", "Electronic Circuits & Devices", "Signal Processing",
    "Control Systems", "Communication Systems", "Wireless & Mobile Communications (5G/6G)",
    "Antennas, RF & Microwave", "Optical Communications & Photonics", "Instrumentation & Measurement",
    "Sensors & Sensor Networks",
  ],
  "Mechanical & Industrial Engineering": [
    "Mechanical Design", "Thermal & Fluid Engineering", "Manufacturing & Production Engineering",
    "Additive Manufacturing & Industry 4.0", "Robotics & Mechatronics", "Automotive Engineering",
    "Aerospace Engineering", "Industrial Engineering & Operations Research", "Tribology",
    "Maintenance & Reliability Engineering", "Marine & Naval Engineering",
  ],
  "Civil Engineering & Built Environment": [
    "Structural Engineering", "Geotechnical Engineering", "Transportation Engineering",
    "Construction Engineering & Management", "Water Resources & Hydraulic Engineering",
    "Environmental Engineering", "Earthquake Engineering", "Surveying & Geomatics",
    "Urban Planning & Smart Cities", "Architecture & Building Design", "Sustainable & Green Buildings",
  ],
  "Chemical Engineering": [
    "Process Engineering & Design", "Catalysis & Reaction Engineering", "Separation Processes",
    "Petroleum & Petrochemical Engineering", "Biochemical & Bioprocess Engineering",
    "Polymer Engineering", "Food Process Engineering", "Process Safety", "Process Modelling & Simulation",
  ],
  "Materials Science & Nanotechnology": [
    "Nanomaterials & Nanotechnology", "Polymers & Composites", "Metals & Alloys", "Ceramics & Glass",
    "Biomaterials", "Smart & Functional Materials", "Semiconductor Materials", "Thin Films & Coatings",
    "Materials Characterization", "Computational Materials Science",
  ],
  "Energy": [
    "Renewable Energy", "Solar Energy", "Wind Energy", "Energy Storage & Batteries",
    "Hydrogen & Fuel Cells", "Bioenergy & Biofuels", "Energy Efficiency & Management",
    "Nuclear Energy", "Oil & Gas", "Energy Policy & Economics",
  ],

  // ---------- Natural Sciences ----------
  "Mathematics & Statistics": [
    "Pure Mathematics", "Applied Mathematics", "Statistics & Probability",
    "Numerical Analysis & Computational Mathematics", "Optimization", "Mathematical Modelling",
    "Discrete Mathematics & Combinatorics", "Financial & Actuarial Mathematics", "Data Analytics & Biostatistics",
  ],
  "Physics & Astronomy": [
    "Condensed Matter Physics", "Quantum Physics & Quantum Technology", "Optics & Lasers",
    "Nuclear & Particle Physics", "Astronomy & Astrophysics", "Applied Physics", "Plasma Physics",
    "Atomic & Molecular Physics", "Medical Physics",
  ],
  "Chemistry": [
    "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry",
    "Polymer Chemistry", "Green & Sustainable Chemistry", "Electrochemistry", "Medicinal Chemistry",
    "Computational & Theoretical Chemistry", "Materials Chemistry",
  ],
  "Life Sciences & Biotechnology": [
    "Molecular Biology & Genetics", "Biochemistry", "Biotechnology", "Bioinformatics & Computational Biology",
    "Microbiology", "Immunology", "Neuroscience", "Cell Biology", "Plant Science", "Zoology",
    "Marine Biology", "Genomics & Proteomics",
  ],
  "Environmental & Earth Sciences": [
    "Climate Change", "Environmental Science", "Sustainability & Sustainable Development",
    "Ecology & Biodiversity Conservation", "Pollution Control & Waste Management", "Water Resources & Hydrology",
    "Geology & Geophysics", "Atmospheric Science & Meteorology", "Oceanography",
    "Remote Sensing & GIS", "Natural Hazards & Disaster Management", "Environmental Policy & Management",
  ],
  "Agriculture & Food Science": [
    "Agronomy & Crop Science", "Soil Science", "Precision & Smart Agriculture", "Horticulture",
    "Food Science & Technology", "Food Security & Nutrition", "Animal Science", "Veterinary Science",
    "Fisheries & Aquaculture", "Forestry", "Agricultural Engineering", "Agricultural Economics",
  ],

  // ---------- Health ----------
  "Health & Medicine": [
    "Clinical Medicine", "Public Health & Epidemiology", "Nursing", "Pharmacy & Pharmacology",
    "Dentistry", "Health Informatics & Digital Health", "Medical Imaging & Radiology",
    "Biomedical Engineering & Medical Devices", "Oncology", "Cardiology", "Neurology",
    "Mental Health & Psychiatry", "Nutrition & Dietetics", "Physiotherapy & Rehabilitation",
    "Sports Science & Physical Education", "Healthcare Management", "Traditional & Complementary Medicine",
  ],

  // ---------- Business & Social Sciences ----------
  "Business & Management": [
    "Strategic Management", "Marketing", "Finance", "Accounting & Auditing", "Human Resource Management",
    "Operations & Supply Chain Management", "Entrepreneurship & Innovation", "Management Information Systems",
    "Business Analytics", "E-Commerce & Digital Business", "Organizational Behaviour & Leadership",
    "International Business", "Corporate Governance & CSR", "Project Management", "Tourism & Hospitality",
  ],
  "Economics & Finance": [
    "Microeconomics", "Macroeconomics", "Development Economics", "Econometrics",
    "Banking & Financial Economics", "FinTech", "International Trade", "Public Economics",
    "Behavioural Economics", "Environmental & Energy Economics", "Labour Economics",
  ],
  "Social Sciences": [
    "Sociology", "Political Science & International Relations", "Public Policy & Administration",
    "Communication & Media Studies", "Anthropology", "Gender Studies", "Development Studies",
    "Social Work", "Criminology", "Demography", "Human Geography", "Library & Information Science",
  ],
  "Psychology": [
    "Clinical Psychology", "Cognitive Psychology", "Social Psychology", "Developmental Psychology",
    "Educational Psychology", "Industrial & Organizational Psychology", "Health Psychology",
    "Counselling Psychology", "Neuropsychology",
  ],
  "Law": [
    "Constitutional Law", "Criminal Law", "International Law", "Corporate & Commercial Law",
    "Intellectual Property Law", "Human Rights Law", "Cyber & Technology Law", "Environmental Law",
    "Tax Law", "Legal Theory & Jurisprudence",
  ],
  "Education": [
    "Educational Technology & E-Learning", "Curriculum & Instruction", "Higher Education", "Teacher Education",
    "STEM Education", "Language Education", "Educational Policy & Leadership", "Special & Inclusive Education",
    "Assessment & Evaluation", "Early Childhood Education", "Adult & Lifelong Learning",
  ],

  // ---------- Arts & Humanities ----------
  "Arts & Humanities": [
    "Literature", "Linguistics", "History", "Philosophy & Ethics", "Religious Studies", "Cultural Studies",
    "Visual & Performing Arts", "Music", "Film & Media Arts", "Archaeology", "Languages & Translation",
    "Digital Humanities", "Design",
  ],

  // ---------- Multidisciplinary ----------
  // Only for events with no dominant field — the AI is told to prefer a specific primary.
  "Multidisciplinary": [
    "Science, Technology & Society", "Sustainable Development Goals (SDGs)", "Research Methodology",
    "Interdisciplinary Research", "Other",
  ],
};

/** Names used before this taxonomy (saved drafts, older records) -> today's primary area (the prototype's LEGACY_PRIMARY_AREAS). */
const LEGACY_PRIMARY_AREAS: Record<string, string> = {
  "Environmental Studies": "Environmental & Earth Sciences",
  "Other": "Multidisciplinary",
};
export const normalizeResearchArea = (area: string): string => LEGACY_PRIMARY_AREAS[area] || area;
