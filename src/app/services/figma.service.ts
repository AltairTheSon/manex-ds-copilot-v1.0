import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import {
  FigmaCredentials,
  FigmaFileResponse,
  FigmaImageResponse,
  ProcessedArtboard,
  DesignToken,
  FigmaApiError,
  FigmaPage,
  LocalStyle,
  FigmaComponent,
  FigmaNode,
  FigmaColor,
  Artboard
} from '../interfaces/figma.interface';

@Injectable({
  providedIn: 'root'
})
export class FigmaService {
  private readonly FIGMA_API_BASE = 'https://api.figma.com/v1';

  constructor(private http: HttpClient) {}

  /**
   * Get file data from Figma API
   */
  getFileData(credentials: FigmaCredentials): Observable<FigmaFileResponse> {
    const headers = this.getHeaders(credentials.accessToken);
    const url = `${this.FIGMA_API_BASE}/files/${credentials.fileId}`;
    
    return this.http.get<FigmaFileResponse>(url, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get file styles from Figma API
   */
  getFileStyles(credentials: FigmaCredentials): Observable<any> {
    const headers = this.getHeaders(credentials.accessToken);
    const url = `${this.FIGMA_API_BASE}/files/${credentials.fileId}/styles`;
    
    return this.http.get<any>(url, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get file components from Figma API
   */
  getFileComponents(credentials: FigmaCredentials): Observable<any> {
    const headers = this.getHeaders(credentials.accessToken);
    const url = `${this.FIGMA_API_BASE}/files/${credentials.fileId}/components`;
    
    return this.http.get<any>(url, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get images from Figma API
   */
  getImages(credentials: FigmaCredentials, nodeIds: string[]): Observable<FigmaImageResponse> {
    const headers = this.getHeaders(credentials.accessToken);
    const ids = nodeIds.join(',');
    const url = `${this.FIGMA_API_BASE}/images/${credentials.fileId}?ids=${ids}&format=png&scale=2`;
    
    return this.http.get<FigmaImageResponse>(url, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Enhanced analysis method
   */
  getEnhancedAnalysis(credentials: FigmaCredentials): Observable<{
    pages: FigmaPage[];
    designTokens: DesignToken[];
    localStyles: LocalStyle[];
    components: FigmaComponent[];
    artboards: ProcessedArtboard[];
    fileInfo: { name: string; lastModified: string; version: string; thumbnailUrl: string };
  }> {
    return forkJoin({
      fileData: this.getFileData(credentials),
      stylesData: this.getFileStyles(credentials),
      componentsData: this.getFileComponents(credentials)
    }).pipe(
      switchMap(({ fileData, stylesData, componentsData }) => {
        const pages = this.extractPages(fileData);
        const designTokens = this.extractDesignTokens(stylesData, fileData);
        const localStyles = this.extractLocalStyles(stylesData, fileData);
        const extractedComponents = this.extractComponents(componentsData, fileData);
        
        const allNodeIds = [
          ...pages.map(p => p.id),
          ...extractedComponents.map(c => c.id || c.key),
          ...this.findAllFrames(fileData)
        ].filter(id => id && id.trim());
        
        if (allNodeIds.length > 0) {
          return this.getImages(credentials, allNodeIds).pipe(
            map(imageResponse => ({
              pages: this.populatePageThumbnails(pages, imageResponse),
              designTokens,
              localStyles,
              components: this.populateComponentThumbnails(extractedComponents, imageResponse),
              artboards: this.extractAllArtboards(fileData, imageResponse),
              fileInfo: this.extractFileInfo(fileData)
            }))
          );
        } else {
          return of({
            pages,
            designTokens,
            localStyles,
            components: extractedComponents,
            artboards: this.extractAllArtboards(fileData, { images: {} }),
            fileInfo: this.extractFileInfo(fileData)
          });
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Fetch page artboards
   */
  fetchPageArtboards(pageId: string, credentials: FigmaCredentials): Observable<Artboard[]> {
    return this.getFileData(credentials).pipe(
      switchMap((fileData: FigmaFileResponse) => {
        const page = this.findPageById(fileData.document, pageId);
        
        if (!page || !page.children) {
          return of([]);
        }

        const frames: Artboard[] = [];
        
        page.children.forEach(child => {
          if (child.type === 'FRAME' && child.absoluteBoundingBox) {
            frames.push({
              id: child.id,
              name: child.name,
              type: 'FRAME',
              thumbnail: '',
              absoluteBoundingBox: {
                x: child.absoluteBoundingBox.x,
                y: child.absoluteBoundingBox.y,
                width: child.absoluteBoundingBox.width,
                height: child.absoluteBoundingBox.height
              }
            });
          }
        });

        if (frames.length > 0) {
          const nodeIds = frames.map(frame => frame.id);
          return this.getImages(credentials, nodeIds).pipe(
            map((imageResponse: FigmaImageResponse) => {
              return frames.map(frame => ({
                ...frame,
                thumbnail: imageResponse.images[frame.id] || ''
              }));
            }),
            catchError(() => of(frames))
          );
        } else {
          return of([]);
        }
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Sync file changes
   */
  syncFileChanges(credentials: FigmaCredentials): Observable<boolean> {
    return this.getFileData(credentials).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // Private helper methods
  private getHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
  }

  private extractPages(fileData: FigmaFileResponse): FigmaPage[] {
    const pages: FigmaPage[] = [];
    
    if (fileData.document.children) {
      fileData.document.children.forEach(page => {
        if (page.type === 'CANVAS') {
          const frameChildren = page.children?.filter(child => child.type === 'FRAME') || [];
          
          pages.push({
            id: page.id,
            name: page.name,
            thumbnail: '',
            children: frameChildren
          });
        }
      });
    }
    
    return pages;
  }

  private extractDesignTokens(stylesData: any, fileData: FigmaFileResponse): DesignToken[] {
    const tokens: DesignToken[] = [];
    
    if (stylesData && stylesData.meta && stylesData.meta.styles) {
      Object.values(stylesData.meta.styles).forEach((style: any) => {
        if (style.style_type === 'FILL') {
          tokens.push({
            type: 'color',
            name: style.name,
            value: this.extractColorValue(style),
            description: style.description || '',
            category: this.categorizeToken(style.name)
          });
        }
      });
    }
    
    return tokens;
  }

  private extractLocalStyles(stylesData: any, fileData: FigmaFileResponse): LocalStyle[] {
    const localStyles: LocalStyle[] = [];
    
    if (stylesData && stylesData.meta && stylesData.meta.styles) {
      Object.values(stylesData.meta.styles).forEach((style: any) => {
        localStyles.push({
          id: style.node_id,
          name: style.name,
          type: style.style_type as 'FILL' | 'TEXT' | 'EFFECT',
          description: style.description || '',
          styleType: style.style_type
        });
      });
    }
    
    return localStyles;
  }

  private extractComponents(componentsData: any, fileData: FigmaFileResponse): FigmaComponent[] {
    const components: FigmaComponent[] = [];
    
    if (componentsData && componentsData.meta && componentsData.meta.components) {
      Object.values(componentsData.meta.components).forEach((component: any) => {
        components.push({
          id: component.node_id,
          key: component.key,
          name: component.name,
          description: component.description || '',
          documentationLinks: [],
          thumbnail: '',
          variants: [],
          properties: []
        });
      });
    }
    
    return components;
  }

  private findAllFrames(fileData: FigmaFileResponse): string[] {
    const frameIds: string[] = [];
    const MAX_FRAMES = 200;
    
    const traverseNode = (node: FigmaNode) => {
      if (frameIds.length >= MAX_FRAMES) {
        return;
      }
      
      if (node.type === 'FRAME' && node.absoluteBoundingBox) {
        frameIds.push(node.id);
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => traverseNode(child));
      }
    };
    
    if (fileData.document?.children) {
      fileData.document.children.forEach(page => traverseNode(page));
    }
    
    return frameIds;
  }

  private populatePageThumbnails(pages: FigmaPage[], imageResponse: any): FigmaPage[] {
    return pages.map(page => ({
      ...page,
      thumbnail: imageResponse.images?.[page.id] || ''
    }));
  }

  private populateComponentThumbnails(components: FigmaComponent[], imageResponse: any): FigmaComponent[] {
    return components.map(component => ({
      ...component,
      thumbnail: imageResponse.images?.[component.id || component.key] || ''
    }));
  }

  private extractAllArtboards(fileData: FigmaFileResponse, imageResponse: any): ProcessedArtboard[] {
    const artboards: ProcessedArtboard[] = [];
    
    const traverseNode = (node: FigmaNode) => {
      if (node.type === 'FRAME' && node.absoluteBoundingBox) {
        artboards.push({
          id: node.id,
          name: node.name,
          imageUrl: imageResponse.images?.[node.id] || '',
          width: node.absoluteBoundingBox.width,
          height: node.absoluteBoundingBox.height,
          backgroundColor: this.extractBackgroundColor(node)
        });
      }
      
      if (node.children) {
        node.children.forEach(child => traverseNode(child));
      }
    };
    
    if (fileData.document?.children) {
      fileData.document.children.forEach(page => traverseNode(page));
    }
    
    return artboards;
  }

  private extractFileInfo(fileData: FigmaFileResponse): any {
    return {
      name: fileData.name || 'Untitled',
      lastModified: fileData.lastModified || new Date().toISOString(),
      version: fileData.version || '1.0',
      thumbnailUrl: fileData.thumbnailUrl || ''
    };
  }

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

  private categorizeToken(tokenName: string): string {
    const name = tokenName.toLowerCase();
    if (name.includes('color') || name.includes('background')) {
      return 'colors';
    }
    if (name.includes('font') || name.includes('text')) {
      return 'typography';
    }
    if (name.includes('shadow') || name.includes('elevation')) {
      return 'effects';
    }
    return 'other';
  }

  private extractColorValue(style: any): string {
    if (style.fills && Array.isArray(style.fills) && style.fills.length > 0) {
      const fill = style.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        const r = Math.round(fill.color.r * 255);
        const g = Math.round(fill.color.g * 255);
        const b = Math.round(fill.color.b * 255);
        const a = fill.color.a || 1;
        return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
      }
    }
    return '#000000';
  }

  private extractBackgroundColor(node: FigmaNode): string | undefined {
    if (node.backgroundColor) {
      return `rgb(${Math.round(node.backgroundColor.r * 255)}, ${Math.round(node.backgroundColor.g * 255)}, ${Math.round(node.backgroundColor.b * 255)})`;
    }
    return undefined;
  }

  private handleError = (error: any): Observable<never> => {
    console.error('Figma API Error:', error);
    const apiError: FigmaApiError = {
      message: error.message || 'An error occurred while connecting to Figma API',
      status: error.status || 0
    };
    return throwError(() => apiError);
  };
}