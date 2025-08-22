import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FigmaForm } from './components/figma-form/figma-form';
import { FigmaResults } from './components/figma-results/figma-results';
import { FigmaService } from './services/figma.service';
import { FigmaCredentials, ProcessedArtboard, DesignToken, FigmaPage, LocalStyle, FigmaComponent } from './interfaces/figma.interface';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, HttpClientModule, FigmaForm, FigmaResults],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  providers: [FigmaService]
})
export class App {
  @ViewChild(FigmaForm) figmaForm!: FigmaForm;
  
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

  constructor(private figmaService: FigmaService) {}

  onConnect(credentials: FigmaCredentials): void {
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
}
