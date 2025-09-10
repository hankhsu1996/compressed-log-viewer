import { CompressionProvider } from './CompressionProvider';

/**
 * Registry for managing compression providers
 * Maps file extensions to appropriate compression providers
 */
export class ProviderRegistry {
  private providers: CompressionProvider[] = [];
  private extensionMap: Map<string, CompressionProvider> = new Map();

  /**
   * Register a compression provider
   */
  register(provider: CompressionProvider): void {
    this.providers.push(provider);
    
    // Map all supported extensions to this provider
    const format = provider.getFormat();
    for (const extension of format.extensions) {
      this.extensionMap.set(extension.toLowerCase(), provider);
    }
  }

  /**
   * Get provider for a given file path
   */
  getProvider(filePath: string): CompressionProvider | null {
    const lowerPath = filePath.toLowerCase();
    
    // Check extensions in order of specificity (longer extensions first)
    const extensions = Array.from(this.extensionMap.keys())
      .sort((a, b) => b.length - a.length);
    
    for (const extension of extensions) {
      if (lowerPath.endsWith(extension)) {
        return this.extensionMap.get(extension) || null;
      }
    }
    
    return null;
  }

  /**
   * Check if any provider supports the given file path
   */
  supportsFile(filePath: string): boolean {
    return this.getProvider(filePath) !== null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): CompressionProvider[] {
    return [...this.providers];
  }

  /**
   * Get all supported file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Get all URI schemes used by registered providers
   */
  getSchemes(): string[] {
    return this.providers.map(provider => provider.getFormat().scheme);
  }
}