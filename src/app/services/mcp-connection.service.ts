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
    
    return this.http.get(`${credentials.serverUrl}/health`, { headers }).pipe(
      map(() => {
        console.log('MCP API: Connection validation successful');
        return true;
      }),
      catchError((error) => {
        console.error('MCP API: Connection validation failed:', error);
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
    console.log('MCP API: Fetching file data for project:', credentials.projectId);
    const headers = this.getHeaders(credentials);
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response) => {
        console.log('MCP API: Successfully fetched file data');
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
    console.log('MCP API: Getting enhanced analysis for project:', credentials.projectId);
    
    return this.getFileData(credentials).pipe(
      map((mcpData) => {
        console.error('MCP API: Enhanced analysis failed - functionality not implemented');
        return this.convertMCPToFigmaFormat(mcpData);
      }),
      catchError((error) => {
        console.error('MCP API: Enhanced analysis failed:', error);
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
    console.error('MCP data conversion not implemented - requires actual MCP server response format specification');
    
    // Return proper error structure instead of placeholder data
    throw new Error('MCP functionality not implemented - actual MCP server integration and response format parsing required');
  }

  /**
   * Extract pages from MCP data
   */
  private extractPagesFromMCP(mcpData: MCPFileResponse): FigmaPage[] {
    // MCP format parsing implementation would need to be provided based on actual MCP server response format
    throw new Error('MCP page extraction not implemented - requires actual MCP server response format specification');
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    // MCP format parsing implementation would need to be provided based on actual MCP server response format
    throw new Error('MCP design token extraction not implemented - requires actual MCP server response format specification');
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    // MCP format parsing implementation would need to be provided based on actual MCP server response format
    throw new Error('MCP local styles extraction not implemented - requires actual MCP server response format specification');
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    // MCP format parsing implementation would need to be provided based on actual MCP server response format
    throw new Error('MCP components extraction not implemented - requires actual MCP server response format specification');
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    // MCP format parsing implementation would need to be provided based on actual MCP server response format
    throw new Error('MCP artboards extraction not implemented - requires actual MCP server response format specification');
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