/// <reference types="vite/client" />

declare module 'https://cdn.jsdelivr.net/npm/d3@7/+esm' {
  const content: any;
  export default content;
  // allow namespace attributes
  export const select: any;
  export const forceSimulation: any;
  export const forceLink: any;
  export const forceManyBody: any;
  export const forceCenter: any;
  export const forceCollide: any;
  export const drag: any;
  export const zoom: any;
  export const geoEquirectangular: any;
  export const geoPath: any;
  export const geoGraticule: any;
}

declare module 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm' {
  export const feature: any;
}
