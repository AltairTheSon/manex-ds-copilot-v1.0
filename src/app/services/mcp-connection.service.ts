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
    console.log('MCPService: Making API call to validate connection at', credentials.serverUrl);
    
    return this.http.get(`${credentials.serverUrl}/health`, { headers }).pipe(
      map(() => {
        console.log('MCPService: Connection validation successful');
        return true;
      }),
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
    console.log('MCPService: Making API call to fetch file data from', credentials.serverUrl);
    
    return this.http.get<MCPFileResponse>(
      `${credentials.serverUrl}/projects/${credentials.projectId}/file`, 
      { headers }
    ).pipe(
      map((response) => {
        console.log('MCPService: Successfully fetched file data');
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
    console.log('MCPService: Starting enhanced analysis for MCP project');
    return this.getFileData(credentials).pipe(
      map((mcpData) => {
        console.log('MCPService: Converting MCP data to Figma-compatible format');
        return this.convertMCPToFigmaFormat(mcpData);
      }),
      catchError((error) => {
        console.error('MCPService: Enhanced analysis failed:', error);
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
    // MCP integration is not currently implemented - would require actual MCP server specification
    console.error('MCPService: MCP format conversion not implemented - requires MCP server specification');
    throw new Error('MCP format conversion not implemented: Real MCP server API specification and format documentation required for implementation');
  }

  /**
   * Extract pages from MCP data
   */
  private extractPagesFromMCP(mcpData: MCPFileResponse): FigmaPage[] {
    // MCP format is not currently implemented - this would require 
    // actual MCP server specification and real API documentation
    throw new Error('MCP pages extraction not implemented: MCP server format specification required for real implementation');
  }

  /**
   * Extract design tokens from MCP data
   */
  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {
    // MCP format is not currently implemented - this would require 
    // actual MCP server specification and real API documentation
    throw new Error('MCP design tokens extraction not implemented: MCP server format specification required for real implementation');
  }

  /**
   * Extract local styles from MCP data
   */
  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {
    // MCP format is not currently implemented - this would require 
    // actual MCP server specification and real API documentation
    throw new Error('MCP local styles extraction not implemented: MCP server format specification required for real implementation');
  }

  /**
   * Extract components from MCP data
   */
  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {
    // MCP format is not currently implemented - this would require 
    // actual MCP server specification and real API documentation
    throw new Error('MCP components extraction not implemented: MCP server format specification required for real implementation');
  }

  /**
   * Extract artboards from MCP data
   */
  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {
    // MCP format is not currently implemented - this would require 
    // actual MCP server specification and real API documentation
    throw new Error('MCP artboards extraction not implemented: MCP server format specification required for real implementation');
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