enum SegmentationRepresentations {
  Labelmap = 'LABELMAP',
  Contour = 'CONTOUR',
  Surface = 'SURFACE',
}

type LabelmapSegmentationData = {
  volumeId: string;
  referencedVolumeId?: string;
};

type SegmentationRepresentationData = {
  LABELMAP?: LabelmapSegmentationData;
};

type LabelmapConfiguration = {
  renderOutline?: boolean;
  outlineWidthActive?: number;
  outlineWidthInactive?: number;
  activeSegmentOutlineWidthDelta?: number;
  renderFill?: boolean;
  renderFillInactive?: boolean;
  fillAlpha?: number;
  fillAlphaInactive?: number;
  outlineOpacity?: number;
  outlineOpacityInactive?: number;
};

type SegmentationConfiguration = LabelmapConfiguration & {
  renderInactiveSegmentations: boolean;
  brushSize: number;
  brushThresholdGate: number;
};

type Segment = {
  label: string;
  segmentIndex: number;
  color: [number, number, number];
  opacity: number;
  isVisible: boolean;
  isLocked: boolean;
  displayText?: string[];
};

type Segmentation = {
  activeSegmentIndex: number;
  colorLUTIndex: number;
  cachedStats: Record<string, any>;
  displaySetInstanceUID: string;
  displayText?: string[];
  id: string;
  isActive: boolean;
  isVisible: boolean;
  FrameOfReferenceUID: string;
  label: string;
  segmentCount: number;
  segments: Segment[];
  segmentsLocked: number[];
  hydrated: boolean;
  type: SegmentationRepresentations;
  representationData: SegmentationRepresentationData;
};

export type { SegmentationConfiguration, Segment, Segmentation };
