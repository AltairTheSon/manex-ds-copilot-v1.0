import { Component, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FigmaForm } from './components/figma-form/figma-form';
import { FigmaResults } from './components/figma-results/figma-results';
import { FigmaService } from './services/figma.service';
import { 
  FigmaCredentials, 
  ProcessedArtboard, 
  DesignToken, 
  FigmaApiError 
} from './interfaces/figma.interface';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule, 
    FigmaForm, 
    FigmaResults
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  @ViewChild(FigmaForm) figmaForm!: FigmaForm;
  
  protected readonly title = signal('Figma Design System Copilot');
  
  // Application State
  isConnected = false;
  isLoading = false;
  error: string | null = null;
  
  // Results Data
  artboards: ProcessedArtboard[] = [];
  designTokens: DesignToken[] = [];
  fileInfo: { name: string; lastModified: string; version: string } | null = null;

  constructor(private figmaService: FigmaService) {}

  /**
   * Handle Figma connection from form
   */
  onFigmaConnect(credentials: FigmaCredentials): void {
    this.isLoading = true;
    this.error = null;
    this.resetResults();

    this.figmaService.getCompleteAnalysis(credentials).subscribe({
      next: (result) => {
        this.artboards = result.artboards;
        this.designTokens = result.designTokens;
        this.fileInfo = result.fileInfo;
        this.isConnected = true;
        this.isLoading = false;
        this.figmaForm?.setLoading(false);
      },
      error: (error: FigmaApiError) => {
        this.error = error.message;
        this.isLoading = false;
        this.isConnected = false;
        this.figmaForm?.setLoading(false);
      }
    });
  }

  /**
   * Reset to initial state
   */
  onReset(): void {
    this.isConnected = false;
    this.isLoading = false;
    this.error = null;
    this.resetResults();
  }

  /**
   * Clear results data
   */
  private resetResults(): void {
    this.artboards = [];
    this.designTokens = [];
    this.fileInfo = null;
  }
}
