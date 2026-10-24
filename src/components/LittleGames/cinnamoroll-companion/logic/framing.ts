export type FramingInput = {
  aspect: number;
  fovDeg: number;
  /** Subject size in world units, including the ears. */
  width: number;
  height: number;
  /** Largest share of the view the subject may cover in each direction. */
  widthFraction: number;
  heightFraction: number;
};

/**
 * Camera distance that makes the subject as large as allowed: portrait
 * screens run out of width first, wide windows run out of height first.
 */
export function fitCameraDistance(input: FramingInput): number {
  const viewHeightPerUnit = 2 * Math.tan((input.fovDeg * Math.PI) / 360);
  const forWidth =
    input.width / (input.widthFraction * viewHeightPerUnit * input.aspect);
  const forHeight =
    input.height / (input.heightFraction * viewHeightPerUnit);
  return Math.max(forWidth, forHeight);
}
