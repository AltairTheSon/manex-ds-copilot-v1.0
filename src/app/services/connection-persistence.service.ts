import { Injectable } from '@angular/core';
import { StoredConnection, FigmaCredentials, MCPCredentials } from '../interfaces/figma.interface';

@Injectable({
  providedIn: 'root'
})
export class ConnectionPersistenceService {
  private readonly STORAGE_KEY = 'figma-ds-copilot-connection';
  private readonly ENCRYPTION_KEY = 'figma-ds-copilot-encrypt';

  constructor() {}

  /**
   * Store connection state securely in localStorage
   */
  storeConnection(connection: StoredConnection): void {
    try {
      const encryptedData = this.encryptData(JSON.stringify(connection));
      localStorage.setItem(this.STORAGE_KEY, encryptedData);
    } catch (error) {
      console.error('Failed to store connection:', error);
    }
  }

  /**
   * Retrieve stored connection from localStorage
   */
  getStoredConnection(): StoredConnection | null {
    try {
      const encryptedData = localStorage.getItem(this.STORAGE_KEY);
      if (!encryptedData) {
        return null;
      }
      
      const decryptedData = this.decryptData(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Failed to retrieve stored connection:', error);
      this.clearStoredConnection(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Clear stored connection
   */
  clearStoredConnection(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear stored connection:', error);
    }
  }

  /**
   * Check if stored connection exists and is valid
   */
  hasValidStoredConnection(): boolean {
    const connection = this.getStoredConnection();
    if (!connection) {
      return false;
    }

    // Check if connection is not too old (e.g., 7 days)
    const lastConnected = new Date(connection.lastConnected);
    const now = new Date();
    const daysDiff = (now.getTime() - lastConnected.getTime()) / (1000 * 3600 * 24);
    
    return connection.isValid && daysDiff < 7;
  }

  /**
   * Update connection validity status
   */
  updateConnectionValidity(isValid: boolean): void {
    const connection = this.getStoredConnection();
    if (connection) {
      connection.isValid = isValid;
      if (!isValid) {
        connection.lastConnected = new Date().toISOString();
      }
      this.storeConnection(connection);
    }
  }

  /**
   * Create StoredConnection object from credentials and file info
   */
  createStoredConnection(
    connectionType: 'figma' | 'mcp',
    credentials: FigmaCredentials | MCPCredentials,
    fileInfo: { name: string; lastModified: string; version: string }
  ): StoredConnection {
    return {
      connectionType,
      credentials,
      fileInfo,
      lastConnected: new Date().toISOString(),
      isValid: true
    };
  }

  /**
   * Simple encryption using base64 and XOR (not production-grade, but better than plain text)
   */
  private encryptData(data: string): string {
    const key = this.ENCRYPTION_KEY;
    let encrypted = '';
    
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    
    return btoa(encrypted);
  }

  /**
   * Decrypt data
   */
  private decryptData(encryptedData: string): string {
    const key = this.ENCRYPTION_KEY;
    const data = atob(encryptedData);
    let decrypted = '';
    
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    
    return decrypted;
  }
}