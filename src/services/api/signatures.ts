import { api } from "@/lib/api-client";
import type { SignatureService } from "../signatures";
import type { SignatureRecord } from "../signatures";

/* The conference's signature library through the own backend (Backend/src/modules/certificates, "Signature library" in ../API.md). */

function form(fields: Record<string, string>, file?: File): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v); // text fields first: the server reads them before the file
  if (file) f.append("file", file);
  return f;
}

export const apiSignatureService: SignatureService = {
  list: (conferenceDbId) => api<SignatureRecord[]>(`/conferences/${conferenceDbId}/certificate-signatures`),
  create: (conferenceDbId, { file, name, designation, institution }) =>
    api<SignatureRecord>(`/conferences/${conferenceDbId}/certificate-signatures`, { method: "POST", body: form({ name, designation, institution }, file) }),
  update: (id, patch) => api<SignatureRecord>(`/certificate-signatures/${id}`, { method: "PATCH", body: patch }),
  replaceImage: (id, file) => api<SignatureRecord>(`/certificate-signatures/${id}/image`, { method: "PUT", body: form({}, file) }),
  remove: async (id, opts) => { await api(`/certificate-signatures/${id}${opts?.removeFromDesigns ? "?removeFromDesigns=true" : ""}`, { method: "DELETE" }); },
};
