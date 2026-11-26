import { API_URL } from "@/lib/config";

/** For the static marketing home page (public/home/index.html): the API address its nav script asks for the visitor's session. */
export function GET() {
  return Response.json({ api: API_URL });
}
