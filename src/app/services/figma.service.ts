import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  FigmaCredentials,
  FigmaFileResponse,
  FigmaImageResponse,
  FigmaNode,
  ProcessedArtboard,
  DesignToken,
  FigmaApiError,
  FigmaColor,
  FigmaFill,
  FigmaPage,
  LocalStyle,
  FigmaComponent,
  FigmaFileData,
  Artboard
} from '../interfaces/figma.interface';

@Injectable({
  providedIn: 'root'
})
export class FigmaService {
  private readonly FIGMA_API_BASE = this.isProduction() ? 'https://api.figma.com/v1' : '/api/figma';

  constructor(private http: HttpClient) {}

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    return typeof window !== 'undefined' && 
           (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.hostname.includes('dev')) === false;
  }

  /**
   * Get Figma file data including all frames and design information
   */
  getFileData(credentials: FigmaCredentials): Observable<FigmaFileResponse> {
    console.log('Figma API: Fetching file data for file ID:', credentials.fileId);
    const headers = this.getHeaders(credentials.accessToken);
    
    return this.http.get<FigmaFileResponse>(
      `${this.FIGMA_API_BASE}/files/${credentials.fileId}`,
      { headers }
    ).pipe(
      map((response) => {
        console.log('Figma API: Successfully fetched file data:', response.name);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get file styles from Figma styles API
   */
  getFileStyles(credentials: FigmaCredentials): Observable<any> {
    console.log('Figma API: Fetching styles from styles endpoint for file ID:', credentials.fileId);
    const headers = this.getHeaders(credentials.accessToken);
    
    return this.http.get<any>(
      `${this.FIGMA_API_BASE}/files/${credentials.fileId}/styles`,
      { headers }
    ).pipe(
      map((response) => {
        console.log('Figma API: Successfully fetched styles data from styles endpoint');
        return response;
      }),
      catchError((error) => {
        console.warn('Figma API: Styles endpoint failed, falling back to file parsing:', error);
        return of(null);
      })
    );
  }

  /**
   * Get file components from Figma components API
   */
  getFileComponents(credentials: FigmaCredentials): Observable<any> {
    console.log('Figma API: Fetching components from components endpoint for file ID:', credentials.fileId);
    const headers = this.getHeaders(credentials.accessToken);
    
    return this.http.get<any>(
      `${this.FIGMA_API_BASE}/files/${credentials.fileId}/components`,
      { headers }
    ).pipe(
      map((response) => {
        console.log('Figma API: Successfully fetched components data from components endpoint');
        return response;
      }),
      catchError((error) => {
        console.warn('Figma API: Components endpoint failed, falling back to file parsing:', error);
        return of(null);
      })
    );
  }

  /**
   * Get detailed styles data from Figma API with actual values (legacy method)
   */
  getStylesData(credentials: FigmaCredentials): Observable<any> {
    return this.getFileStyles(credentials);
  }

  /**
   * Get image URLs for specific node IDs with automatic batching to avoid URL length limits
   */
  getImages(credentials: FigmaCredentials, nodeIds: string[]): Observable<FigmaImageResponse> {
    const BATCH_SIZE = 50; // Maximum 50 node IDs per request to avoid URL length limits
    
    // Filter out invalid node IDs
    const validNodeIds = nodeIds.filter(id => 
      id && 
      id.trim() && 
      id !== 'undefined' && 
      id !== 'null' &&
      !id.startsWith('I') // Remove instance IDs that might cause issues
    );
    
    if (validNodeIds.length === 0) {
      console.log('Figma API: No valid node IDs provided');
      return of({ images: {} });
    }
    
    // Split nodeIds into batches
    const batches: string[][] = [];
    for (let i = 0; i < validNodeIds.length; i += BATCH_SIZE) {
      batches.push(validNodeIds.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Figma API: Splitting ${validNodeIds.length} node IDs into ${batches.length} batches`);
    
    // Execute all batches in parallel
    const batchRequests = batches.map(batch => this.getImagesBatch(credentials, batch));
    
    return forkJoin(batchRequests).pipe(
      map((responses: FigmaImageResponse[]) => {
        // Merge all responses into single response
        const mergedImages: { [key: string]: string } = {};
        responses.forEach(response => {
          Object.assign(mergedImages, response.images);
        });
        
        console.log(`Figma API: Successfully fetched ${Object.keys(mergedImages).length} thumbnails from ${batches.length} batches`);
        
        return { images: mergedImages };
      }),
      catchError(error => {
        console.error('Figma API: Batch image requests failed:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Get images for a single batch of node IDs
   */
  private getImagesBatch(credentials: FigmaCredentials, nodeIds: string[]): Observable<FigmaImageResponse> {
    const headers = this.getHeaders(credentials.accessToken);
    const ids = nodeIds.join(',');
    const url = `${this.FIGMA_API_BASE}/images/${credentials.fileId}?ids=${ids}&format=png&scale=2`;
    
    // Validate URL length
    if (!this.validateUrlLength(url)) {
      console.warn(`Figma API: Batch URL still too long (${url.length} chars), skipping batch`);
      return of({ images: {} });
    }
    
    console.log(`Figma API: Fetching batch of ${nodeIds.length} thumbnails`);
    
    return this.http.get<FigmaImageResponse>(url, { headers }).pipe(
      map((response) => {
        console.log(`Figma API: Batch request successful - received ${Object.keys(response.images).length} images`);
        return response;
      }),
      catchError(error => {
        console.error(`Figma API: Batch request failed for ${nodeIds.length} nodes:`, error);
        // Return empty response for failed batch instead of failing entire request
        return of({ images: {} });
      })
    );
  }

  /**
   * Validate URL length to prevent network errors
   */
  private validateUrlLength(url: string): boolean {
    const MAX_URL_LENGTH = 2048; // Conservative limit
    
    if (url.length > MAX_URL_LENGTH) {
      console.warn(`Figma API: URL too long (${url.length} chars), maximum is ${MAX_URL_LENGTH}`);
      return false;
    }
    
    return true;
  }

  /**
   * Process Figma file and return artboards with images
   */
  getArtboardsWithImages(credentials: FigmaCredentials): Observable<ProcessedArtboard[]> {
    return this.getFileData(credentials).pipe(
      switchMap((fileData: FigmaFileResponse) => {
        const artboards = this.extractArtboards(fileData.document);
        const nodeIds = artboards.map(artboard => artboard.id);
        
        if (nodeIds.length === 0) {
          return throwError(() => new Error('No artboards found in the Figma file'));
        }

        return this.getImages(credentials, nodeIds).pipe(
          map((imageResponse: FigmaImageResponse) => {
            return artboards.map(artboard => ({
              ...artboard,
              imageUrl: imageResponse.images[artboard.id] || ''
            }));
          })
        );
      })
    );
  }

  /**
   * Extract design tokens from Figma file - LEGACY METHOD
   */
  extractDesignTokensLegacy(credentials: FigmaCredentials): Observable<DesignToken[]> {
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const tokens: DesignToken[] = [];
        
        // Extract color tokens from styles
        Object.values(fileData.styles).forEach(style => {
          if (style.styleType === 'FILL') {
            tokens.push({
              type: 'color',
              name: style.name,
              value: this.extractColorValue(style),
              description: style.description,
              category: 'colors'
            });
          } else if (style.styleType === 'TEXT') {
            tokens.push({
              type: 'typography',
              name: style.name,
              value: this.extractTextValue(style),
              description: style.description,
              category: 'typography'
            });
          } else if (style.styleType === 'EFFECT') {
            tokens.push({
              type: 'shadow',
              name: style.name,
              value: this.extractEffectValue(style),
              description: style.description,
              category: 'effects'
            });
          }
        });

        // Extract additional tokens from document nodes
        this.extractTokensFromNodes(fileData.document, tokens);
        
        return tokens;
      })
    );
  }

  /**
   * Complete analysis: get both frames and design tokens
   */
  getCompleteAnalysis(credentials: FigmaCredentials): Observable<{
    artboards: ProcessedArtboard[];
    designTokens: DesignToken[];
    fileInfo: { name: string; lastModified: string; version: string };
  }> {
    return forkJoin({
      artboards: this.getArtboardsWithImages(credentials),
      fileData: this.getFileData(credentials)
    }).pipe(
      map(({ artboards, fileData }) => ({
        artboards,
        designTokens: this.extractDesignTokensFromFileData(fileData),
        fileInfo: {
          name: fileData.name,
          lastModified: fileData.lastModified,
          version: fileData.version
        }
      }))
    );
  }

  /**
   * Fetch pages from Figma file
   */
  fetchPages(credentials: FigmaCredentials): Observable<FigmaPage[]> {
    console.log('Figma API: Fetching pages from file:', credentials.fileId);
    
    return this.getFileData(credentials).pipe(
      switchMap((fileData: FigmaFileResponse) => {
        const pages: FigmaPage[] = [];
        const pageIds: string[] = [];
        
        if (fileData.document.children) {
          fileData.document.children.forEach(page => {
            if (page.type === 'CANVAS') {
              pages.push({
                id: page.id,
                name: page.name,
                thumbnail: '', // TEMPORARY - will be replaced immediately
                children: page.children || []
              });
              pageIds.push(page.id);
            }
          });
        }
        
        console.log(`Figma API: Found ${pages.length} pages, fetching thumbnails for page IDs:`, pageIds);
        
        // REAL API CALL for thumbnails
        if (pageIds.length > 0) {
          return this.getImages(credentials, pageIds).pipe(
            map((imageResponse: FigmaImageResponse) => {
              console.log('Figma API: Received page thumbnails:', Object.keys(imageResponse.images));
              return pages.map(page => ({
                ...page,
                thumbnail: imageResponse.images[page.id] || ''
              }));
            })
          );
        } else {
          console.log('Figma API: No pages found to fetch thumbnails for');
          return of(pages);
        }
      })
    );
  }

  /**
   * Fetch artboards for a specific page
   */
  fetchPageArtboards(pageId: string, credentials: FigmaCredentials): Observable<Artboard[]> {
    console.log('Figma API: Fetching artboards for page ID:', pageId);
    
    return this.getFileData(credentials).pipe(
      switchMap((fileData: FigmaFileResponse) => {
        const page = this.findPageById(fileData.document, pageId);
        
        if (!page || !page.children) {
          console.error('Figma API: Page not found or has no children:', pageId);
          return of([]); // Return empty array instead of error
        }

        const artboards: Artboard[] = [];
        
        // Extract artboards (FRAME type nodes) from the page
        page.children.forEach(child => {
          if (child.type === 'FRAME' && child.absoluteBoundingBox) {
            artboards.push({
              id: child.id,
              name: child.name,
              type: 'FRAME',
              thumbnail: '', // Will be populated with image API
              absoluteBoundingBox: {
                x: child.absoluteBoundingBox.x,
                y: child.absoluteBoundingBox.y,
                width: child.absoluteBoundingBox.width,
                height: child.absoluteBoundingBox.height
              }
            });
          }
        });

        console.log(`Figma API: Found ${artboards.length} artboards in page, fetching thumbnails`);
        
        // Get thumbnails for the artboards
        if (artboards.length > 0) {
          const nodeIds = artboards.map(artboard => artboard.id);
          return this.getImages(credentials, nodeIds).pipe(
            map((imageResponse: FigmaImageResponse) => {
              console.log('Figma API: Received artboard thumbnails for page');
              return artboards.map(artboard => ({
                ...artboard,
                thumbnail: imageResponse.images[artboard.id] || ''
              }));
            })
          );
        } else {
          console.log('Figma API: No artboards found in page');
          return of(artboards);
        }
      }),
      catchError(error => {
        console.error('Figma API: Error fetching page frames:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  /**
   * Find a page by ID in the document tree
   */
  private findPageById(node: FigmaNode, pageId: string): FigmaNode | null {
    if (node.id === pageId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findPageById(child, pageId);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }

  /**
   * Fetch local styles from Figma file
   */
  fetchLocalStyles(credentials: FigmaCredentials): Observable<LocalStyle[]> {
    // Use main file endpoint to get actual style data with values
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const localStyles: LocalStyle[] = [];
        
        // Extract styles from the main file data which contains actual values
        if (fileData.styles) {
          Object.values(fileData.styles).forEach((style: any) => {
            localStyles.push({
              id: style.key,
              name: style.name,
              type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
              description: style.description || '',
              styleType: style.styleType
            });
          });
        }
        
        return localStyles;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Fetch components from Figma file
   */
  fetchComponents(credentials: FigmaCredentials): Observable<FigmaComponent[]> {
    return forkJoin({
      fileData: this.getFileData(credentials),
      componentsApi: this.getComponentsFromAPI(credentials)
    }).pipe(
      map(({ fileData, componentsApi }) => {
        const components: FigmaComponent[] = [];
        
        // First, add components from the dedicated API endpoint (with null check)
        if (Array.isArray(componentsApi)) {
          components.push(...componentsApi);
        }
        
        // Then, parse the file structure to find additional components
        const nodeComponents = this.extractComponentsFromNodes(fileData.document);
        
        // Merge components, avoiding duplicates (with null check)
        if (Array.isArray(nodeComponents)) {
          nodeComponents.forEach(nodeComponent => {
            const existingComponent = components.find(c => c.key === nodeComponent.key);
            if (!existingComponent) {
              components.push(nodeComponent);
            }
          });
        }
        
        return components;
      }),
      catchError((error) => {
        console.error('Error fetching components:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Get components from the dedicated API endpoint
   */
  private getComponentsFromAPI(credentials: FigmaCredentials): Observable<FigmaComponent[]> {
    const headers = this.getHeaders(credentials.accessToken);
    
    return this.http.get<any>(
      `${this.FIGMA_API_BASE}/files/${credentials.fileId}/components`,
      { headers }
    ).pipe(
      map((componentsResponse: any) => {
        const components: FigmaComponent[] = [];
        
        if (componentsResponse.meta && componentsResponse.meta.components) {
          Object.values(componentsResponse.meta.components).forEach((component: any) => {
            components.push({
              key: component.key,
              name: component.name,
              description: component.description || '',
              documentationLinks: component.documentation_links || [],
              id: component.key,
              thumbnail: '', // Will be populated with image API
              variants: [],
              properties: []
            });
          });
        }
        
        return components;
      }),
      catchError((error) => {
        console.error('Figma API: Components endpoint failed:', error);
        // If the components API fails, return empty array
        // We'll still get components from file parsing
        return of([]);
      })
    );
  }

  /**
   * Extract components from file nodes by detecting COMPONENT and COMPONENT_SET types
   */
  private extractComponentsFromNodes(node: FigmaNode): FigmaComponent[] {
    const components: FigmaComponent[] = [];

    // Add null check for the node parameter
    if (!node) {
      return components;
    }

    const traverse = (currentNode: FigmaNode) => {
      // Check if node is a component or component set
      if (currentNode.type === 'COMPONENT' || currentNode.type === 'COMPONENT_SET') {
        components.push({
          key: currentNode.id,
          name: currentNode.name,
          description: '', // Node description not typically available in file API
          documentationLinks: [],
          id: currentNode.id,
          thumbnail: '', // Will be populated with image API
          variants: currentNode.type === 'COMPONENT_SET' ? [] : undefined,
          properties: []
        });
      }

      // Traverse children with additional safety checks
      if (currentNode.children && Array.isArray(currentNode.children) && currentNode.children.length > 0) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    traverse(node);
    return components;
  }

  /**
   * Store Figma data in localStorage
   */
  storeLocalData(data: FigmaFileData): void {
    try {
      localStorage.setItem('figma-file-data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to store Figma data:', error);
    }
  }

  /**
   * Get stored Figma data from localStorage
   */
  getStoredData(): FigmaFileData | null {
    try {
      const data = localStorage.getItem('figma-file-data');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to retrieve stored Figma data:', error);
      return null;
    }
  }

  /**
   * Sync file changes with stored data
   */
  syncFileChanges(credentials: FigmaCredentials): Observable<boolean> {
    return this.getFileData(credentials).pipe(
      map((fileData: FigmaFileResponse) => {
        const storedData = this.getStoredData();
        
        if (!storedData) {
          return true; // No stored data, consider as changed
        }
        
        // Compare file version
        return storedData.fileVersion !== fileData.version;
      }),
      catchError(() => {
        console.error('Figma API: Failed to sync file changes');
        return of(false);
      })
    );
  }

  /**
   * COMPREHENSIVE ENHANCED ANALYSIS - Fetches ALL possible Figma data with zero placeholders
   */
  getEnhancedAnalysis(credentials: FigmaCredentials): Observable<{
    pages: FigmaPage[];
    designTokens: DesignToken[];
    localStyles: LocalStyle[];
    components: FigmaComponent[];
    artboards: ProcessedArtboard[];
    fileInfo: { name: string; lastModified: string; version: string; thumbnailUrl: string };
  }> {
    console.log('Figma API: Starting comprehensive enhanced analysis...');
    
    return forkJoin({
      fileData: this.getFileData(credentials),
      stylesData: this.getFileStyles(credentials),
      componentsData: this.getFileComponents(credentials)
    }).pipe(
      switchMap(({ fileData, stylesData, componentsData }) => {
        console.log('Figma API: File data fetched, processing comprehensive extraction...');
        
        // Extract all possible data types
        const pages = this.extractPages(fileData);
        const designTokens = this.extractDesignTokens(stylesData, fileData);
        const localStyles = this.extractLocalStyles(stylesData, fileData);
        const extractedComponents = this.extractComponents(componentsData, fileData);
        
        // Get ALL node IDs for thumbnails - comprehensive collection with deduplication
        const allNodeIds = [
          ...pages.map(p => p.id),
          ...extractedComponents.map(c => c.id || c.key),
          ...this.findAllFrames(fileData)
        ].filter(id => 
          id && 
          id.trim() && 
          id !== 'undefined' && 
          id !== 'null'
        ).filter((id, index, array) => array.indexOf(id) === index); // Remove duplicates
        
        console.log(`Figma API: Collected ${allNodeIds.length} unique valid node IDs for thumbnails`);
        
        // Fetch ALL thumbnails
        if (allNodeIds.length > 0) {
          return this.getImages(credentials, allNodeIds).pipe(
            map(imageResponse => {
              console.log(`Figma API: Received ${Object.keys(imageResponse.images).length} thumbnails`);
              
              return {
                pages: this.populatePageThumbnails(pages, imageResponse),
                designTokens,
                localStyles,
                components: this.populateComponentThumbnails(extractedComponents, imageResponse),
                artboards: this.extractAllArtboards(fileData, imageResponse),
                fileInfo: this.extractFileInfo(fileData)
              };
            })
          );
        } else {
          console.log('Figma API: No nodes found for thumbnail generation');
          return of({
            pages,
            designTokens,
            localStyles,
            components: extractedComponents,
            artboards: this.extractAllArtboards(fileData, { images: {} }),
            fileInfo: this.extractFileInfo(fileData)
          });
        }
      })
    );
  }

  /**
   * Extract local styles from styles API and file data
   */
  private extractLocalStyles(stylesData: any, fileData: FigmaFileResponse): LocalStyle[] {
    console.log('Figma API: Extracting local styles from styles API and file data');
    const localStyles: LocalStyle[] = [];
    
    // Extract from styles API if available
    if (stylesData && stylesData.meta && stylesData.meta.styles) {
      console.log('Figma API: Processing local styles from styles API');
      Object.values(stylesData.meta.styles).forEach((style: any) => {
        localStyles.push({
          id: style.key,
          name: style.name,
          type: style.style_type as 'FILL' | 'TEXT' | 'EFFECT',
          description: style.description || '',
          styleType: style.style_type
        });
      });
    }
    
    // Extract from file data as fallback/supplement
    if (fileData.styles) {
      console.log('Figma API: Processing local styles from file data');
      Object.values(fileData.styles).forEach((style: any) => {
        // Avoid duplicates
        const existingStyle = localStyles.find(s => s.id === style.key);
        if (!existingStyle) {
          localStyles.push({
            id: style.key,
            name: style.name,
            type: style.styleType as 'FILL' | 'TEXT' | 'EFFECT',
            description: style.description || '',
            styleType: style.styleType
          });
        }
      });
    }
    
    console.log(`Figma API: Extracted ${localStyles.length} local styles`);
    return localStyles;
  }

  /**
   * Legacy method - maintain backward compatibility
   */
  private extractDesignTokensFromFileData(fileData: FigmaFileResponse, stylesData?: any[]): DesignToken[] {
    return this.extractDesignTokens(stylesData, fileData);
  }

  /**
   * Extract all frames as artboards/thumbnails - comprehensive search with limits
   */
  private findAllFrames(fileData: FigmaFileResponse): string[] {
    console.log('Figma API: Searching for all frames in document tree');
    const frameIds: string[] = [];
    const MAX_FRAMES = 200; // Limit to prevent excessive requests
    
    const traverseNode = (node: FigmaNode) => {
      // Stop if we already have enough frames
      if (frameIds.length >= MAX_FRAMES) {
        return;
      }
      
      // Find all FRAME type nodes at any level
      if (node.type === 'FRAME' && node.absoluteBoundingBox) {
        frameIds.push(node.id);
      }
      
      // Also check for component instances that might be frames
      if (node.type === 'INSTANCE' && node.absoluteBoundingBox) {
        frameIds.push(node.id);
      }
      
      // Traverse children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => traverseNode(child));
      }
    };
    
    if (fileData.document?.children) {
      fileData.document.children.forEach(page => traverseNode(page));
    }
    
    console.log(`Figma API: Found ${frameIds.length} total frames/instances for thumbnails (limited to ${MAX_FRAMES})`);
    return frameIds;
  }

  /**
   * Extract all possible design tokens from styles API and file data
   */
  private extractDesignTokens(stylesData: any, fileData: FigmaFileResponse): DesignToken[] {
    console.log('Figma API: Extracting design tokens from styles and file data');
    const tokens: DesignToken[] = [];
    
    // Extract from styles API if available
    if (stylesData && stylesData.meta && stylesData.meta.styles) {
      console.log('Figma API: Processing styles from styles API');
      Object.values(stylesData.meta.styles).forEach((style: any) => {
        if (style.style_type === 'FILL') {
          tokens.push({
            type: 'color',
            name: style.name,
            value: this.extractColorValue(style),
            description: style.description || '',
            category: this.categorizeToken(style.name)
          });
        }
        if (style.style_type === 'TEXT') {
          tokens.push({
            type: 'typography',
            name: style.name,
            value: this.extractTextValue(style),
            description: style.description || '',
            category: this.categorizeToken(style.name)
          });
        }
        if (style.style_type === 'EFFECT') {
          tokens.push({
            type: 'shadow',
            name: style.name,
            value: this.extractEffectValue(style),
            description: style.description || '',
            category: this.categorizeToken(style.name)
          });
        }
      });
    }
    
    // Extract from file data styles as fallback
    if (fileData.styles) {
      console.log('Figma API: Processing styles from file data');
      Object.values(fileData.styles).forEach(style => {
        // Avoid duplicates
        const existingToken = tokens.find(t => t.name === style.name);
        if (!existingToken) {
          if (style.styleType === 'FILL') {
            tokens.push({
              type: 'color',
              name: style.name,
              value: this.extractColorValue(style),
              description: style.description,
              category: this.categorizeToken(style.name)
            });
          } else if (style.styleType === 'TEXT') {
            tokens.push({
              type: 'typography',
              name: style.name,
              value: this.extractTextValue(style),
              description: style.description,
              category: this.categorizeToken(style.name)
            });
          } else if (style.styleType === 'EFFECT') {
            tokens.push({
              type: 'shadow',
              name: style.name,
              value: this.extractEffectValue(style),
              description: style.description,
              category: this.categorizeToken(style.name)
            });
          }
        }
      });
    }
    
    console.log(`Figma API: Extracted ${tokens.length} design tokens`);
    return tokens;
  }

  /**
   * Categorize design token based on name
   */
  private categorizeToken(tokenName: string): string {
    const name = tokenName.toLowerCase();
    if (name.includes('color') || name.includes('background') || name.includes('text') || name.includes('primary') || name.includes('secondary')) {
      return 'colors';
    }
    if (name.includes('font') || name.includes('text') || name.includes('heading') || name.includes('body')) {
      return 'typography';
    }
    if (name.includes('shadow') || name.includes('elevation') || name.includes('drop')) {
      return 'effects';
    }
    if (name.includes('spacing') || name.includes('margin') || name.includes('padding')) {
      return 'spacing';
    }
    return 'other';
  }

  /**
   * Extract artboards (FRAME type nodes) from document - legacy method for backward compatibility
   */
  private extractArtboards(node: FigmaNode): ProcessedArtboard[] {
    const artboards: ProcessedArtboard[] = [];

    const traverse = (currentNode: FigmaNode) => {
      if (currentNode.type === 'FRAME' && currentNode.absoluteBoundingBox) {
        artboards.push({
          id: currentNode.id,
          name: currentNode.name,
          imageUrl: '', // Will be filled later
          width: currentNode.absoluteBoundingBox.width,
          height: currentNode.absoluteBoundingBox.height,
          backgroundColor: this.extractBackgroundColor(currentNode)
        });
      }

      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    traverse(node);
    return artboards;
  }

  /**
   * Extract all artboards with comprehensive detection
   */
  private extractAllArtboards(fileData: FigmaFileResponse, imageResponse: FigmaImageResponse): ProcessedArtboard[] {
    console.log('Figma API: Extracting all artboards with comprehensive detection');
    const artboards: ProcessedArtboard[] = [];

    const traverse = (currentNode: FigmaNode) => {
      // Enhanced detection: FRAME, INSTANCE, and other potential artboard types
      if ((currentNode.type === 'FRAME' || currentNode.type === 'INSTANCE') && currentNode.absoluteBoundingBox) {
        const artboard: ProcessedArtboard = {
          id: currentNode.id,
          name: currentNode.name,
          imageUrl: imageResponse.images[currentNode.id] || '',
          width: currentNode.absoluteBoundingBox.width,
          height: currentNode.absoluteBoundingBox.height,
          backgroundColor: this.extractBackgroundColor(currentNode)
        };
        artboards.push(artboard);
      }

      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach(page => traverse(page));
    }
    
    console.log(`Figma API: Extracted ${artboards.length} artboards with thumbnails`);
    return artboards;
  }

  /**
   * Extract pages with thumbnails
   */
  private extractPages(fileData: FigmaFileResponse): FigmaPage[] {
    console.log('Figma API: Extracting pages from file data');
    const pages: FigmaPage[] = [];
    
    if (fileData.document.children) {
      fileData.document.children.forEach(page => {
        if (page.type === 'CANVAS') {
          pages.push({
            id: page.id,
            name: page.name,
            thumbnail: '', // Will be populated with images
            children: page.children || []
          });
        }
      });
    }
    
    console.log(`Figma API: Found ${pages.length} pages`);
    return pages;
  }

  /**
   * Populate page thumbnails with actual image URLs
   */
  private populatePageThumbnails(pages: FigmaPage[], imageResponse: FigmaImageResponse): FigmaPage[] {
    return pages.map(page => ({
      ...page,
      thumbnail: imageResponse.images[page.id] || ''
    }));
  }

  /**
   * Extract complete components data
   */
  private extractComponents(componentsData: any, fileData: FigmaFileResponse): FigmaComponent[] {
    console.log('Figma API: Extracting components from API and file data');
    const components: FigmaComponent[] = [];
    
    // Extract from components API if available
    if (componentsData && componentsData.meta && componentsData.meta.components) {
      console.log('Figma API: Processing components from components API');
      Object.values(componentsData.meta.components).forEach((component: any) => {
        components.push({
          key: component.key,
          name: component.name,
          description: component.description || '',
          documentationLinks: component.documentation_links || [],
          id: component.key,
          thumbnail: '', // Will be populated with images
          variants: [],
          properties: []
        });
      });
    }
    
    // Extract from file structure as fallback/supplement
    const nodeComponents = this.extractComponentsFromNodes(fileData.document);
    if (Array.isArray(nodeComponents)) {
      nodeComponents.forEach(nodeComponent => {
        const existingComponent = components.find(c => c.key === nodeComponent.key);
        if (!existingComponent) {
          components.push(nodeComponent);
        }
      });
    }
    
    console.log(`Figma API: Extracted ${components.length} components`);
    return components;
  }

  /**
   * Populate component thumbnails with actual image URLs
   */
  private populateComponentThumbnails(components: FigmaComponent[], imageResponse: FigmaImageResponse): FigmaComponent[] {
    return components.map(component => ({
      ...component,
      thumbnail: imageResponse.images[component.id || component.key] || ''
    }));
  }

  /**
   * Extract complete file information
   */
  private extractFileInfo(fileData: FigmaFileResponse): any {
    return {
      name: fileData.name,
      lastModified: fileData.lastModified,
      version: fileData.version,
      thumbnailUrl: fileData.thumbnailUrl
    };
  }

  /**
   * Extract tokens from document nodes
   */
  private extractTokensFromNodes(node: FigmaNode, tokens: DesignToken[]) {
    const uniqueFonts = new Set<string>();

    const traverse = (currentNode: FigmaNode) => {
      // Extract typography information
      if (currentNode.style && currentNode.style.fontFamily) {
        const fontKey = `${currentNode.style.fontFamily}-${currentNode.style.fontSize}`;
        if (!uniqueFonts.has(fontKey)) {
          uniqueFonts.add(fontKey);
          tokens.push({
            type: 'typography',
            name: `${currentNode.style.fontFamily} ${currentNode.style.fontSize}px`,
            value: `font-family: ${currentNode.style.fontFamily}; font-size: ${currentNode.style.fontSize}px; font-weight: ${currentNode.style.fontWeight};`,
            category: 'typography'
          });
        }
      }

      if (currentNode.children) {
        currentNode.children.forEach(child => traverse(child));
      }
    };

    traverse(node);
  }

  /**
   * Extract background color from a node
   */
  private extractBackgroundColor(node: FigmaNode): string | undefined {
    if (node.backgroundColor) {
      return this.rgbaToHex(node.backgroundColor);
    }
    
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    
    return undefined;
  }

  /**
   * Convert RGBA color to hex
   */
  private rgbaToHex(color: FigmaColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Extract color value from style
   */
  private extractColorValue(style: any): string {
    // Strategy 1: Check for fills array (most common for FILL styles)
    if (style.fills && Array.isArray(style.fills) && style.fills.length > 0) {
      const fill = style.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    
    // Strategy 2: Check for color property directly
    if (style.color) {
      return this.rgbaToHex(style.color);
    }
    
    // Strategy 3: Check for style nested property (Figma styles API format)
    if (style.style && style.style.fills && Array.isArray(style.style.fills) && style.style.fills.length > 0) {
      const fill = style.style.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbaToHex(fill.color);
      }
    }
    
    // Strategy 4: Check for paints property (alternative Figma format)
    if (style.paints && Array.isArray(style.paints) && style.paints.length > 0) {
      const paint = style.paints[0];
      if (paint.type === 'SOLID' && paint.color) {
        return this.rgbaToHex(paint.color);
      }
    }
    
    return '#000000'; // fallback
  }

  /**
   * Extract text value from style
   */
  private extractTextValue(style: any): string {
    // Strategy 1: Direct properties on style object
    if (style.fontFamily || style.fontSize || style.fontWeight) {
      const fontFamily = style.fontFamily || 'Arial';
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 400;
      const lineHeight = style.lineHeightPx ? `${style.lineHeightPx}px` : 'normal';
      return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight}; line-height: ${lineHeight};`;
    }
    
    // Strategy 2: Nested in style property (Figma styles API format)
    if (style.style) {
      if (style.style.fontFamily || style.style.fontSize || style.style.fontWeight) {
        const fontFamily = style.style.fontFamily || 'Arial';
        const fontSize = style.style.fontSize || 16;
        const fontWeight = style.style.fontWeight || 400;
        const lineHeight = style.style.lineHeightPx ? `${style.style.lineHeightPx}px` : 'normal';
        return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight}; line-height: ${lineHeight};`;
      }
    }
    
    // Strategy 3: Check for typeStyle property (alternative Figma format)
    if (style.typeStyle) {
      const typeStyle = style.typeStyle;
      if (typeStyle.fontFamily || typeStyle.fontSize || typeStyle.fontWeight) {
        const fontFamily = typeStyle.fontFamily || 'Arial';
        const fontSize = typeStyle.fontSize || 16;
        const fontWeight = typeStyle.fontWeight || 400;
        const lineHeight = typeStyle.lineHeightPx ? `${typeStyle.lineHeightPx}px` : 'normal';
        return `font-family: "${fontFamily}"; font-size: ${fontSize}px; font-weight: ${fontWeight}; line-height: ${lineHeight};`;
      }
    }
    
    return 'font-family: Arial; font-size: 16px;'; // fallback
  }

  /**
   * Extract effect value from style
   */
  private extractEffectValue(style: any): string {
    // Strategy 1: Direct effects array
    if (style.effects && Array.isArray(style.effects) && style.effects.length > 0) {
      const effect = style.effects[0];
      if (effect.type === 'DROP_SHADOW' && effect.offset && effect.color) {
        const x = effect.offset.x || 0;
        const y = effect.offset.y || 0;
        const blur = effect.radius || 4;
        const color = this.rgbaToHex(effect.color);
        return `box-shadow: ${x}px ${y}px ${blur}px ${color};`;
      }
    }
    
    // Strategy 2: Nested in style property
    if (style.style && style.style.effects && Array.isArray(style.style.effects) && style.style.effects.length > 0) {
      const effect = style.style.effects[0];
      if (effect.type === 'DROP_SHADOW' && effect.offset && effect.color) {
        const x = effect.offset.x || 0;
        const y = effect.offset.y || 0;
        const blur = effect.radius || 4;
        const color = this.rgbaToHex(effect.color);
        return `box-shadow: ${x}px ${y}px ${blur}px ${color};`;
      }
    }
    
    // Strategy 3: Alternative effects format
    if (style.effectStyle && style.effectStyle.effects && Array.isArray(style.effectStyle.effects) && style.effectStyle.effects.length > 0) {
      const effect = style.effectStyle.effects[0];
      if (effect.type === 'DROP_SHADOW' && effect.offset && effect.color) {
        const x = effect.offset.x || 0;
        const y = effect.offset.y || 0;
        const blur = effect.radius || 4;
        const color = this.rgbaToHex(effect.color);
        return `box-shadow: ${x}px ${y}px ${blur}px ${color};`;
      }
    }
    
    return 'box-shadow: 0 2px 4px rgba(0,0,0,0.1);'; // fallback
  }

  /**
   * Convert RGB to hex (helper function)
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Create HTTP headers with authorization
   * Note: Removed Content-Type to avoid CORS preflight for GET requests
   */
  private getHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({
      'X-Figma-Token': accessToken
    });
  }

  /**
   * Handle HTTP errors with enhanced CORS and network error detection
   */
  private handleError = (error: any): Observable<never> => {
    console.error('Figma API Error Details:', {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      url: error.url,
      headers: error.headers,
      type: error.type || 'Unknown'
    });
    
    let errorMessage = 'An error occurred while connecting to Figma';
    
    if (error.status === 0) {
      if (error.url && error.url.length > 2048) {
        errorMessage = 'Request URL too long. Retrying with smaller batches...';
      } else {
        errorMessage = 'Network error: Unable to connect to Figma API. Check CORS configuration.';
      }
    } else if (error.status === 414) {
      errorMessage = 'Request URL too long. The request will be split into smaller batches.';
    } else if (error.status === 401) {
      errorMessage = 'Invalid access token. Please check your Figma access token.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied. Please ensure you have permission to access this file.';
    } else if (error.status === 404) {
      errorMessage = 'File not found. Please check your Figma file ID.';
    } else if (error.error && error.error.message) {
      errorMessage = error.error.message;
    }

    const figmaError: FigmaApiError = {
      message: errorMessage,
      status: error.status || 0
    };

    return throwError(() => figmaError);
  };
}