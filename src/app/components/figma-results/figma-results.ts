import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessedArtboard, DesignToken, FigmaPage, LocalStyle, FigmaComponent, FigmaFileData } from '../../interfaces/figma.interface';

@Component({
  selector: 'app-figma-results',
  imports: [CommonModule],
  templateUrl: './figma-results.html',
  styleUrl: './figma-results.scss'
})
export class FigmaResults {
  @Input() artboards: ProcessedArtboard[] = [];
  @Input() designTokens: DesignToken[] = [];
  @Input() pages: FigmaPage[] = [];
  @Input() localStyles: LocalStyle[] = [];
  @Input() components: FigmaComponent[] = [];
  @Input() fileInfo: { name: string; lastModified: string; version: string } | null = null;
  @Input() isLoading = false;
  @Input() syncStatus: { lastSynced: string; isAutoSync: boolean } = { lastSynced: '', isAutoSync: false };

  selectedTab: 'pages' | 'tokens' | 'components' | 'sync' = 'pages';

  selectTab(tab: 'pages' | 'tokens' | 'components' | 'sync'): void {
    this.selectedTab = tab;
  }

  getTokensByCategory(category: string): DesignToken[] {
    return this.designTokens.filter(token => token.category === category);
  }

  getUniqueCategories(): string[] {
    const categories = this.designTokens.map(token => token.category || 'uncategorized');
    return [...new Set(categories)];
  }

  getStylesByType(type: 'FILL' | 'TEXT' | 'EFFECT'): LocalStyle[] {
    return this.localStyles.filter(style => style.type === type);
  }

  getComponentsWithVariants(): FigmaComponent[] {
    return this.components.filter(component => component.variants && component.variants.length > 0);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  downloadTokensAsCSV(): void {
    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.fileInfo?.name || 'figma'}-design-tokens.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private generateCSV(): string {
    const headers = ['Type', 'Name', 'Value', 'Category', 'Description'];
    const rows = this.designTokens.map(token => [
      token.type,
      token.name,
      token.value,
      token.category || '',
      token.description || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    return csvContent;
  }
}
