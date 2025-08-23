import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessedArtboard, DesignToken, FigmaPage, LocalStyle, FigmaComponent, FigmaFileData, Artboard } from '../../interfaces/figma.interface';

@Component({
  selector: 'app-figma-results',
  standalone: true,
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

  @Output() fetchPageArtboards = new EventEmitter<{ pageId: string; pageName: string }>();

  selectedTab: 'pages' | 'tokens' | 'components' | 'sync' = 'pages';
  
  // Page artboards navigation state
  selectedPage: FigmaPage | null = null;
  pageArtboards: Artboard[] = [];
  isLoadingArtboards = false;

  // Modal states
  showSyncHistoryModal = false;
  showSyncSettingsModal = false;

  selectTab(tab: 'pages' | 'tokens' | 'components' | 'sync'): void {
    this.selectedTab = tab;
    // Reset page selection when switching tabs
    if (tab !== 'pages') {
      this.selectedPage = null;
      this.pageArtboards = [];
    }
  }

  /**
   * Handle page click - navigate to artboards view
   */
  onPageClick(page: FigmaPage): void {
    this.selectedPage = page;
    this.isLoadingArtboards = true;
    this.fetchPageArtboards.emit({ pageId: page.id, pageName: page.name });
  }

  /**
   * Navigate back to pages list
   */
  backToPages(): void {
    this.selectedPage = null;
    this.pageArtboards = [];
    this.isLoadingArtboards = false;
  }

  /**
   * Set page artboards data (called from parent component)
   */
  setPageArtboards(artboards: Artboard[]): void {
    this.pageArtboards = artboards;
    this.isLoadingArtboards = false;
  }

  /**
   * Set loading state for artboards
   */
  setArtboardsLoading(loading: boolean): void {
    this.isLoadingArtboards = loading;
  }

  // Sync functionality methods
  syncNow(): void {
    console.log('🔄 Manual sync requested');
    // Manual sync is handled by the parent component through re-fetching data
    // Update the last synced timestamp to show user feedback
    this.syncStatus.lastSynced = new Date().toISOString();
    console.log('✅ Sync timestamp updated');
  }

  viewSyncHistory(): void {
    console.log('View sync history clicked');
    this.showSyncHistoryModal = true;
  }

  openSyncSettings(): void {
    console.log('Open sync settings clicked');
    this.showSyncSettingsModal = true;
  }

  closeSyncHistoryModal(): void {
    this.showSyncHistoryModal = false;
  }

  closeSyncSettingsModal(): void {
    this.showSyncSettingsModal = false;
  }

  toggleAutoSync(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.syncStatus.isAutoSync = target.checked;
    console.log('🔄 Auto sync toggled:', this.syncStatus.isAutoSync);
    
    if (this.syncStatus.isAutoSync) {
      console.log('⚠️ Auto sync enabled - this would require background polling implementation');
      // Auto sync would require implementing a background service to periodically check for changes
      // This is UI state management only - actual auto sync would be implemented at the service level
    } else {
      console.log('ℹ️ Auto sync disabled');
    }
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

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
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
