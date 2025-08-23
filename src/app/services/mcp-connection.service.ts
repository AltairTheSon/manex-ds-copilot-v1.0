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
    const url = `${credentials.serverUrl}/health`;
    
    console.log(`📡 Making MCP health check API call to: ${url}`);
    return this.http.get(url, { headers }).pipe(
      map(() => {
        console.log('✅ MCP connection validation successful');
        return true;
      }),
      catchError((error) => {
        console.error('❌ MCP connection validation failed:', error);
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
    const url = `${credentials.serverUrl}/projects/${credentials.projectId}/file`;
    
    console.log(`📡 Making MCP file data API call to: ${url}`);
    return this.http.get<MCPFileResponse>(url, { headers }).pipe(
      map((response) => {
        console.log(`✅ MCP file data API call successful for file: ${response.name}`);
        return response;
      }),
      catchError((error) => {
        console.error(`❌ MCP file data API call failed:`, error);
        return this.handleError(error);
      })
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
    // Convert MCP response format to Figma-compatible format
    // This implementation attempts to parse actual MCP data structures
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
    console.log('🔄 Attempting to extract pages from MCP data...');
    
    try {
      const pages: FigmaPage[] = [];
      
      // Attempt to parse MCP document structure similar to Figma format
      if (mcpData.document && mcpData.document.children) {
        mcpData.document.children.forEach((page: any) => {
          if (page.type === 'CANVAS' || page.type === 'PAGE') {
            pages.push({
              id: page.id || `mcp-page-${Date.now()}`,
              name: page.name || 'Unnamed Page',
              thumbnail: '', // MCP servers typically don't provide thumbnails
              children: page.children || []
            });
          }
        });
      }
      
      if (pages.length === 0) {
        console.warn('⚠️ No pages found in MCP data structure');
        throw new Error('No pages found in MCP response - MCP server may not support page extraction or data format is incompatible');
      }
      
      console.log(`✅ Successfully extracted ${pages.length} pages from MCP data`);
      return pages;
      
    } catch (error) {
      console.error('❌ Failed to extract pages from MCP data:', error);
      throw new Error(`MCP page extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    console.log('🔄 Attempting to extract design tokens from MCP data...');
    
    try {
      const tokens: DesignToken[] = [];
      
      // Attempt to parse MCP styles structure
      if (mcpData.styles && typeof mcpData.styles === 'object') {
        Object.entries(mcpData.styles).forEach(([styleId, style]: [string, any]) => {
          if (style.styleType === 'FILL' && style.name) {
            tokens.push({
              name: style.name,
              value: this.extractColorFromMCPStyle(style),
              type: 'color',
              category: 'colors',
              description: style.description
            });
          } else if (style.styleType === 'TEXT' && style.name) {
            tokens.push({
              name: style.name,
              value: this.extractTextFromMCPStyle(style),
              type: 'typography',
              category: 'typography',
              description: style.description
            });
          }
        });
      }
      
      if (tokens.length === 0) {
        console.warn('⚠️ No design tokens found in MCP data structure');
        throw new Error('No design tokens found in MCP response - MCP server may not support token extraction or data format is incompatible');
      }
      
      console.log(`✅ Successfully extracted ${tokens.length} design tokens from MCP data`);
      return tokens;
      
    } catch (error) {
      console.error('❌ Failed to extract design tokens from MCP data:', error);
      throw new Error(`MCP design token extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    console.log('🔄 Attempting to extract local styles from MCP data...');
    
    try {
      const localStyles: LocalStyle[] = [];
      
      // Attempt to parse MCP styles structure
      if (mcpData.styles && typeof mcpData.styles === 'object') {
        Object.entries(mcpData.styles).forEach(([styleId, style]: [string, any]) => {
          if (style.name && style.styleType) {
            localStyles.push({
              id: styleId,
              name: style.name,
              type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
              description: style.description || '',
              styleType: style.styleType
            });
          }
        });
      }
      
      console.log(`✅ Successfully extracted ${localStyles.length} local styles from MCP data`);
      return localStyles;
      
    } catch (error) {
      console.error('❌ Failed to extract local styles from MCP data:', error);
      throw new Error(`MCP local styles extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    console.log('🔄 Attempting to extract components from MCP data...');
    
    try {
      const components: FigmaComponent[] = [];
      
      // Attempt to parse MCP components structure
      if (mcpData.components && typeof mcpData.components === 'object') {
        Object.entries(mcpData.components).forEach(([componentId, component]: [string, any]) => {
          if (component.name) {
            components.push({
              key: componentId,
              name: component.name,
              description: component.description || '',
              documentationLinks: component.documentationLinks || [],
              id: componentId,
              thumbnail: '', // MCP servers typically don't provide thumbnails
              variants: component.variants || [],
              properties: component.properties || []
            });
          }
        });
      }
      
      console.log(`✅ Successfully extracted ${components.length} components from MCP data`);
      return components;
      
    } catch (error) {
      console.error('❌ Failed to extract components from MCP data:', error);
      throw new Error(`MCP components extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    console.log('🔄 Attempting to extract artboards from MCP data...');
    
    try {
      const artboards: ProcessedArtboard[] = [];
      
      // Traverse the MCP document structure to find frames/artboards
      const traverseForArtboards = (node: any) => {
        if (node.type === 'FRAME' && node.absoluteBoundingBox) {
          artboards.push({
            id: node.id,
            name: node.name || 'Unnamed Artboard',
            imageUrl: '', // MCP servers typically don't provide image URLs
            width: node.absoluteBoundingBox.width,
            height: node.absoluteBoundingBox.height,
            backgroundColor: node.backgroundColor ? this.extractColorFromMCPNode(node) : undefined
          });
        }
        
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(traverseForArtboards);
        }
      };
      
      if (mcpData.document) {
        traverseForArtboards(mcpData.document);
      }
      
      console.log(`✅ Successfully extracted ${artboards.length} artboards from MCP data`);
      return artboards;
      
    } catch (error) {
      console.error('❌ Failed to extract artboards from MCP data:', error);
      throw new Error(`MCP artboards extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  /**
   * Extract color value from MCP style
   */
  private extractColorFromMCPStyle(style: any): string {
    try {
      // Try different MCP color format strategies
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
    } catch (error) {
      console.warn('Failed to extract color from MCP style:', error);
      return '#000000';
    }
  }

  /**
   * Extract text value from MCP style
   */
  private extractTextFromMCPStyle(style: any): string {
    try {
      const fontFamily = style.fontFamily || style.typeStyle?.fontFamily || 'Arial';
      const fontSize = style.fontSize || style.typeStyle?.fontSize || 16;
      const fontWeight = style.fontWeight || style.typeStyle?.fontWeight || 400;
      
      return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight};`;
    } catch (error) {
      console.warn('Failed to extract text from MCP style:', error);
      return 'font-family: Arial; font-size: 16px;';
    }
  }

  /**
   * Extract color from MCP node
   */
  private extractColorFromMCPNode(node: any): string | undefined {
    try {
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
    } catch (error) {
      console.warn('Failed to extract color from MCP node:', error);
      return undefined;
    }
  }

  /**
   * Convert RGBA color to hex
   */
  private rgbaToHex(color: any): string {
    try {
      const r = Math.round((color.r || 0) * 255);
      const g = Math.round((color.g || 0) * 255);
      const b = Math.round((color.b || 0) * 255);
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch (error) {
      console.warn('Failed to convert RGBA to hex:', error);
      return '#000000';
    }
  }
}