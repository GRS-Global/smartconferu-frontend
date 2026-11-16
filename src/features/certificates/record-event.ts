import { getCertificateService } from "@/services/certificates";

/** The person opened or downloaded their own certificate: the chair's tracking ("Opened", "Downloaded") reads it. Never in the person's way. */
export async function recordCertificateEvent(serial: string, kind: "opened" | "downloaded"): Promise<void> {
  try {
    await (await getCertificateService()).recordEvent(serial, kind);
  } catch {
    /* tracking only */
  }
}
