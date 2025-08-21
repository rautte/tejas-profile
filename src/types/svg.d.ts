// src/types/svg.d.ts
declare module "*.svg" {
  import * as React from "react";
  // SVGR transform: `import { ReactComponent as Icon } from "file.svg"`
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  // url import: `import url from "file.svg"`
  const src: string;
  export default src;
}