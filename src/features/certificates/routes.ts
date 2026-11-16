/* Where the module's pages live. The prototype moves between them with page names (setPage("chair-certificate-design", { certId })); the pages here keep
   calling `go` the same way and this maps each name to a route of this app. */
export type CertPage = "chair-certificates" | "chair-certificate-design" | "chair-certificates-distribute" | "chair-certificate-recipients";
export interface CertCtx { certId?: string; distId?: string }
export type Go = (page: CertPage, ctx?: CertCtx) => void;

const e = encodeURIComponent;

export function certificatePath(slug: string, page: CertPage, ctx: CertCtx = {}): string {
  const base = `/chair/${e(slug)}/certificates`;
  switch (page) {
    case "chair-certificates": return base;
    case "chair-certificate-design": return ctx.certId ? `${base}/design/${e(ctx.certId)}` : base;
    case "chair-certificates-distribute": return ctx.certId ? `${base}/distribute?cert=${e(ctx.certId)}` : `${base}/distribute`;
    case "chair-certificate-recipients": return ctx.distId ? `${base}/distribute/${e(ctx.distId)}` : `${base}/distribute`;
  }
}
