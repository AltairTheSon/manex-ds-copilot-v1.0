import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessedArtboard, DesignToken, FigmaPage, LocalStyle, FigmaComponent, FigmaFileData, Artboard, FigmaCredentials } from '../../interfaces/figma.interface';
import { FigmaService } from '../../services/figma.service';

@Component({
  selector: 'app-figma-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './figma-results.html',
  styleUrl: './figma-results.scss'
})
export class FigmaResults implements OnDestroy {
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

  // Auto sync management
  private autoSyncInterval: any = null;
  private lastCredentials: FigmaCredentials | null = null;

  constructor(private figmaService: FigmaService) {}

  ngOnDestroy(): void {
    // Clean up auto sync interval
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
  }

  // Store credentials for sync operations
  setCredentials(credentials: FigmaCredentials): void {
    this.lastCredentials = credentials;
  }

  // Refresh current data
  private refreshData(): void {
    console.log('🔄 FigmaResults: Refreshing data...');
    // This would trigger a re-fetch of current data
    // Implementation depends on parent component structure
  }

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
    console.log('🔄 FigmaResults: Manual sync requested - checking for file changes...');
    // Implement actual sync logic by checking for file changes
    // and refreshing data if needed
    if (this.figmaService && this.lastCredentials) {
      this.figmaService.syncFileChanges(this.lastCredentials).subscribe({
        next: (hasChanges) => {
          if (hasChanges) {
            console.log('✅ FigmaResults: File changes detected, refreshing data...');
            this.refreshData();
          } else {
            console.log('ℹ️ FigmaResults: No file changes detected');
          }
          this.syncStatus.lastSynced = new Date().toISOString();
        },
        error: (error) => {
          console.error('❌ FigmaResults: Sync failed:', error);
          this.syncStatus.lastSynced = new Date().toISOString();
        }
      });
    } else {
      console.warn('⚠️ FigmaResults: Cannot sync - no connection available');
      this.syncStatus.lastSynced = new Date().toISOString();
    }
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
    console.log('🔄 FigmaResults: Auto sync toggled:', this.syncStatus.isAutoSync);
    
    // Implement auto sync logic with proper interval management
    if (this.syncStatus.isAutoSync) {
      console.log('✅ FigmaResults: Auto sync enabled - setting up periodic checks');
      // Set up auto sync with 5-minute intervals
      if (this.autoSyncInterval) {
        clearInterval(this.autoSyncInterval);
      }
      this.autoSyncInterval = setInterval(() => {
        console.log('🔄 FigmaResults: Auto sync check triggered');
        this.syncNow();
      }, 5 * 60 * 1000); // 5 minutes
    } else {
      console.log('⏹️ FigmaResults: Auto sync disabled - clearing periodic checks');
      if (this.autoSyncInterval) {
        clearInterval(this.autoSyncInterval);
        this.autoSyncInterval = null;
      }
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
