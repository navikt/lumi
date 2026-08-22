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
