import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  MCPCredentials,
  MCPFileResponse,
  FigmaPage,
  DesignToken,
  LocalStyle,
  FigmaComponent,
  ProcessedArtboard
} from '../interfaces/figma.interface';

@Injectable({
  providedIn: 'root'
})
export class MCPConnectionService {

  constructor(private http: HttpClient) {}

  /**
   * Test MCP connection
   */
  testConnection(credentials: MCPCredentials): Observable<{ success: boolean; message: string }> {
    const headers = this.getHeaders(credentials);
    const apiUrl = `${credentials.serverUrl}/health`;
    
    return this.http.get(apiUrl, { headers }).pipe(

    );
  }

  /**
   * Get file data from MCP server
   */
  getFileData(credentials: MCPCredentials): Observable<MCPFileResponse> {
    const headers = this.getHeaders(credentials);
    const apiUrl = `${credentials.serverUrl}/projects/${credentials.projectId}/file`;
    

    return this.http.get<MCPFileResponse>(apiUrl, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get enhanced analysis from MCP server
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

  }

  /**
   * Fetch page artboards from MCP
   */
  fetchPageArtboards(pageId: string, credentials: MCPCredentials): Observable<any[]> {
    return this.getFileData(credentials).pipe(
      map(() => []), // Placeholder implementation
      catchError(() => of([]))
    );
  }

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

      }
    };
  }

  private extractPagesFromMCP(mcpData: MCPFileResponse): FigmaPage[] {

  }

  private extractDesignTokensFromMCP(mcpData: MCPFileResponse): DesignToken[] {

  }

  private extractLocalStylesFromMCP(mcpData: MCPFileResponse): LocalStyle[] {

  }

  private extractComponentsFromMCP(mcpData: MCPFileResponse): FigmaComponent[] {

  }

  private extractArtboardsFromMCP(mcpData: MCPFileResponse): ProcessedArtboard[] {

  }

  private getHeaders(credentials: MCPCredentials): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (credentials.apiKey) {
      headers = headers.set('Authorization', `Bearer ${credentials.apiKey}`);
    }
    
    return headers;
  }

  private handleError = (error: any): Observable<never> => {
    console.error('MCP API Error:', error);
    return throwError(() => ({
      message: error.message || 'MCP API error occurred',
      status: error.status || 0
    }));
  };
}