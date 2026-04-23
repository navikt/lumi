declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.css" {
  const css: string;
  export default css;
}

interface NavigatorUAData {
  readonly mobile: boolean;
  readonly platform: string;
}

interface Navigator {
  readonly userAgentData?: NavigatorUAData;
}
