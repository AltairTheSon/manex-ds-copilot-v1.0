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
    console.log(`MCPConnectionService: Validating connection to ${credentials.serverUrl}`);
    const headers = this.getHeaders(credentials);
    
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
    console.log(`MCPConnectionService: Making file data API call to ${credentials.serverUrl}/projects/${credentials.projectId}/file`);
    const headers = this.getHeaders(credentials);
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response: MCPFileResponse) => {
        console.log(`MCPConnectionService: File data API responded - file name: ${response.name}, version: ${response.version}`);
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
        console.log('MCPConnectionService: Converting MCP data to Figma format...');
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
    console.log('MCPConnectionService: Attempting to convert MCP data - this will fail as MCP features are not implemented');
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
    console.error('MCPConnectionService: extractPagesFromMCP called but MCP page extraction is not implemented');
    throw new Error('MCP page extraction is not yet implemented. Please use Figma API instead for page data.');
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    console.error('MCPConnectionService: extractDesignTokensFromMCP called but MCP design token extraction is not implemented');
    throw new Error('MCP design token extraction is not yet implemented. Please use Figma API instead for design tokens.');
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    console.error('MCPConnectionService: extractLocalStylesFromMCP called but MCP local styles extraction is not implemented');
    throw new Error('MCP local styles extraction is not yet implemented. Please use Figma API instead for local styles.');
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    console.error('MCPConnectionService: extractComponentsFromMCP called but MCP component extraction is not implemented');
    throw new Error('MCP component extraction is not yet implemented. Please use Figma API instead for component data.');
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    console.error('MCPConnectionService: extractArtboardsFromMCP called but MCP artboard extraction is not implemented');
    throw new Error('MCP artboard extraction is not yet implemented. Please use Figma API instead for artboard data.');
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