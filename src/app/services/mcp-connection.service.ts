import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  MCPCredentials, 
  FigmaFileResponse, 
  ProcessedArtboard, 
  DesignToken, 
  FigmaPage, 
  LocalStyle, 
  FigmaComponent 
} from '../interfaces/figma.interface';

export interface MCPFileResponse {
  document: any;
  components: { [key: string]: any };
  styles: { [key: string]: any };
  name: string;
  lastModified: string;
  version: string;
}

@Injectable({
  providedIn: 'root'
})
export class MCPConnectionService {
  
  constructor(private http: HttpClient) {}

  /**
   * Connect to MCP server and validate credentials
   */
  validateConnection(credentials: MCPCredentials): Observable<boolean> {
    console.log(`MCPConnectionService: Making API call to validate MCP connection to ${credentials.serverUrl}`);
    const headers = this.getHeaders(credentials);
    
    return this.http.get(`${credentials.serverUrl}/health`, { headers }).pipe(
      map(() => {
        console.log('MCPConnectionService: Successfully validated MCP connection');
        return true;
      }),
      catchError((error) => {
        console.error('MCPConnectionService: MCP connection validation failed:', error);
        return throwError(() => ({ 
          message: 'Failed to connect to MCP server',
          status: error.status || 0
        }));
      })
    );
  }

