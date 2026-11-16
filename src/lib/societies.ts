/* Professional societies a member can pick as a membership (mirrors BASE_SOCIETIES in the prototype's
   src/shared/societies.js, with each society's official logo from /public/societies). A society that isn't here is a
   free-text "Other" entry. The Super Admin's edits to this list (master data) are not applied: that module is on hold. */
export interface Society {
  id: string;
  name: string;
  acronym: string;
  url: string;
  logo: string;
}

export const SOCIETIES: Society[] = [
  {
    "id": "ieee",
    "name": "IEEE",
    "acronym": "IEEE",
    "url": "https://www.ieee.org",
    "logo": "/societies/ieee.svg"
  },
  {
    "id": "ieee-cs",
    "name": "IEEE Computer Society",
    "acronym": "IEEE CS",
    "url": "https://www.computer.org",
    "logo": "/societies/ieee-cs.png"
  },
  {
    "id": "acm",
    "name": "Association for Computing Machinery",
    "acronym": "ACM",
    "url": "https://www.acm.org",
    "logo": "/societies/acm.svg"
  },
  {
    "id": "aaai",
    "name": "Association for the Advancement of Artificial Intelligence",
    "acronym": "AAAI",
    "url": "https://aaai.org",
    "logo": "/societies/aaai.svg"
  },
  {
    "id": "acl",
    "name": "Association for Computational Linguistics",
    "acronym": "ACL",
    "url": "https://www.aclweb.org",
    "logo": "/societies/acl.svg"
  },
  {
    "id": "iet",
    "name": "Institution of Engineering and Technology",
    "acronym": "IET",
    "url": "https://www.theiet.org",
    "logo": "/societies/iet.svg"
  },
  {
    "id": "csi",
    "name": "Computer Society of India",
    "acronym": "CSI",
    "url": "https://www.csi-india.org",
    "logo": "/societies/csi.png"
  },
  {
    "id": "iste",
    "name": "Indian Society for Technical Education",
    "acronym": "ISTE",
    "url": "https://www.isteonline.in",
    "logo": "/societies/iste.png"
  },
  {
    "id": "iete",
    "name": "Institution of Electronics and Telecommunication Engineers",
    "acronym": "IETE",
    "url": "https://www.iete.org",
    "logo": "/societies/iete.jpg"
  },
  {
    "id": "ams",
    "name": "American Mathematical Society",
    "acronym": "AMS",
    "url": "https://www.ams.org",
    "logo": "/societies/ams.svg"
  },
  {
    "id": "cope",
    "name": "Committee on Publication Ethics",
    "acronym": "COPE",
    "url": "https://publicationethics.org",
    "logo": "/societies/cope.svg"
  }
];

/** The societies the profile header always shows, best known first (the prototype's FEATURED_SOCIETY_IDS). */
export const FEATURED_SOCIETY_IDS = ["ieee", "acm", "iet", "aaai"];
export const FEATURED_SOCIETY_COUNT = 3;
