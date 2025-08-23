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
    
    return this.http.get(`${credentials.serverUrl}/health`, { headers }).pipe(
      map(() => true),
      catchError((error) => {
        console.error('MCP connection validation failed:', error);
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
    
    console.log('🔄 MCPService: Making API call to MCP server file endpoint...');
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response) => {
        console.log('✅ MCPService: Successfully received file data from MCP server');
        return response;
      }),
      catchError((error) => {
        console.error('❌ MCPService: Failed to fetch file data from MCP server:', error);
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
    console.log('🔄 MCPService: Starting enhanced analysis of MCP data...');
    
    return this.getFileData(credentials).pipe(
      map((mcpData) => {
        console.log('🔄 MCPService: Processing MCP data for enhanced analysis...');
        return this.convertMCPToFigmaFormat(mcpData);
      }),
      catchError((error) => {
        console.error('❌ MCPService: Enhanced analysis failed:', error);
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
    console.log('🔄 MCPService: Converting MCP data to Figma-compatible format...');
    
    try {
      const result = {
        pages: this.extractPagesFromMCP(mcpData),
        designTokens: this.extractDesignTokensFromMCP(mcpData),
        localStyles: this.extractLocalStylesFromMCP(mcpData),
        components: this.extractComponentsFromMCP(mcpData),
        artboards: this.extractArtboardsFromMCP(mcpData),
        fileInfo: {
          name: mcpData.name || 'Unknown MCP Project',
          lastModified: mcpData.lastModified || new Date().toISOString(),
          version: mcpData.version || '1.0'
        }
      };
      
      console.log('✅ MCPService: Successfully converted MCP data to Figma-compatible format');
      return result;
      
    } catch (error) {
      console.error('❌ MCPService: Failed to convert MCP data:', error);
      throw error; // Re-throw to be handled by calling method
    }
  }

  /**
   * Extract pages from MCP data
   */
  private extractPagesFromMCP(mcpData: MCPFileResponse): FigmaPage[] {
    console.log('🔄 MCPService: Attempting to extract pages from MCP data...');
    
    // Check if MCP data has a compatible structure for pages
    if (!mcpData || !mcpData.document) {
      console.error('❌ MCPService: MCP data does not contain document structure for page extraction');
      throw new Error('MCP data format incompatible: missing document structure for pages');
    }
    
    // Try to extract pages from MCP document structure
    const pages: FigmaPage[] = [];
    
    try {
      // Attempt to parse MCP document structure similar to Figma format
      if (mcpData.document.children && Array.isArray(mcpData.document.children)) {
        mcpData.document.children.forEach((child: any) => {
          if (child.type === 'CANVAS' || child.type === 'PAGE') {
            pages.push({
              id: child.id || `mcp-page-${Date.now()}`,
              name: child.name || 'Unnamed MCP Page',
              thumbnail: '', // MCP may not support thumbnails
              children: child.children || []
            });
          }
        });
      }
      
      if (pages.length === 0) {
        console.warn('⚠️  MCPService: No compatible page structures found in MCP data');
        throw new Error('No pages found in MCP data structure');
      }
      
      console.log(`✅ MCPService: Successfully extracted ${pages.length} pages from MCP data`);
      return pages;
      
    } catch (error) {
      console.error('❌ MCPService: Failed to extract pages from MCP data:', error);
      throw new Error(`Failed to extract pages from MCP data: ${error}`);
    }
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    console.log('🔄 MCPService: Attempting to extract design tokens from MCP data...');
    
    if (!mcpData) {
      console.error('❌ MCPService: No MCP data provided for design token extraction');
      throw new Error('MCP data required for design token extraction');
    }
    
    const tokens: DesignToken[] = [];
    
    try {
      // Try to extract tokens from styles if they exist
      if (mcpData.styles && typeof mcpData.styles === 'object') {
        Object.values(mcpData.styles).forEach((style: any) => {
          if (style.styleType === 'FILL' && style.name) {
            // Extract color tokens
            const colorValue = this.extractColorFromMCPStyle(style);
            if (colorValue) {
              tokens.push({
                type: 'color',
                name: style.name,
                value: colorValue,
                description: style.description || '',
                category: 'colors'
              });
            }
          } else if (style.styleType === 'TEXT' && style.name) {
            // Extract typography tokens
            const textValue = this.extractTextFromMCPStyle(style);
            if (textValue) {
              tokens.push({
                type: 'typography',
                name: style.name,
                value: textValue,
                description: style.description || '',
                category: 'typography'
              });
            }
          }
        });
      }
      
      if (tokens.length === 0) {
        console.warn('⚠️  MCPService: No design tokens found in MCP data structure');
        throw new Error('No design tokens found in MCP data structure');
      }
      
      console.log(`✅ MCPService: Successfully extracted ${tokens.length} design tokens from MCP data`);
      return tokens;
      
    } catch (error) {
      console.error('❌ MCPService: Failed to extract design tokens from MCP data:', error);
      throw new Error(`Failed to extract design tokens from MCP data: ${error}`);
    }
  }
  
  /**
   * Extract color value from MCP style
   */
  private extractColorFromMCPStyle(style: any): string | null {
    // Try different possible MCP color formats
    if (style.color) {
      return this.mcpColorToHex(style.color);
    }
    if (style.fills && Array.isArray(style.fills) && style.fills.length > 0) {
      const fill = style.fills[0];
      if (fill.color) {
        return this.mcpColorToHex(fill.color);
      }
    }
    return null;
  }
  
  /**
   * Extract text value from MCP style
   */
  private extractTextFromMCPStyle(style: any): string | null {
    if (style.fontFamily || style.fontSize) {
      const fontFamily = style.fontFamily || 'Arial';
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 400;
      return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight};`;
    }
    return null;
  }
  
  /**
   * Convert MCP color format to hex
   */
  private mcpColorToHex(color: any): string {
    if (typeof color === 'string' && color.startsWith('#')) {
      return color; // Already hex
    }
    if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
      // RGB format (0-1)
      const r = Math.round((color.r || 0) * 255);
      const g = Math.round((color.g || 0) * 255);
      const b = Math.round((color.b || 0) * 255);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return '#000000'; // fallback
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    console.log('🔄 MCPService: Attempting to extract local styles from MCP data...');
    
    if (!mcpData || !mcpData.styles) {
      console.error('❌ MCPService: MCP data does not contain styles for local style extraction');
      throw new Error('MCP data format incompatible: missing styles structure');
    }
    
    const localStyles: LocalStyle[] = [];
    
    try {
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
      
      if (localStyles.length === 0) {
        console.warn('⚠️  MCPService: No local styles found in MCP data structure');
        throw new Error('No local styles found in MCP data structure');
      }
      
      console.log(`✅ MCPService: Successfully extracted ${localStyles.length} local styles from MCP data`);
      return localStyles;
      
    } catch (error) {
      console.error('❌ MCPService: Failed to extract local styles from MCP data:', error);
      throw new Error(`Failed to extract local styles from MCP data: ${error}`);
    }
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    console.log('🔄 MCPService: Attempting to extract components from MCP data...');
    
    if (!mcpData || !mcpData.components) {
      console.error('❌ MCPService: MCP data does not contain components for component extraction');
      throw new Error('MCP data format incompatible: missing components structure');
    }
    
    const components: FigmaComponent[] = [];
    
    try {
      Object.values(mcpData.components).forEach((component: any) => {
        if (component.key && component.name) {
          components.push({
            key: component.key,
            name: component.name,
            description: component.description || '',
            documentationLinks: component.documentationLinks || [],
            id: component.key,
            thumbnail: '', // MCP may not support component thumbnails
            variants: [],
            properties: []
          });
        }
      });
      
      if (components.length === 0) {
        console.warn('⚠️  MCPService: No components found in MCP data structure');
        throw new Error('No components found in MCP data structure');
      }
      
      console.log(`✅ MCPService: Successfully extracted ${components.length} components from MCP data`);
      return components;
      
    } catch (error) {
      console.error('❌ MCPService: Failed to extract components from MCP data:', error);
      throw new Error(`Failed to extract components from MCP data: ${error}`);
    }
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    console.log('🔄 MCPService: Attempting to extract artboards from MCP data...');
    
    if (!mcpData || !mcpData.document) {
      console.error('❌ MCPService: MCP data does not contain document structure for artboard extraction');
      throw new Error('MCP data format incompatible: missing document structure for artboards');
    }
    
    const artboards: ProcessedArtboard[] = [];
    
    try {
      this.traverseMCPNodes(mcpData.document, (node: any) => {
        if (node.type === 'FRAME' && node.absoluteBoundingBox) {
          artboards.push({
            id: node.id,
            name: node.name || 'Unnamed Artboard',
            imageUrl: '', // MCP may not support artboard images
            width: node.absoluteBoundingBox.width || 0,
            height: node.absoluteBoundingBox.height || 0,
            backgroundColor: node.backgroundColor ? this.mcpColorToHex(node.backgroundColor) : undefined
          });
        }
      });
      
      if (artboards.length === 0) {
        console.warn('⚠️  MCPService: No artboards found in MCP document structure');
        throw new Error('No artboards found in MCP document structure');
      }
      
      console.log(`✅ MCPService: Successfully extracted ${artboards.length} artboards from MCP data`);
      return artboards;
      
    } catch (error) {
      console.error('❌ MCPService: Failed to extract artboards from MCP data:', error);
      throw new Error(`Failed to extract artboards from MCP data: ${error}`);
    }
  }
  
  /**
   * Traverse MCP nodes recursively
   */
  private traverseMCPNodes(node: any, callback: (node: any) => void): void {
    if (!node) return;
    
    callback(node);
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => this.traverseMCPNodes(child, callback));
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
}