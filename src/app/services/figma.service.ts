import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  FigmaCredentials,
  FigmaFileResponse,
  FigmaImageResponse,
  FigmaNode,
  ProcessedArtboard,
  DesignToken,
  FigmaApiError,
  FigmaColor,
  FigmaFill,
  FigmaPage,
  LocalStyle,
  FigmaComponent,
  FigmaFileData,
  Artboard
} from '../interfaces/figma.interface';

@Injectable({
  providedIn: 'root'
})
export class FigmaService {
  private readonly FIGMA_API_BASE = 'https://api.figma.com/v1';

  constructor(private http: HttpClient) {}

  /**
   * Get Figma file data including all frames and design information
   */
  getFileData(credentials: FigmaCredentials): Observable<FigmaFileResponse> {
    const headers = this.getHeaders(credentials.accessToken);
    
    return this.http.get<FigmaFileResponse>(
      `${this.FIGMA_API_BASE}/files/${credentials.fileId}`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get image URLs for specific node IDs
   */
  getImages(credentials: FigmaCredentials, nodeIds: string[]): Observable<FigmaImageResponse> {
    const headers = this.getHeaders(credentials.accessToken);
    const ids = nodeIds.join(',');
    
    return this.http.get<FigmaImageResponse>(
      `${this.FIGMA_API_BASE}/images/${credentials.fileId}?ids=${ids}&format=png&scale=2`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Process Figma file and return artboards with images
   */
  getArtboardsWithImages(credentials: FigmaCredentials): Observable<ProcessedArtboard[]> {
    return this.getFileData(credentials).pipe(
      switchMap((fileData: FigmaFileResponse) => {
        const artboards = this.extractArtboards(fileData.document);
        const nodeIds = artboards.map(artboard => artboard.id);
        
        if (nodeIds.length === 0) {
          return throwError(() => new Error('No artboards found in the Figma file'));
        }

        return this.getImages(credentials, nodeIds).pipe(
          map((imageResponse: FigmaImageResponse) => {
            return artboards.map(artboard => ({
              ...artboard,
              imageUrl: imageResponse.images[artboard.id] || ''
            }));
          })
        );
      })
    );
  }

  /**
   * Extract design tokens from Figma file
   */
  extractDesignTokens(credentials: FigmaCredentials): Observable<DesignToken[]> {
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const tokens: DesignToken[] = [];
        
        // Extract color tokens from styles
        Object.values(fileData.styles).forEach(style => {
          if (style.styleType === 'FILL') {
            tokens.push({
              type: 'color',
              name: style.name,
              value: this.extractColorValue(style),
              description: style.description,
              category: 'colors'
            });
          } else if (style.styleType === 'TEXT') {
            tokens.push({
              type: 'typography',
              name: style.name,
              value: this.extractTextValue(style),
              description: style.description,
              category: 'typography'
            });
          } else if (style.styleType === 'EFFECT') {
            tokens.push({
              type: 'shadow',
              name: style.name,
              value: this.extractEffectValue(style),
              description: style.description,
              category: 'effects'
            });
          }
        });

        // Extract additional tokens from document nodes
        this.extractTokensFromNodes(fileData.document, tokens);
        
        return tokens;
      })
    );
  }

  /**
   * Complete analysis: get both artboards and design tokens
   */
  getCompleteAnalysis(credentials: FigmaCredentials): Observable<{
    artboards: ProcessedArtboard[];
    designTokens: DesignToken[];
    fileInfo: { name: string; lastModified: string; version: string };
  }> {
    return forkJoin({
      artboards: this.getArtboardsWithImages(credentials),
      fileData: this.getFileData(credentials)
    }).pipe(
      map(({ artboards, fileData }) => ({
        artboards,
        designTokens: this.extractDesignTokensFromFileData(fileData),
        fileInfo: {
          name: fileData.name,
          lastModified: fileData.lastModified,
          version: fileData.version
        }
      }))
    );
  }

  /**
   * Fetch pages from Figma file
   */
  fetchPages(credentials: FigmaCredentials): Observable<FigmaPage[]> {
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const pages: FigmaPage[] = [];
        
        if (fileData.document.children) {
          fileData.document.children.forEach(page => {
            if (page.type === 'CANVAS') {
              pages.push({
                id: page.id,
                name: page.name,
                thumbnail: '', // Will be populated with image API
                children: page.children || []
              });
            }
          });
        }
        
        return pages;
      })
    );
  }

  /**
   * Fetch artboards for a specific page
   */
  fetchPageArtboards(pageId: string, credentials: FigmaCredentials): Observable<Artboard[]> {
    return this.getFileData(credentials).pipe(
      switchMap((fileData: FigmaFileResponse) => {
        const page = this.findPageById(fileData.document, pageId);
        
        if (!page || !page.children) {
          return throwError(() => new Error('Page not found or has no children'));
        }

        const artboards: Artboard[] = [];
        
        // Extract artboards (FRAME type nodes) from the page
        page.children.forEach(child => {
          if (child.type === 'FRAME' && child.absoluteBoundingBox) {
            artboards.push({
              id: child.id,
              name: child.name,
              type: 'FRAME',
              thumbnail: '', // Will be populated with image API
              absoluteBoundingBox: {
                x: child.absoluteBoundingBox.x,
                y: child.absoluteBoundingBox.y,
                width: child.absoluteBoundingBox.width,
                height: child.absoluteBoundingBox.height
              }
            });
          }
        });

        // Get thumbnails for the artboards
        if (artboards.length > 0) {
          const nodeIds = artboards.map(artboard => artboard.id);
          return this.getImages(credentials, nodeIds).pipe(
            map((imageResponse: FigmaImageResponse) => {
              return artboards.map(artboard => ({
                ...artboard,
                thumbnail: imageResponse.images[artboard.id] || ''
              }));
            })
          );
        } else {
          return [artboards];
        }
      })
    );
  }

  /**
   * Find a page by ID in the document tree
   */
  private findPageById(node: FigmaNode, pageId: string): FigmaNode | null {
    if (node.id === pageId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findPageById(child, pageId);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }

  /**
   * Fetch local styles from Figma file
   */
  fetchLocalStyles(credentials: FigmaCredentials): Observable<LocalStyle[]> {
    // Use main file endpoint to get actual style data with values
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const localStyles: LocalStyle[] = [];
        
        // Extract styles from the main file data which contains actual values
        if (fileData.styles) {
          Object.values(fileData.styles).forEach((style: any) => {
            localStyles.push({
              id: style.key,
              name: style.name,
              type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
              description: style.description || '',
              styleType: style.styleType
            });
          });
        }
        
        return localStyles;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Fetch components from Figma file
   */
  fetchComponents(credentials: FigmaCredentials): Observable<FigmaComponent[]> {
    return forkJoin({
      fileData: this.getFileData(credentials),
      componentsApi: this.getComponentsFromAPI(credentials)
    }).pipe(
      map(({ fileData, componentsApi }) => {
        const components: FigmaComponent[] = [];
        
        // First, add components from the dedicated API endpoint
        components.push(...componentsApi);
        
        // Then, parse the file structure to find additional components
        const nodeComponents = this.extractComponentsFromNodes(fileData.document);
        
        // Merge components, avoiding duplicates
        nodeComponents.forEach(nodeComponent => {
          const existingComponent = components.find(c => c.key === nodeComponent.key);
          if (!existingComponent) {
            components.push(nodeComponent);
          }
        });
        
        return components;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get components from the dedicated API endpoint
   */
  private getComponentsFromAPI(credentials: FigmaCredentials): Observable<FigmaComponent[]> {
    const headers = this.getHeaders(credentials.accessToken);
    
    return this.http.get<any>(
      `${this.FIGMA_API_BASE}/files/${credentials.fileId}/components`,
      { headers }
    ).pipe(
      map((componentsResponse: any) => {
        const components: FigmaComponent[] = [];
        
        if (componentsResponse.meta && componentsResponse.meta.components) {
          Object.values(componentsResponse.meta.components).forEach((component: any) => {
            components.push({
              key: component.key,
              name: component.name,
              description: component.description || '',
              documentationLinks: component.documentation_links || [],
              id: component.key,
              thumbnail: '', // Will be populated with image API
              variants: [],
              properties: []
            });
          });
        }
        
        return components;
      }),
      catchError(() => {
        // If the components API fails, return empty array
        // We'll still get components from file parsing
        return [];
      })
    );
  }

  /**
   * Extract components from file nodes by detecting COMPONENT and COMPONENT_SET types
   */
  private extractComponentsFromNodes(node: FigmaNode): FigmaComponent[] {
    const components: FigmaComponent[] = [];

    const traverse = (currentNode: FigmaNode) => {
      // Check if node is a component or component set
      if (currentNode.type === 'COMPONENT' || currentNode.type === 'COMPONENT_SET') {
        components.push({
          key: currentNode.id,
          name: currentNode.name,
          description: '', // Node description not typically available in file API
          documentationLinks: [],
          id: currentNode.id,
          thumbnail: '', // Will be populated with image API
          variants: currentNode.type === 'COMPONENT_SET' ? [] : undefined,
          properties: []
        });
      }

      // Traverse children
      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    traverse(node);
    return components;
  }

  /**
   * Store Figma data in localStorage
   */
  storeLocalData(data: FigmaFileData): void {
    try {
      localStorage.setItem('figma-file-data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to store Figma data:', error);
    }
  }

  /**
   * Get stored Figma data from localStorage
   */
  getStoredData(): FigmaFileData | null {
    try {
      const data = localStorage.getItem('figma-file-data');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to retrieve stored Figma data:', error);
      return null;
    }
  }

  /**
   * Sync file changes with stored data
   */
  syncFileChanges(credentials: FigmaCredentials): Observable<boolean> {
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const storedData = this.getStoredData();
        
        if (!storedData) {
          return true; // No stored data, consider as changed
        }
        
        // Compare file version
        return storedData.fileVersion !== fileData.version;
      }),
      catchError(() => {
        console.error('Failed to sync file changes');
        return [false];
      })
    );
  }

  /**
   * Get complete enhanced analysis with all new features
   */
  getEnhancedAnalysis(credentials: FigmaCredentials): Observable<{
    pages: FigmaPage[];
    designTokens: DesignToken[];
    localStyles: LocalStyle[];
    components: FigmaComponent[];
    artboards: ProcessedArtboard[];
    fileInfo: { name: string; lastModified: string; version: string };
  }> {
    return forkJoin({
      pages: this.fetchPages(credentials),
      localStyles: this.fetchLocalStyles(credentials),
      components: this.fetchComponents(credentials),
      artboards: this.getArtboardsWithImages(credentials),
      fileData: this.getFileData(credentials)
    }).pipe(
      map(({ pages, localStyles, components, artboards, fileData }) => ({
        pages,
        localStyles,
        components,
        artboards,
        designTokens: this.extractDesignTokensFromFileData(fileData),
        fileInfo: {
          name: fileData.name,
          lastModified: fileData.lastModified,
          version: fileData.version
        }
      }))
    );
  }

  /**
   * Extract artboards (FRAME type nodes) from document
   */
  private extractArtboards(node: FigmaNode): ProcessedArtboard[] {
    const artboards: ProcessedArtboard[] = [];

    const traverse = (currentNode: FigmaNode) => {
      if (currentNode.type === 'FRAME' && currentNode.absoluteBoundingBox) {
        artboards.push({
          id: currentNode.id,
          name: currentNode.name,
          imageUrl: '', // Will be filled later
          width: currentNode.absoluteBoundingBox.width,
          height: currentNode.absoluteBoundingBox.height,
          backgroundColor: this.extractBackgroundColor(currentNode)
        });
      }

      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    traverse(node);
    return artboards;
  }

  /**
   * Extract design tokens from file data
   */
  private extractDesignTokensFromFileData(fileData: FigmaFileResponse): DesignToken[] {
    const tokens: DesignToken[] = [];
    
    // Process styles with proper value extraction
    Object.values(fileData.styles).forEach(style => {
      if (style.styleType === 'FILL') {
        tokens.push({
          type: 'color',
          name: style.name,
          value: this.extractColorValue(style),
          description: style.description,
          category: 'colors'
        });
      } else if (style.styleType === 'TEXT') {
        tokens.push({
          type: 'typography',
          name: style.name,
          value: this.extractTextValue(style),
          description: style.description,
          category: 'typography'
        });
      } else if (style.styleType === 'EFFECT') {
        tokens.push({
          type: 'shadow',
          name: style.name,
          value: this.extractEffectValue(style),
          description: style.description,
          category: 'effects'
        });
      }
    });

    // Extract tokens from document nodes
    this.extractTokensFromNodes(fileData.document, tokens);
    
    return tokens;
  }

  /**
   * Extract tokens from document nodes
   */
  private extractTokensFromNodes(node: FigmaNode, tokens: DesignToken[]) {
    const uniqueFonts = new Set<string>();

    const traverse = (currentNode: FigmaNode) => {
      // Extract typography information
      if (currentNode.style && currentNode.style.fontFamily) {
        const fontKey = `${currentNode.style.fontFamily}-${currentNode.style.fontSize}`;
        if (!uniqueFonts.has(fontKey)) {
          uniqueFonts.add(fontKey);
          tokens.push({
            type: 'typography',
            name: `${currentNode.style.fontFamily} ${currentNode.style.fontSize}px`,
            value: `font-family: ${currentNode.style.fontFamily}; font-size: ${currentNode.style.fontSize}px; font-weight: ${currentNode.style.fontWeight};`,
            category: 'typography'
          });
        }
      }

      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    traverse(node);
  }

  /**
   * Extract background color from a node
   */
  private extractBackgroundColor(node: FigmaNode): string | undefined {
    if (node.backgroundColor) {
      return this.rgbaToHex(node.backgroundColor);
    }
    
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    
    return undefined;
  }

  /**
   * Convert RGBA color to hex
   */
  private rgbaToHex(color: FigmaColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Extract color value from style
   */
  private extractColorValue(style: any): string {
    // For FILL styles, the fill data is in the style object
    if (style.fills && style.fills.length > 0) {
      const fill = style.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    // Sometimes the color might be directly on the style
    if (style.color) {
      return this.rgbaToHex(style.color);
    }
    return '#000000'; // fallback
  }

  /**
   * Extract text value from style
   */
  private extractTextValue(style: any): string {
    // For TEXT styles, the typography data is directly in the style object
    if (style.fontFamily || style.fontSize || style.fontWeight) {
      const fontFamily = style.fontFamily || 'Arial';
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 400;
      const lineHeight = style.lineHeightPx ? `${style.lineHeightPx}px` : 'normal';
      return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight}; line-height: ${lineHeight};`;
    }
    // Sometimes text styles might be nested in a style property
    if (style.style) {
      return this.extractTextValue(style.style);
    }
    return 'font-family: Arial; font-size: 16px;'; // fallback
  }

  /**
   * Extract effect value from style
   */
  private extractEffectValue(style: any): string {
    if (style.effects && style.effects.length > 0) {
      const effect = style.effects[0];
      if (effect.type === 'DROP_SHADOW' && effect.offset && effect.color) {
        const x = effect.offset.x || 0;
        const y = effect.offset.y || 0;
        const blur = effect.radius || 4;
        const color = this.rgbaToHex(effect.color);
        return `box-shadow: ${x}px ${y}px ${blur}px ${color};`;
      }
    }
    return 'box-shadow: 0 2px 4px rgba(0,0,0,0.1);'; // fallback
  }

  /**
   * Convert RGB to hex (helper function)
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Create HTTP headers with authorization
   */
  private getHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({
      'X-Figma-Token': accessToken,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    let errorMessage = 'An error occurred while connecting to Figma';
    
    if (error.status === 401) {
      errorMessage = 'Invalid access token. Please check your Figma access token.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied. Please ensure you have permission to access this file.';
    } else if (error.status === 404) {
      errorMessage = 'File not found. Please check your Figma file ID.';
    } else if (error.error && error.error.message) {
      errorMessage = error.error.message;
    }

    const figmaError: FigmaApiError = {
      message: errorMessage,
      status: error.status || 0
    };

    return throwError(() => figmaError);
  };
}