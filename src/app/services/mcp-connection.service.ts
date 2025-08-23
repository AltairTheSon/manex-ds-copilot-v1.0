import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
    const headers = this.getHeaders(credentials);
    console.log('MCPConnectionService: Validating connection to MCP server...');
    
    return this.http.get(`${credentials.serverUrl}/health`, { headers }).pipe(
      map(() => {
        console.log('MCPConnectionService: Connection validation successful');
        return true;
      }),
      catchError((error) => {
        console.error('MCPConnectionService: Connection validation failed:', error);
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
    const headers = this.getHeaders(credentials);
    console.log('MCPConnectionService: Making API call to fetch file data from MCP server...');
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response) => {
        console.log('MCPConnectionService: File data API response received:', {
          name: response.name,
          version: response.version,
          lastModified: response.lastModified,
          hasDocument: !!response.document,
          hasStyles: !!response.styles,
          hasComponents: !!response.components
        });
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
    console.log('MCPConnectionService: Starting enhanced analysis...');
    
    return this.getFileData(credentials).pipe(
      map((mcpData) => {
        console.log('MCPConnectionService: Converting MCP data to Figma-compatible format...');
        return this.convertMCPToFigmaFormat(mcpData);
      }),
      catchError((error) => {
        console.error('MCPConnectionService: Enhanced analysis failed:', error);
        return this.handleError(error);
      })
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
    console.log('MCPConnectionService: Converting MCP data to Figma-compatible format...');
    
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
    console.log('MCPConnectionService: Extracting pages from MCP data...');
    
    const pages: FigmaPage[] = [];
    
    // Attempt to extract real page data from MCP response
    if (mcpData && mcpData.document && mcpData.document.children) {
      mcpData.document.children.forEach((page: any) => {
        if (page.type === 'CANVAS' || page.type === 'PAGE') {
          pages.push({
            id: page.id || `mcp-page-${Math.random().toString(36).substr(2, 9)}`,
            name: page.name || 'Unnamed Page',
            thumbnail: null, // MCP may not support thumbnails
            children: page.children || []
          });
        }
      });
    }
    
    // If no valid pages found, throw error instead of returning placeholder data
    if (pages.length === 0) {
      console.error('MCPConnectionService: No valid pages found in MCP data');
      throw new Error('No pages found in MCP server response. The MCP server may not support page extraction or the data format is not compatible.');
    }
    
    console.log(`MCPConnectionService: Extracted ${pages.length} pages from MCP data`);
    return pages;
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    console.log('MCPConnectionService: Extracting design tokens from MCP data...');
    
    const tokens: DesignToken[] = [];
    
    // Attempt to extract real design tokens from MCP response
    if (mcpData && mcpData.styles) {
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
        } else if (style.styleType === 'EFFECT' && style.name) {
          tokens.push({
            type: 'shadow',
            name: style.name,
            value: this.extractEffectFromMCPStyle(style),
            description: style.description || '',
            category: 'effects'
          });
        }
      });
    }
    
    // If no tokens found, log warning instead of returning placeholder data
    if (tokens.length === 0) {
      console.warn('MCPConnectionService: No design tokens found in MCP data. The MCP server may not support design tokens or the data format is not compatible.');
    } else {
      console.log(`MCPConnectionService: Extracted ${tokens.length} design tokens from MCP data`);
    }
    
    return tokens;
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    console.log('MCPConnectionService: Extracting local styles from MCP data...');
    
    const localStyles: LocalStyle[] = [];
    
    // Attempt to extract real local styles from MCP response
    if (mcpData && mcpData.styles) {
      Object.values(mcpData.styles).forEach((style: any) => {
        if (style.key && style.name && style.styleType) {
          localStyles.push({
            id: style.key,
            name: style.name,
            type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
            description: style.description || '',
            styleType: style.styleType
          });
        }
      });
    }
    
    // Log results instead of returning placeholder data
    if (localStyles.length === 0) {
      console.warn('MCPConnectionService: No local styles found in MCP data. The MCP server may not support local styles or the data format is not compatible.');
    } else {
      console.log(`MCPConnectionService: Extracted ${localStyles.length} local styles from MCP data`);
    }
    
    return localStyles;
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    console.log('MCPConnectionService: Extracting components from MCP data...');
    
    const components: FigmaComponent[] = [];
    
    // Attempt to extract real components from MCP response
    if (mcpData && mcpData.components) {
      Object.values(mcpData.components).forEach((component: any) => {
        if (component.key && component.name) {
          components.push({
            key: component.key,
            name: component.name,
            description: component.description || '',
            documentationLinks: component.documentation_links || [],
            id: component.key,
            thumbnail: null, // MCP may not support thumbnails
            variants: component.variants || [],
            properties: component.properties || []
          });
        }
      });
    }
    
    // Log results instead of returning placeholder data
    if (components.length === 0) {
      console.warn('MCPConnectionService: No components found in MCP data. The MCP server may not support components or the data format is not compatible.');
    } else {
      console.log(`MCPConnectionService: Extracted ${components.length} components from MCP data`);
    }
    
    return components;
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    console.log('MCPConnectionService: Extracting artboards from MCP data...');
    
    const artboards: ProcessedArtboard[] = [];
    
    // Attempt to extract real artboards from MCP response by traversing document structure
    if (mcpData && mcpData.document) {
      this.traverseMCPNodesForArtboards(mcpData.document, artboards);
    }
    
    // Log results instead of returning placeholder data
    if (artboards.length === 0) {
      console.warn('MCPConnectionService: No artboards found in MCP data. The MCP server may not support artboards or the data format is not compatible.');
    } else {
      console.log(`MCPConnectionService: Extracted ${artboards.length} artboards from MCP data`);
    }
    
    return artboards;
  }

  /**
   * Sync file changes with MCP server
   */
  syncFileChanges(credentials: MCPCredentials): Observable<boolean> {
    const headers = this.getHeaders(credentials);
    
    return this.http.get(`${credentials.serverUrl}/projects/${credentials.projectId}/changes`, { headers }).pipe(
      map((response: any) => response.hasChanges || false),
      catchError(() => {
        console.error('Failed to sync MCP file changes');
        return [false];
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
   * Helper method to traverse MCP document nodes and extract artboards
   */
  private traverseMCPNodesForArtboards(node: any, artboards: ProcessedArtboard[]): void {
    if (!node) return;
    
    // Check if node is a frame/artboard type
    if (node.type === 'FRAME' && node.absoluteBoundingBox) {
      artboards.push({
        id: node.id || `mcp-artboard-${Math.random().toString(36).substr(2, 9)}`,
        name: node.name || 'Unnamed Artboard',
        imageUrl: null, // MCP may not support image URLs
        width: node.absoluteBoundingBox.width || 0,
        height: node.absoluteBoundingBox.height || 0,
        backgroundColor: this.extractBackgroundColorFromMCPNode(node)
      });
    }
    
    // Traverse children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        this.traverseMCPNodesForArtboards(child, artboards);
      });
    }
  }

  /**
   * Extract background color from MCP node
   */
  private extractBackgroundColorFromMCPNode(node: any): string | undefined {
    if (node.backgroundColor) {
      return this.rgbaToHex(node.backgroundColor);
    }
    
    if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    
    return undefined;
  }

  /**
   * Extract color value from MCP style
   */
  private extractColorFromMCPStyle(style: any): string {
    if (style.fills && Array.isArray(style.fills) && style.fills.length > 0) {
      const fill = style.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    
    if (style.color) {
      return this.rgbaToHex(style.color);
    }
    
    return '#000000'; // fallback
  }

  /**
   * Extract text value from MCP style
   */
  private extractTextFromMCPStyle(style: any): string {
    if (style.fontFamily || style.fontSize || style.fontWeight) {
      const fontFamily = style.fontFamily || 'Arial';
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 400;
      const lineHeight = style.lineHeightPx ? `${style.lineHeightPx}px` : 'normal';
      return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight}; line-height: ${lineHeight};`;
    }
    
    return 'font-family: Arial; font-size: 16px;'; // fallback
  }

  /**
   * Extract effect value from MCP style
   */
  private extractEffectFromMCPStyle(style: any): string {
    if (style.effects && Array.isArray(style.effects) && style.effects.length > 0) {
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
   * Convert RGBA color to hex
   */
  private rgbaToHex(color: any): string {
    const r = Math.round((color.r || 0) * 255);
    const g = Math.round((color.g || 0) * 255);
    const b = Math.round((color.b || 0) * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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