import { api } from "@/lib/api-client";
import type { AssetRecord, AssetService } from "../assets";

/* The picture library through the own backend (Backend/src/modules/certificates, "Picture library" in ../API.md). */

function form(file: File, name?: string): FormData {
  const f = new FormData();
  if (name) f.append("name", name); // text fields first: the server reads them before the file
  f.append("file", file);
  return f;
}

export const apiAssetService: AssetService = {
  list: (conferenceDbId) => api<AssetRecord[]>(`/conferences/${conferenceDbId}/certificate-assets`),
  create: (conferenceDbId, { file, name }) => api<AssetRecord>(`/conferences/${conferenceDbId}/certificate-assets`, { method: "POST", body: form(file, name) }),
  rename: (id, name) => api<AssetRecord>(`/certificate-assets/${id}`, { method: "PATCH", body: { name } }),
  replaceImage: (id, file) => api<AssetRecord>(`/certificate-assets/${id}/image`, { method: "PUT", body: form(file) }),
  remove: async (id, opts) => { await api(`/certificate-assets/${id}${opts?.removeFromDesigns ? "?removeFromDesigns=true" : ""}`, { method: "DELETE" }); },
};
