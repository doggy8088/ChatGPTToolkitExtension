export {};

declare global {
  interface MarkmapInstance {
    destroy: () => void;
    fit: () => void;
  }

  interface MarkmapTransformer {
    transform: (input: string) => { root: unknown; features?: unknown };
  }

  interface MarkmapApi {
    Transformer: new () => MarkmapTransformer;
    deriveOptions: (options: unknown) => unknown;
    Markmap: {
      create: (svg: SVGSVGElement, options: unknown, root: unknown) => MarkmapInstance;
    };
  }

  interface Window {
    markmap?: MarkmapApi;
  }

  interface SVGSVGElement {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  }
}
