// Static Data Loader for GitHub Pages Deployment
class StaticDataLoader {
    constructor() {
        this.baseUrl = './data/'; // Relative path to data folder
        this.cache = new Map();
        this.indexData = null;
        this.papersData = null;
        this.thumbnailsData = null;
    }

    // Initialize by loading index and basic data
    async initialize() {
        try {
            console.log('Loading static data...');
            
            // Load index first
            this.indexData = await this.loadJSON('index.json');
            console.log(`Found ${this.indexData.totalPapers} papers in static data`);
            
            // Load papers metadata
            this.papersData = await this.loadJSON('papers.json');
            console.log('Papers metadata loaded');
            
            // Load thumbnails
            this.thumbnailsData = await this.loadJSON('thumbnails.json');
            console.log('Thumbnails loaded');
            
            return true;
            
        } catch (error) {
            console.error('Failed to initialize static data:', error);
            return false;
        }
    }

    // Get all papers (metadata only)
    getAllPapers() {
        return this.papersData ? this.papersData.papers : [];
    }

    // Get paper thumbnail
    getThumbnail(paperId) {
        if (!this.thumbnailsData || !this.thumbnailsData.thumbnails) {
            return null;
        }
        return this.thumbnailsData.thumbnails[paperId] || null;
    }

    // Get full paper data including PDF
    async getPaperData(paperId) {
        try {
            // Check cache first
            if (this.cache.has(paperId)) {
                return this.cache.get(paperId);
            }
            
            // Load paper data
            const paperData = await this.loadJSON(`papers/${paperId}.json`);
            
            // Handle different PDF storage formats
            if (paperData.pdfBase64) {
                try {
                    // Convert base64 to blob (legacy support)
                    const response = await fetch(paperData.pdfBase64);
                    const blob = await response.blob();
                    paperData.pdfUrl = URL.createObjectURL(blob);
                    paperData.pdfBlob = blob;
                    
                    // Clean up base64 data to save memory
                    delete paperData.pdfBase64;
                    
                } catch (error) {
                    console.warn(`Failed to convert PDF for paper ${paperId}:`, error);
                }
            } else if (paperData.pdfUrl && paperData.pdfUrl.startsWith('https://cdn.jsdelivr.net/')) {
                // PDF is hosted on jsDelivr CDN - no conversion needed
                console.log(`Paper ${paperId} uses CDN PDF: ${paperData.pdfUrl}`);
            }
            
            // Cache the result
            this.cache.set(paperId, paperData);
            
            return paperData;
            
        } catch (error) {
            console.error(`Failed to load paper data for ${paperId}:`, error);
            return null;
        }
    }

    // Get papers by category
    getPapersByCategory(category) {
        if (!this.indexData || !this.indexData.categories) {
            return [];
        }
        
        const paperIds = this.indexData.categories[category] || [];
        return this.getAllPapers().filter(paper => paperIds.includes(paper.id));
    }

    // Get papers by year
    getPapersByYear(year) {
        return this.getAllPapers().filter(paper => paper.year === year);
    }

    // Get papers by venue
    getPapersByVenue(venue) {
        return this.getAllPapers().filter(paper => paper.venue === venue);
    }

    // Search papers
    searchPapers(query) {
        const papers = this.getAllPapers();
        const searchTerm = query.toLowerCase();
        
        return papers.filter(paper => {
            return (
                paper.title?.toLowerCase().includes(searchTerm) ||
                paper.authors?.toLowerCase().includes(searchTerm) ||
                paper.abstract?.toLowerCase().includes(searchTerm) ||
                paper.keywords?.some(keyword => keyword.toLowerCase().includes(searchTerm)) ||
                paper.venue?.toLowerCase().includes(searchTerm)
            );
        });
    }

    // Get available categories
    getCategories() {
        if (!this.indexData || !this.indexData.categories) {
            return [];
        }
        return Object.keys(this.indexData.categories).sort();
    }

    // Get available years
    getYears() {
        return this.indexData ? this.indexData.years : [];
    }

    // Get available venues
    getVenues() {
        return this.indexData ? this.indexData.venues : [];
    }

    // Get available keywords
    getKeywords() {
        return this.indexData ? this.indexData.keywords : [];
    }

    // Get statistics
    getStatistics() {
        const papers = this.getAllPapers();
        
        return {
            totalPapers: papers.length,
            totalWithFiles: papers.filter(p => p.hasFile).length,
            totalWithThumbnails: papers.filter(p => p.hasThumbnail).length,
            categoryCounts: this.getCategoryCounts(),
            yearCounts: this.getYearCounts(),
            venueCounts: this.getVenueCounts()
        };
    }

    // Get category counts
    getCategoryCounts() {
        const papers = this.getAllPapers();
        const counts = {};
        
        papers.forEach(paper => {
            if (paper.researchArea) {
                counts[paper.researchArea] = (counts[paper.researchArea] || 0) + 1;
            }
        });
        
        return counts;
    }

    // Get year counts
    getYearCounts() {
        const papers = this.getAllPapers();
        const counts = {};
        
        papers.forEach(paper => {
            if (paper.year) {
                counts[paper.year] = (counts[paper.year] || 0) + 1;
            }
        });
        
        return counts;
    }

    // Get venue counts
    getVenueCounts() {
        const papers = this.getAllPapers();
        const counts = {};
        
        papers.forEach(paper => {
            if (paper.venue) {
                counts[paper.venue] = (counts[paper.venue] || 0) + 1;
            }
        });
        
        return counts;
    }

    // Preload frequently accessed papers
    async preloadPapers(paperIds) {
        const promises = paperIds.map(id => this.getPaperData(id));
        await Promise.allSettled(promises);
        console.log(`Preloaded ${paperIds.length} papers`);
    }

    // Clear cache to free memory
    clearCache() {
        // Clean up blob URLs to prevent memory leaks
        this.cache.forEach(paperData => {
            if (paperData.pdfUrl && paperData.pdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(paperData.pdfUrl);
            }
        });
        
        this.cache.clear();
        console.log('Cache cleared');
    }

    // Utility method to load JSON files
    async loadJSON(filename) {
        try {
            const response = await fetch(this.baseUrl + filename);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
            throw error;
        }
    }

    // Check if static data is available
    async checkDataAvailability() {
        try {
            const response = await fetch(this.baseUrl + 'index.json');
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Export for use in main application
window.StaticDataLoader = StaticDataLoader;