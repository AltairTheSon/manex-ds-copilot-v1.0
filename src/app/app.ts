import { Component, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FigmaForm } from './components/figma-form/figma-form';
import { FigmaResults } from './components/figma-results/figma-results';
import { FigmaService } from './services/figma.service';
import { MCPConnectionService } from './services/mcp-connection.service';
import { ConnectionPersistenceService } from './services/connection-persistence.service';
import { FigmaCredentials, MCPCredentials, ProcessedArtboard, DesignToken, FigmaPage, LocalStyle, FigmaComponent, Artboard, StoredConnection, ConnectionRequest } from './interfaces/figma.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, FigmaForm, FigmaResults],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  providers: [FigmaService, MCPConnectionService, ConnectionPersistenceService]
})
export class App implements OnInit {
  @ViewChild(FigmaForm) figmaForm!: FigmaForm;
  @ViewChild(FigmaResults) figmaResults!: FigmaResults;
  
  title = 'figma-ds-copilot';
  artboards: ProcessedArtboard[] = [];
  designTokens: DesignToken[] = [];
  pages: FigmaPage[] = [];
  localStyles: LocalStyle[] = [];
  components: FigmaComponent[] = [];
  fileInfo: { name: string; lastModified: string; version: string } | null = null;
  syncStatus: { lastSynced: string; isAutoSync: boolean } = { lastSynced: '', isAutoSync: false };
  isLoading = false;
  error: string | null = null;
  currentCredentials: FigmaCredentials | MCPCredentials | null = null;
  currentConnectionType: 'figma' | 'mcp' = 'figma';
  isRestoringConnection = false;

  constructor(
    private figmaService: FigmaService,
    private mcpService: MCPConnectionService,
    private connectionPersistence: ConnectionPersistenceService
  ) {}

  ngOnInit(): void {
    this.attemptConnectionRestore();
  }

  /**
   * Attempt to restore connection from stored data
   */
  private attemptConnectionRestore(): void {
    if (this.connectionPersistence.hasValidStoredConnection()) {
      const storedConnection = this.connectionPersistence.getStoredConnection();
      
      if (storedConnection) {
        this.isRestoringConnection = true;
        this.currentConnectionType = storedConnection.connectionType;
        
        // Validate connection by making a quick API call
        const validationObservable = storedConnection.connectionType === 'figma'
          ? this.figmaService.syncFileChanges(storedConnection.credentials as FigmaCredentials)
          : this.mcpService.syncFileChanges(storedConnection.credentials as MCPCredentials);
          
        validationObservable.subscribe({
          next: (hasChanges) => {
            // Connection is valid, restore the full state
            this.restoreConnectionData(storedConnection);
          },
          error: (error) => {
            console.log('Stored connection is no longer valid:', error);
            this.connectionPersistence.updateConnectionValidity(false);
            this.isRestoringConnection = false;
          }
        });
      }
    }
  }

  /**
   * Restore connection data and fetch fresh information
   */
  private restoreConnectionData(storedConnection: StoredConnection): void {
    this.currentCredentials = storedConnection.credentials;
    this.currentConnectionType = storedConnection.connectionType;
    
    // Pre-populate form with restored credentials
    if (this.figmaForm) {
      this.figmaForm.setCredentials(storedConnection.credentials, storedConnection.connectionType);
    }
    
    // Fetch fresh data
    this.connectWithCredentials(storedConnection.connectionType, storedConnection.credentials, true);
  }

  onConnect(connectionRequest: ConnectionRequest): void {
    this.connectWithCredentials(connectionRequest.connectionType, connectionRequest.credentials, false);
  }

  /**
   * Connect with credentials and optionally mark as restored connection
   */
  private connectWithCredentials(
    connectionType: 'figma' | 'mcp', 
    credentials: FigmaCredentials | MCPCredentials, 
    isRestore: boolean = false
  ): void {
    this.currentCredentials = credentials;
    this.currentConnectionType = connectionType;
    this.isLoading = true;
    this.error = null;
    
    if (!isRestore && this.figmaForm) {
      this.figmaForm.setLoading(true);
    }
    
    const analysisObservable = connectionType === 'figma'
      ? this.figmaService.getEnhancedAnalysis(credentials as FigmaCredentials)
      : this.mcpService.getEnhancedAnalysis(credentials as MCPCredentials);
    
    analysisObservable.subscribe({
      next: (data) => {
        this.pages = data.pages;
        this.designTokens = data.designTokens;
        this.localStyles = data.localStyles;
        this.components = data.components;
        this.artboards = data.artboards;
        this.fileInfo = data.fileInfo;
        this.isLoading = false;
        this.isRestoringConnection = false;
        
        if (this.figmaForm) {
          this.figmaForm.setLoading(false);
        }

        // Store successful connection
        if (this.fileInfo) {
          const storedConnection = this.connectionPersistence.createStoredConnection(
            connectionType,
            credentials,
            this.fileInfo
          );
          this.connectionPersistence.storeConnection(storedConnection);
        }
      },
      error: (error) => {
        this.error = error.message || `An error occurred while connecting to ${connectionType === 'figma' ? 'Figma' : 'MCP server'}`;
        this.isLoading = false;
        this.isRestoringConnection = false;
        
        if (this.figmaForm) {
          this.figmaForm.setLoading(false);
        }

        // Mark stored connection as invalid if this was a restore attempt
        if (isRestore) {
          this.connectionPersistence.updateConnectionValidity(false);
        }
      }
    });
  }

  onFetchPageArtboards(event: { pageId: string; pageName: string }): void {
    if (!this.currentCredentials) {
      console.error('No credentials available for fetching artboards');
      return;
    }

    this.figmaResults.setArtboardsLoading(true);
    
    // Only Figma service supports page artboards currently
    if (this.currentConnectionType === 'figma') {
      this.figmaService.fetchPageArtboards(event.pageId, this.currentCredentials as FigmaCredentials).subscribe({
        next: (artboards: Artboard[]) => {
          this.figmaResults.setPageArtboards(artboards);
        },
        error: (error) => {
          console.error('Error fetching page artboards:', error);
          this.figmaResults.setArtboardsLoading(false);
        }
      });
    } else {
      // MCP doesn't support page artboards yet
      this.figmaResults.setArtboardsLoading(false);
      console.log('Page artboards not supported for MCP connections yet');
    }
  }
}
