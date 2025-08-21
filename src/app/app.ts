import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FigmaForm } from './components/figma-form/figma-form';
import { FigmaResults } from './components/figma-results/figma-results';
import { FigmaService } from './services/figma.service';
import { FigmaCredentials, ProcessedArtboard, DesignToken } from './interfaces/figma.interface';

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
  fileInfo: { name: string; lastModified: string; version: string } | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(private figmaService: FigmaService) {}

  onConnect(credentials: FigmaCredentials): void {
    this.isLoading = true;
    this.error = null;
    
    this.figmaService.extractDesignTokens(credentials).subscribe({
      next: (tokens) => {
        this.designTokens = tokens;
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
