export interface FigmaCredentials {
  accessToken: string;
  fileId: string;
}

export interface MCPCredentials {
  serverUrl: string;
  apiKey?: string;
  projectId: string;
}

export interface StoredConnection {
  connectionType: 'figma' | 'mcp';
  credentials: FigmaCredentials | MCPCredentials;
  fileInfo: { name: string; lastModified: string; version: string };
  lastConnected: string;
  isValid: boolean;
}

export interface ConnectionOptions {
  figma: FigmaCredentials;
  mcp: MCPCredentials;
}

export interface ConnectionRequest {
  connectionType: 'figma' | 'mcp';
  credentials: FigmaCredentials | MCPCredentials;
}

export interface FigmaFileResponse {
  document: FigmaNode;
  components: { [key: string]: FigmaComponent };
  styles: { [key: string]: FigmaStyle };
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  backgroundColor?: FigmaColor;
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  effects?: FigmaEffect[];
  constraints?: FigmaConstraints;
  absoluteBoundingBox?: FigmaRectangle;
  size?: FigmaVector;
  relativeTransform?: number[][];
  characters?: string;
  style?: FigmaTextStyle;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  documentationLinks: FigmaDocumentationLink[];
  id?: string;
  thumbnail?: string | null;
  variants?: ComponentVariant[];
  properties?: ComponentProperty[];
}

export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE';
  color?: FigmaColor;
  gradientStops?: FigmaGradientStop[];
  opacity?: number;
}

export interface FigmaStroke {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE';
  color?: FigmaColor;
  opacity?: number;
}

export interface FigmaEffect {
  type: 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius: number;
  color?: FigmaColor;
  blendMode?: string;
  offset?: FigmaVector;
}

export interface FigmaGradientStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

export interface FigmaRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaVector {
  x: number;
  y: number;
}

export interface FigmaTextStyle {
  fontFamily: string;
  fontPostScriptName: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPx: number;
  letterSpacing: number;
  textAlignHorizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
}

export interface FigmaDocumentationLink {
  uri: string;
}

export interface FigmaImageResponse {
  images: { [key: string]: string };
}

export interface ProcessedArtboard {
  id: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface DesignToken {
  type: 'color' | 'typography' | 'spacing' | 'shadow' | 'border';
  name: string;
  value: string;
  description?: string;
  category?: string;
}

export interface FigmaApiError {
  message: string;
  status: number;
}

// Enhanced interfaces for the new features
export interface FigmaFileData {
  pages: FigmaPage[];
  designTokens: DesignToken[];
  localStyles: LocalStyle[];
  components: FigmaComponent[];
  variants: ComponentVariant[];
  lastSynced: string;
  fileVersion: string;
}

export interface FigmaPage {
  id: string;
  name: string;
  thumbnail: string | null;
  children?: FigmaNode[];
}

export interface LocalStyle {
  id: string;
  name: string;
  type: 'FILL' | 'TEXT' | 'EFFECT';
  description: string;
  styleType: string;
}

export interface ComponentVariant {
  id: string;
  name: string;
  description?: string;
  properties: ComponentProperty[];
}

export interface ComponentProperty {
  name: string;
  type: 'VARIANT' | 'TEXT' | 'BOOLEAN' | 'INSTANCE_SWAP';
  defaultValue?: string;
  variantOptions?: string[];
}

export interface Artboard {
  id: string;
  name: string;
  type: 'FRAME';
  thumbnail: string | null;
  absoluteBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}