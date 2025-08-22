import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FigmaForm } from './components/figma-form/figma-form';
import { FigmaResults } from './components/figma-results/figma-results';
import { FigmaService } from './services/figma.service';
import { FigmaCredentials, ProcessedArtboard, DesignToken, FigmaPage, LocalStyle, FigmaComponent, Artboard } from './interfaces/figma.interface';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, HttpClientModule, FigmaForm, FigmaResults],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  providers: [FigmaService]
})
export class App {
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
  currentCredentials: FigmaCredentials | null = null;

  constructor(private figmaService: FigmaService) {}

  onConnect(credentials: FigmaCredentials): void {
    this.currentCredentials = credentials;
    this.isLoading = true;
    this.error = null;
    
    this.figmaService.getEnhancedAnalysis(credentials).subscribe({
      next: (data) => {
        this.pages = data.pages;
        this.designTokens = data.designTokens;
        this.localStyles = data.localStyles;
        this.components = data.components;
        this.artboards = data.artboards;
        this.fileInfo = data.fileInfo;
        this.isLoading = false;
        this.figmaForm.setLoading(false);
      },
      error: (error) => {
        this.error = error.message || 'An error occurred while connecting to Figma';
        this.isLoading = false;
        this.figmaForm.setLoading(false);
      }
    });
  }

  onFetchPageArtboards(event: { pageId: string; pageName: string }): void {
    if (!this.currentCredentials) {
      console.error('No credentials available for fetching artboards');
      return;
    }

    this.figmaResults.setArtboardsLoading(true);
    
    this.figmaService.fetchPageArtboards(event.pageId, this.currentCredentials).subscribe({
      next: (artboards: Artboard[]) => {
        this.figmaResults.setPageArtboards(artboards);
      },
      error: (error) => {
        console.error('Error fetching page artboards:', error);
        this.figmaResults.setArtboardsLoading(false);
        // Could show error message to user here
      }
    });
  }
}
