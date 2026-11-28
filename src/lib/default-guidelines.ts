/**
 * The general submission guidelines a conference starts with (Settings › Submissions › Submission Guidelines).
 * The chair can change or clear them; until they save their own, authors see these. The backend keeps the same
 * text (Backend/src/modules/conferences/default-guidelines.ts) for the submission form: keep the two the same.
 */
export const DEFAULT_SUBMISSION_GUIDELINES = [
  "<p>Please read these guidelines before you submit your paper.</p>",
  "<h2>Originality</h2>",
  "<ul><li>Papers must be original work that has not been published, and is not under review, anywhere else.</li>",
  "<li>Papers are checked for plagiarism; a paper with a high similarity score may be rejected without review.</li></ul>",
  "<h2>Format</h2>",
  "<ul><li>Upload the full paper as a PDF.</li>",
  "<li>Use the conference's paper template if one is given, and stay within the page limit.</li>",
  "<li>Include the title, abstract, keywords and references.</li></ul>",
  "<h2>Authors</h2>",
  "<ul><li>Add every author in the order they appear on the paper, each with a working email address.</li>",
  "<li>Give only the institution as the affiliation; the department, city and country have their own fields.</li>",
  "<li>Mark at least one corresponding author: they receive the emails about the paper.</li></ul>",
  "<h2>Review</h2>",
  "<ul><li>Every paper is peer reviewed. Under double-blind review, remove the author names and affiliations from the PDF.</li>",
  "<li>The decision is emailed to the authors.</li></ul>",
  "<h2>After acceptance</h2>",
  "<ul><li>Send the camera-ready version by its deadline, with the reviewers' comments addressed.</li>",
  "<li>At least one author must register for the conference and present the paper.</li></ul>",
].join("");
