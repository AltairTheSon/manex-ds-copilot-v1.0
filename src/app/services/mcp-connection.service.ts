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
    console.log('MCPConnectionService: Validating connection to MCP server:', credentials.serverUrl);
    
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
    console.log('MCPConnectionService: Making API call to get file data for project:', credentials.projectId);
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response) => {
        console.log('MCPConnectionService: File data API response received successfully');
        return response;
      }),
      catchError((error) => {
        console.error('MCPConnectionService: File data API call failed:', error);
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
    console.log('MCPConnectionService: Starting enhanced analysis');
    return this.getFileData(credentials).pipe(
      map((mcpData) => {
        console.log('MCPConnectionService: Converting MCP data to Figma-compatible format');
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
    console.log('MCPConnectionService: Starting MCP to Figma format conversion');
    
    // Extract data from actual MCP response structure
    const result = {
      pages: this.extractPagesFromMCP(mcpData),
      designTokens: this.extractDesignTokensFromMCP(mcpData),
      localStyles: this.extractLocalStylesFromMCP(mcpData),
      components: this.extractComponentsFromMCP(mcpData),
      artboards: this.extractArtboardsFromMCP(mcpData),
      fileInfo: {
        name: mcpData.name || 'MCP Project',
        lastModified: mcpData.lastModified || new Date().toISOString(),
        version: mcpData.version || '1.0'
      }
    };
    
    console.log('MCPConnectionService: Conversion completed - Pages:', result.pages.length, 
                'Tokens:', result.designTokens.length, 'Styles:', result.localStyles.length,
                'Components:', result.components.length, 'Artboards:', result.artboards.length);
    
    return result;
  }

  /**
   * Extract pages from MCP data
   */
  private extractPagesFromMCP(mcpData: MCPFileResponse): FigmaPage[] {
    console.log('MCPConnectionService: Extracting pages from MCP data');
    
    // Check if MCP data has actual pages structure
    if (!mcpData.document || !mcpData.document.children) {
      console.warn('MCPConnectionService: No pages found in MCP data structure');
      return [];
    }
    
    const pages: FigmaPage[] = [];
    
    // Extract actual pages from MCP document structure
    mcpData.document.children.forEach((page: any) => {
      if (page.type === 'CANVAS' || page.type === 'PAGE') {
        pages.push({
          id: page.id,
          name: page.name,
          thumbnail: page.thumbnail || '', // Use actual thumbnail from MCP if available
          children: page.children || []
        });
      }
    });
    
    console.log('MCPConnectionService: Extracted pages count:', pages.length);
    return pages;
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    console.log('MCPConnectionService: Extracting design tokens from MCP data');
    
    const tokens: DesignToken[] = [];
    
    // Extract tokens from MCP styles if available
    if (mcpData.styles) {
      Object.values(mcpData.styles).forEach((style: any) => {
        if (style.styleType === 'FILL' && style.name) {
          tokens.push({
            name: style.name,
            value: this.extractColorFromMCPStyle(style),
            type: 'color',
            category: 'colors',
            description: style.description || ''
          });
        } else if (style.styleType === 'TEXT' && style.name) {
          tokens.push({
            name: style.name,
            value: this.extractTextFromMCPStyle(style),
            type: 'typography',
            category: 'typography',
            description: style.description || ''
          });
        } else if (style.styleType === 'EFFECT' && style.name) {
          tokens.push({
            name: style.name,
            value: this.extractEffectFromMCPStyle(style),
            type: 'shadow',
            category: 'effects',
            description: style.description || ''
          });
        }
      });
    }
    
    console.log('MCPConnectionService: Extracted design tokens count:', tokens.length);
    return tokens;
  }
  
  /**
   * Extract color value from MCP style
   */
  private extractColorFromMCPStyle(style: any): string {
    // Try to extract color from various MCP style formats
    if (style.fills && style.fills.length > 0 && style.fills[0].color) {
      const color = style.fills[0].color;
      return this.rgbaToHex(color);
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
    if (style.fontFamily || style.fontSize) {
      const fontFamily = style.fontFamily || 'Arial';
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 400;
      return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight};`;
    }
    return 'font-family: Arial; font-size: 16px;'; // fallback
  }
  
  /**
   * Extract effect value from MCP style
   */
  private extractEffectFromMCPStyle(style: any): string {
    if (style.effects && style.effects.length > 0) {
      const effect = style.effects[0];
      if (effect.type === 'DROP_SHADOW' && effect.offset) {
        const x = effect.offset.x || 0;
        const y = effect.offset.y || 0;
        const blur = effect.radius || 4;
        const color = effect.color ? this.rgbaToHex(effect.color) : '#000000';
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
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    console.log('MCPConnectionService: Extracting local styles from MCP data');
    
    const localStyles: LocalStyle[] = [];
    
    // Extract styles from MCP data if available
    if (mcpData.styles) {
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
    
    console.log('MCPConnectionService: Extracted local styles count:', localStyles.length);
    return localStyles;
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    console.log('MCPConnectionService: Extracting components from MCP data');
    
    const components: FigmaComponent[] = [];
    
    // Extract components from MCP data if available
    if (mcpData.components) {
      Object.values(mcpData.components).forEach((component: any) => {
        if (component.key && component.name) {
          components.push({
            key: component.key,
            name: component.name,
            description: component.description || '',
            documentationLinks: component.documentation_links || [],
            id: component.key,
            thumbnail: component.thumbnail || '', // Use actual thumbnail from MCP if available
            variants: component.variants || [],
            properties: component.properties || []
          });
        }
      });
    }
    
    // Also extract components from document structure
    if (mcpData.document) {
      this.extractComponentsFromMCPNodes(mcpData.document, components);
    }
    
    console.log('MCPConnectionService: Extracted components count:', components.length);
    return components;
  }
  
  /**
   * Extract components from MCP document nodes
   */
  private extractComponentsFromMCPNodes(node: any, components: FigmaComponent[]): void {
    if (!node) return;
    
    // Check if current node is a component
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      const existingComponent = components.find(c => c.id === node.id);
      if (!existingComponent) {
        components.push({
          key: node.id,
          name: node.name,
          description: node.description || '',
          documentationLinks: [],
          id: node.id,
          thumbnail: node.thumbnail || '',
          variants: node.type === 'COMPONENT_SET' ? (node.variants || []) : undefined,
          properties: node.properties || []
        });
      }
    }
    
    // Traverse children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => this.extractComponentsFromMCPNodes(child, components));
    }
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    console.log('MCPConnectionService: Extracting artboards from MCP data');
    
    const artboards: ProcessedArtboard[] = [];
    
    // Extract artboards from MCP document structure
    if (mcpData.document) {
      this.extractArtboardsFromMCPNodes(mcpData.document, artboards);
    }
    
    console.log('MCPConnectionService: Extracted artboards count:', artboards.length);
    return artboards;
  }
  
  /**
   * Extract artboards from MCP document nodes
   */
  private extractArtboardsFromMCPNodes(node: any, artboards: ProcessedArtboard[]): void {
    if (!node) return;
    
    // Check if current node is an artboard (FRAME type)
    if (node.type === 'FRAME' && node.absoluteBoundingBox) {
      artboards.push({
        id: node.id,
        name: node.name,
        imageUrl: node.imageUrl || node.thumbnail || '', // Use actual image URL from MCP if available
        width: node.absoluteBoundingBox.width,
        height: node.absoluteBoundingBox.height,
        backgroundColor: this.extractBackgroundColorFromMCPNode(node)
      });
    }
    
    // Traverse children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => this.extractArtboardsFromMCPNodes(child, artboards));
    }
  }
  
  /**
   * Extract background color from MCP node
   */
  private extractBackgroundColorFromMCPNode(node: any): string | undefined {
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
   * Sync file changes with MCP server
   */
  syncFileChanges(credentials: MCPCredentials): Observable<boolean> {
    const headers = this.getHeaders(credentials);
    console.log('MCPConnectionService: Checking for file changes on MCP server');
    
    return this.http.get(`${credentials.serverUrl}/projects/${credentials.projectId}/changes`, { headers }).pipe(
      map((response: any) => {
        const hasChanges = response.hasChanges || false;
        console.log('MCPConnectionService: File changes check completed, has changes:', hasChanges);
        return hasChanges;
      }),
      catchError((error) => {
        console.error('MCPConnectionService: Failed to sync MCP file changes:', error);
        return throwError(() => new Error('Failed to sync MCP file changes: ' + error.message));
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