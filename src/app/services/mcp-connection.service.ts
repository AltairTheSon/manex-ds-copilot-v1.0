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
    console.log('MCP API: Validating connection to server:', credentials.serverUrl);
    const headers = this.getHeaders(credentials);
    const apiUrl = `${credentials.serverUrl}/health`;
    
    return this.http.get(apiUrl, { headers }).pipe(
      map(() => true),
      catchError((error) => {
        return throwError(() => ({ 
          message: 'Failed to connect to MCP server. Note: MCP may not be a real service.',
          status: error.status || 0
        }));
      })
    );
  }

  /**
   * Get file data from MCP server
   */
  getFileData(credentials: MCPCredentials): Observable<MCPFileResponse> {
    console.log('MCP API: Fetching file data for project:', credentials.projectId);
    const headers = this.getHeaders(credentials);
    const apiUrl = `${credentials.serverUrl}/projects/${credentials.projectId}/file`;
    
    console.log('🔄 MCPService: Attempting MCP file data retrieval (Note: MCP is not a real service)');
    console.log(`📡 API URL: ${apiUrl}`);
    
    return this.http.get<MCPFileResponse>(apiUrl, { headers }).pipe(
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
      map((mcpData: MCPFileResponse) => {
        return this.convertMCPToFigmaFormat(mcpData);
      }),
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
    const pages: FigmaPage[] = [];
    
    if (mcpData.document && mcpData.document.children) {
      mcpData.document.children.forEach((page: any) => {
        if (page.type === 'CANVAS') {
          pages.push({
            id: page.id,
            name: page.name,
            thumbnail: '',
            children: page.children || []
          });
        }
      });
    }
    
    return pages;
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    const tokens: DesignToken[] = [];
    
    if (mcpData.styles) {
      Object.values(mcpData.styles).forEach((style: any) => {
        if (style.styleType === 'FILL') {
          tokens.push({
            type: 'color',
            name: style.name,
            value: style.value || '#000000',
            description: style.description || '',
            category: 'colors'
          });
        } else if (style.styleType === 'TEXT') {
          tokens.push({
            type: 'typography',
            name: style.name,
            value: style.value || 'font-family: Arial; font-size: 16px;',
            description: style.description || '',
            category: 'typography'
          });
        }
      });
    }
    
    return tokens;
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    const styles: LocalStyle[] = [];
    
    if (mcpData.styles) {
      Object.values(mcpData.styles).forEach((style: any) => {
        styles.push({
          id: style.id || style.key,
          name: style.name,
          type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
          description: style.description || '',
          styleType: style.styleType
        });
      });
    }
    
    return styles;
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    const components: FigmaComponent[] = [];
    
    if (mcpData.components) {
      Object.values(mcpData.components).forEach((component: any) => {
        components.push({
          key: component.key || component.id,
          name: component.name,
          description: component.description || '',
          documentationLinks: component.documentationLinks || [],
          id: component.id || component.key,
          thumbnail: component.thumbnail || '',
          variants: component.variants || [],
          properties: component.properties || []
        });
      });
    }
    
    return components;
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    const artboards: ProcessedArtboard[] = [];
    
    if (mcpData.document && mcpData.document.children) {
      const traverse = (node: any) => {
        if (node.type === 'FRAME' && node.absoluteBoundingBox) {
          artboards.push({
            id: node.id,
            name: node.name,
            imageUrl: node.thumbnail || '',
            width: node.absoluteBoundingBox.width,
            height: node.absoluteBoundingBox.height,
            backgroundColor: node.backgroundColor
          });
        }
        
        if (node.children) {
          node.children.forEach(traverse);
        }
      };
      
      mcpData.document.children.forEach(traverse);
    }
    
    return artboards;
  }

  /**
   * Sync file changes with MCP server
   */
  syncFileChanges(credentials: MCPCredentials): Observable<boolean> {
    console.log('MCP API: Syncing file changes for project:', credentials.projectId);
    const headers = this.getHeaders(credentials);
    
    return this.http.get(`${credentials.serverUrl}/projects/${credentials.projectId}/changes`, { headers }).pipe(
      map((response: any) => {
        const hasChanges = response.hasChanges || false;
        console.log('MCP API: File sync completed, has changes:', hasChanges);
        return hasChanges;
      }),
      catchError((error) => {
        console.error('MCP API: Failed to sync file changes:', error);
        return throwError(() => ({
          message: 'Failed to sync MCP file changes',
          status: error.status || 0
        }));
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