  /**
   * Get file data from MCP server
   */
  getFileData(credentials: MCPCredentials): Observable<MCPFileResponse> {
    console.log(`MCPConnectionService: Making API call to get file data for project ${credentials.projectId} from MCP server`);
    const headers = this.getHeaders(credentials);
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response: MCPFileResponse) => {
        console.log(`MCPConnectionService: Successfully retrieved file data for "${response.name}" from MCP server`);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get enhanced analysis compatible with Figma service interface
   */
  getEnhancedAnalysis(credentials: MCPCredentials): Observable<{
    pages: FigmaPage[];
    designTokens: DesignToken[];
    localStyles: LocalStyle[];
    components: FigmaComponent[];
    artboards: ProcessedArtboard[];
    fileInfo: { name: string; lastModified: string; version: string };
  }> {
    return this.getFileData(credentials).pipe(
      map((mcpData) => this.convertMCPToFigmaFormat(mcpData)),
      catchError(this.handleError)
    );
  }

  /**
   * Convert MCP response format to Figma-compatible format
   */
  private convertMCPToFigmaFormat(mcpData: MCPFileResponse): {
    pages: FigmaPage[];
    designTokens: DesignToken[];
    localStyles: LocalStyle[];
    components: FigmaComponent[];
    artboards: ProcessedArtboard[];
    fileInfo: { name: string; lastModified: string; version: string };
  } {
    console.log('MCPConnectionService: Converting MCP data to Figma-compatible format');
    
    return {
      pages: this.extractPagesFromMCP(mcpData),
      designTokens: this.extractDesignTokensFromMCP(mcpData),
      localStyles: this.extractLocalStylesFromMCP(mcpData),
      components: this.extractComponentsFromMCP(mcpData),
      artboards: this.extractArtboardsFromMCP(mcpData),
      fileInfo: {
        name: mcpData.name,
        lastModified: mcpData.lastModified,
        version: mcpData.version
      }
    };
  }

  /**
   * Extract pages from MCP data
   */
  private extractPagesFromMCP(mcpData: MCPFileResponse): FigmaPage[] {
    console.log('MCPConnectionService: Extracting pages from MCP data');
    
    if (!mcpData || !mcpData.document) {
      throw new Error('MCP page extraction is not supported: Missing document structure in MCP response');
    }
    
    try {
      const pages: FigmaPage[] = [];
      
      // Attempt to parse MCP document structure similar to Figma
      if (mcpData.document.children && Array.isArray(mcpData.document.children)) {
        mcpData.document.children.forEach((child: any) => {
          if (child.type === 'CANVAS' || child.type === 'PAGE') {
            pages.push({
              id: child.id || `mcp-page-${Math.random().toString(36).substr(2, 9)}`,
              name: child.name || 'Unnamed MCP Page',
              thumbnail: '', // MCP does not support thumbnails - would need separate implementation
              children: child.children || []
            });
          }
        });
      }
      
      if (pages.length === 0) {
        throw new Error('MCP page extraction is not supported: No page-like structures found in MCP document');
      }
      
      console.log(`MCPConnectionService: Successfully extracted ${pages.length} pages from MCP data`);
      return pages;
      
    } catch (error) {
      console.error('MCPConnectionService: Failed to extract pages from MCP data:', error);
      throw new Error(`MCP page extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    console.log('MCPConnectionService: Extracting design tokens from MCP data');
    
    if (!mcpData) {
      throw new Error('MCP design token extraction is not supported: Missing MCP data');
    }
    
    try {
      const tokens: DesignToken[] = [];
      
      // Attempt to parse MCP styles structure
      if (mcpData.styles && typeof mcpData.styles === 'object') {
        Object.values(mcpData.styles).forEach((style: any) => {
          if (style.styleType === 'FILL' && style.name) {
            tokens.push({
              type: 'color',
              name: style.name,
              value: this.extractColorFromMCPStyle(style),
              description: style.description || '',
              category: 'colors'
            });
          } else if (style.styleType === 'TEXT' && style.name) {
            tokens.push({
              type: 'typography',
              name: style.name,
              value: this.extractTextFromMCPStyle(style),
              description: style.description || '',
              category: 'typography'
            });
          }
        });
      }
      
      if (tokens.length === 0) {
        throw new Error('MCP design token extraction is not supported: No valid styles found in MCP data');
      }
      
      console.log(`MCPConnectionService: Successfully extracted ${tokens.length} design tokens from MCP data`);
      return tokens;
      
    } catch (error) {
      console.error('MCPConnectionService: Failed to extract design tokens from MCP data:', error);
      throw new Error(`MCP design token extraction failed: ${(error as Error).message}`);
    }
  }
  
  private extractColorFromMCPStyle(style: any): string {
    // Attempt to extract color value from MCP style format
    if (style.color) {
      return this.convertMCPColorToHex(style.color);
    }
    if (style.fills && Array.isArray(style.fills) && style.fills[0]) {
      return this.convertMCPColorToHex(style.fills[0].color);
    }
    throw new Error('Unable to extract color value from MCP style');
  }
  
  private extractTextFromMCPStyle(style: any): string {
    // Attempt to extract text style from MCP format
    const fontFamily = style.fontFamily || style.font?.family || 'Arial';
    const fontSize = style.fontSize || style.font?.size || 16;
    const fontWeight = style.fontWeight || style.font?.weight || 400;
    return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight};`;
  }
  
  private convertMCPColorToHex(color: any): string {
    if (typeof color === 'string' && color.startsWith('#')) {
      return color;
    }
    if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
      const r = Math.round((color.r || 0) * 255);
      const g = Math.round((color.g || 0) * 255);
      const b = Math.round((color.b || 0) * 255);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    throw new Error('Unable to convert MCP color to hex format');
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    console.log('MCPConnectionService: Extracting local styles from MCP data');
    
    if (!mcpData || !mcpData.styles) {
      throw new Error('MCP local styles extraction is not supported: Missing styles in MCP data');
    }
    
    try {
      const localStyles: LocalStyle[] = [];
      
      if (typeof mcpData.styles === 'object') {
        Object.entries(mcpData.styles).forEach(([key, style]: [string, any]) => {
          if (style.name && style.styleType) {
            localStyles.push({
              id: key,
              name: style.name,
              type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
              description: style.description || '',
              styleType: style.styleType
            });
          }
        });
      }
      
      if (localStyles.length === 0) {
        throw new Error('MCP local styles extraction is not supported: No valid local styles found in MCP data');
      }
      
      console.log(`MCPConnectionService: Successfully extracted ${localStyles.length} local styles from MCP data`);
      return localStyles;
      
    } catch (error) {
      console.error('MCPConnectionService: Failed to extract local styles from MCP data:', error);
      throw new Error(`MCP local styles extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    console.log('MCPConnectionService: Extracting components from MCP data');
    
    if (!mcpData || !mcpData.components) {
      throw new Error('MCP components extraction is not supported: Missing components in MCP data');
    }
    
    try {
      const components: FigmaComponent[] = [];
      
      if (typeof mcpData.components === 'object') {
        Object.entries(mcpData.components).forEach(([key, component]: [string, any]) => {
          if (component.name) {
            components.push({
              key: key,
              name: component.name,
              description: component.description || '',
              documentationLinks: component.documentationLinks || [],
              id: key,
              thumbnail: '', // MCP does not support component thumbnails
              variants: component.variants || [],
              properties: component.properties || []
            });
          }
        });
      }
      
      if (components.length === 0) {
        throw new Error('MCP components extraction is not supported: No valid components found in MCP data');
      }
      
      console.log(`MCPConnectionService: Successfully extracted ${components.length} components from MCP data`);
      return components;
      
    } catch (error) {
      console.error('MCPConnectionService: Failed to extract components from MCP data:', error);
      throw new Error(`MCP components extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    console.log('MCPConnectionService: Extracting artboards from MCP data');
    
    if (!mcpData || !mcpData.document) {
      throw new Error('MCP artboards extraction is not supported: Missing document structure in MCP data');
    }
    
    try {
      const artboards: ProcessedArtboard[] = [];
      
      // Recursively search for frame-like structures in MCP document
      const extractFramesFromNode = (node: any): void => {
        if (node.type === 'FRAME' && node.absoluteBoundingBox) {
          artboards.push({
            id: node.id || `mcp-artboard-${Math.random().toString(36).substr(2, 9)}`,
            name: node.name || 'Unnamed MCP Artboard',
            imageUrl: '', // MCP does not support artboard images
            width: node.absoluteBoundingBox.width || 0,
            height: node.absoluteBoundingBox.height || 0,
            backgroundColor: node.backgroundColor ? this.convertMCPColorToHex(node.backgroundColor) : undefined
          });
        }
        
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach((child: any) => extractFramesFromNode(child));
        }
      };
      
      extractFramesFromNode(mcpData.document);
      
      if (artboards.length === 0) {
        throw new Error('MCP artboards extraction is not supported: No frame-like structures found in MCP document');
      }
      
      console.log(`MCPConnectionService: Successfully extracted ${artboards.length} artboards from MCP data`);
      return artboards;
      
    } catch (error) {
      console.error('MCPConnectionService: Failed to extract artboards from MCP data:', error);
      throw new Error(`MCP artboards extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Sync file changes with MCP server
   */
  syncFileChanges(credentials: MCPCredentials): Observable<boolean> {
    console.log(`MCPConnectionService: Making API call to sync file changes for project ${credentials.projectId} from MCP server`);
    const headers = this.getHeaders(credentials);
    
    return this.http.get(`${credentials.serverUrl}/projects/${credentials.projectId}/changes`, { headers }).pipe(
      map((response: any) => {
        const hasChanges = response.hasChanges || false;
        console.log(`MCPConnectionService: File sync check completed - hasChanges: ${hasChanges}`);
        return hasChanges;
      }),
      catchError(() => {
        console.error('MCPConnectionService: Failed to sync MCP file changes');
        return of(false);
      })
    );
  }

  /**
   * Get HTTP headers for MCP requests
   */
  private getHeaders(credentials: MCPCredentials): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (credentials.apiKey) {
      headers = headers.set('Authorization', `Bearer ${credentials.apiKey}`);
    }

    return headers;
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    let errorMessage = 'An error occurred while connecting to MCP server';
    
    if (error.status === 401) {
      errorMessage = 'Invalid MCP API key. Please check your credentials.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied to MCP project. Please check your permissions.';
    } else if (error.status === 404) {
      errorMessage = 'MCP project not found. Please check your project ID.';
    } else if (error.error && error.error.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => ({
      message: errorMessage,
      status: error.status || 0
    }));
  };
}