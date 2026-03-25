declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

interface NavigatorUAData {
  readonly mobile: boolean;
  readonly platform: string;
}

interface Navigator {
  readonly userAgentData?: NavigatorUAData;
}
