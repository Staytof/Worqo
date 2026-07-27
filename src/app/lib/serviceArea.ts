export type LatLngLiteral = {
  lat: number;
  lng: number;
};

export type MapBoundsLiteral = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export const SERVICE_AREA_MIN_ZOOM = 12;

export const SERVICE_AREA_CENTER = {
  lat: -23.5360294421913,
  lng: -46.32262262240631,
};

export const SUZANO_BOUNDARY_PATH = [
  { lat: -23.7444, lng: -46.3219 },
  { lat: -23.7283, lng: -46.328 },
  { lat: -23.7088, lng: -46.3307 },
  { lat: -23.6775, lng: -46.3386 },
  { lat: -23.6633, lng: -46.3564 },
  { lat: -23.6424, lng: -46.3535 },
  { lat: -23.6441, lng: -46.3722 },
  { lat: -23.6176, lng: -46.3834 },
  { lat: -23.5828, lng: -46.3616 },
  { lat: -23.5735, lng: -46.3499 },
  { lat: -23.5589, lng: -46.3422 },
  { lat: -23.5384, lng: -46.3312 },
  { lat: -23.5057, lng: -46.3298 },
  { lat: -23.4888, lng: -46.331 },
  { lat: -23.4963, lng: -46.2983 },
  { lat: -23.4896, lng: -46.2881 },
  { lat: -23.4881, lng: -46.2654 },
  { lat: -23.5048, lng: -46.2692 },
  { lat: -23.5353, lng: -46.264 },
  { lat: -23.5487, lng: -46.281 },
  { lat: -23.5658, lng: -46.2849 },
  { lat: -23.6119, lng: -46.2589 },
  { lat: -23.631, lng: -46.2643 },
  { lat: -23.6493, lng: -46.2546 },
  { lat: -23.6857, lng: -46.2667 },
  { lat: -23.7048, lng: -46.2978 },
  { lat: -23.7187, lng: -46.2951 },
  { lat: -23.7444, lng: -46.3219 },
] as const;

export const ITAQUAQUECETUBA_BOUNDARY_PATH = [
  { lat: -23.4298, lng: -46.2705 },
  { lat: -23.4501, lng: -46.274 },
  { lat: -23.46, lng: -46.287 },
  { lat: -23.4896, lng: -46.2881 },
  { lat: -23.4963, lng: -46.2983 },
  { lat: -23.4888, lng: -46.331 },
  { lat: -23.5057, lng: -46.3298 },
  { lat: -23.5121, lng: -46.3663 },
  { lat: -23.472, lng: -46.3819 },
  { lat: -23.4746, lng: -46.3866 },
  { lat: -23.4487, lng: -46.3936 },
  { lat: -23.4321, lng: -46.3758 },
  { lat: -23.4372, lng: -46.3584 },
  { lat: -23.4226, lng: -46.3544 },
  { lat: -23.4245, lng: -46.3029 },
  { lat: -23.4352, lng: -46.2846 },
  { lat: -23.4298, lng: -46.2705 },
] as const;

export const SERVICE_AREA_PATHS = [SUZANO_BOUNDARY_PATH, ITAQUAQUECETUBA_BOUNDARY_PATH] as const;
export const SERVICE_AREA_HOLE_PATHS = SERVICE_AREA_PATHS.map((path) => [...path].reverse());

export function getBoundsFromPath(path: readonly LatLngLiteral[]): MapBoundsLiteral {
  return path.reduce(
    (accumulator, point) => ({
      north: Math.max(accumulator.north, point.lat),
      south: Math.min(accumulator.south, point.lat),
      east: Math.max(accumulator.east, point.lng),
      west: Math.min(accumulator.west, point.lng),
    }),
    {
      north: Number.NEGATIVE_INFINITY,
      south: Number.POSITIVE_INFINITY,
      east: Number.NEGATIVE_INFINITY,
      west: Number.POSITIVE_INFINITY,
    }
  );
}

export function mergeBounds(primary: MapBoundsLiteral, secondary: MapBoundsLiteral): MapBoundsLiteral {
  return {
    north: Math.max(primary.north, secondary.north),
    south: Math.min(primary.south, secondary.south),
    east: Math.max(primary.east, secondary.east),
    west: Math.min(primary.west, secondary.west),
  };
}

export function getBoundsFromPaths(paths: readonly (readonly LatLngLiteral[])[]) {
  return paths
    .map((path) => getBoundsFromPath(path))
    .reduce((accumulator, bounds) => mergeBounds(accumulator, bounds));
}

export function getCenterFromBounds(bounds: MapBoundsLiteral) {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

export function isWithinPolygon(path: readonly LatLngLiteral[], point: LatLngLiteral) {
  let isInside = false;

  for (let current = 0, previous = path.length - 1; current < path.length; previous = current++) {
    const currentPoint = path[current];
    const previousPoint = path[previous];
    const intersects =
      currentPoint.lat > point.lat !== previousPoint.lat > point.lat &&
      point.lng <
        ((previousPoint.lng - currentPoint.lng) * (point.lat - currentPoint.lat)) /
          (previousPoint.lat - currentPoint.lat) +
          currentPoint.lng;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export function isWithinServiceArea(point: LatLngLiteral) {
  return SERVICE_AREA_PATHS.some((path) => isWithinPolygon(path, point));
}
