// Static Data Export Tool for GitHub Pages Deployment
class StaticDataExporter {
    constructor(literatureManager) {
        this.literatureManager = literatureManager;
    }

    // Export all data to static JSON files
    async exportToStaticFiles() {
        try {
            console.log('Starting static data export...');
            
            // 1. Export papers metadata
            const papersData = await this.exportPapersMetadata();
            
            // 2. Export thumbnails as base64
            const thumbnailsData = await this.exportThumbnails();
            
            // 3. Create index file for fast loading
            const indexData = this.createIndexFile(papersData);
            
            // 4. Export each paper's full data (including PDF as base64)
            const paperFiles = await this.exportIndividualPapers();
            
            // 5. Create deployment structure
            const deploymentFiles = {
                'data/index.json': indexData,
                'data/papers.json': papersData,
                'data/thumbnails.json': thumbnailsData,
                ...paperFiles
            };
            
            console.log('Static export completed successfully');
            return deploymentFiles;
            
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    // Export papers metadata (without large binary data)
    async exportPapersMetadata() {
        const papers = this.literatureManager.papers.map(paper => ({
            id: paper.id,
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            venue: paper.venue,
            researchArea: paper.researchArea,
            keywords: paper.keywords,
            citations: paper.citations,
            abstract: paper.abstract,
            doi: paper.doi,
            url: paper.url,
            notes: paper.notes,
            tags: paper.tags,
            dateAdded: paper.dateAdded,
            hasFile: !!(paper.pdfFile || paper.pdfUrl),
            hasThumbnail: !!paper.thumbnail,
            // Add file info for static loading
            dataFile: `papers/${paper.id}.json`
        }));

        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalPapers: papers.length,
            papers: papers
        };
    }

    // Export thumbnails separately
    async exportThumbnails() {
        const thumbnails = {};
        
        for (const paper of this.literatureManager.papers) {
            if (paper.thumbnail) {
                thumbnails[paper.id] = paper.thumbnail;
            } else if (this.literatureManager.storage && this.literatureManager.storage.db) {
                // Try to get thumbnail from IndexedDB
                try {
                    const thumbnail = await this.literatureManager.storage.getThumbnail(paper.id);
                    if (thumbnail) {
                        thumbnails[paper.id] = thumbnail;
                    }
                } catch (error) {
                    console.warn(`Failed to get thumbnail for paper ${paper.id}:`, error);
                }
            }
        }

        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            thumbnails: thumbnails
        };
    }

    // Create index file for fast loading
    createIndexFile(papersData) {
        // Create category index
        const categories = {};
        const years = new Set();
        const venues = new Set();
        const keywords = new Set();

        papersData.papers.forEach(paper => {
            // Research areas
            if (paper.researchArea) {
                if (!categories[paper.researchArea]) {
                    categories[paper.researchArea] = [];
                }
                categories[paper.researchArea].push(paper.id);
            }

            // Years
            if (paper.year) {
                years.add(paper.year);
            }

            // Venues
            if (paper.venue) {
                venues.add(paper.venue);
            }

            // Keywords
            if (paper.keywords && Array.isArray(paper.keywords)) {
                paper.keywords.forEach(keyword => keywords.add(keyword));
            }
        });

        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalPapers: papersData.papers.length,
            categories: categories,
            years: Array.from(years).sort((a, b) => b - a),
            venues: Array.from(venues).sort(),
            keywords: Array.from(keywords).sort(),
            dataFiles: {
                papers: 'papers.json',
                thumbnails: 'thumbnails.json'
            }
        };
    }

    // Export individual papers with full data
    async exportIndividualPapers() {
        const paperFiles = {};
        
        for (const paper of this.literatureManager.papers) {
            try {
                const paperData = { ...paper };
                
                // Convert PDF to base64 if available
                if (paper.pdfFile || (this.literatureManager.storage && this.literatureManager.storage.db)) {
                    try {
                        let pdfData = null;
                        
                        if (paper.pdfFile) {
                            // Convert File to base64
                            pdfData = await this.fileToBase64(paper.pdfFile);
                        } else if (this.literatureManager.storage && this.literatureManager.storage.db) {
                            // Get PDF from IndexedDB
                            const pdfFile = await this.literatureManager.storage.getPDFFile(paper.id);
                            if (pdfFile && pdfFile.blob) {
                                pdfData = await this.blobToBase64(pdfFile.blob);
                                paperData.originalFileName = pdfFile.fileName;
                            }
                        }
                        
                        if (pdfData) {
                            paperData.pdfBase64 = pdfData;
                            paperData.hasFile = true;
                        }
                        
                    } catch (error) {
                        console.warn(`Failed to convert PDF for paper ${paper.id}:`, error);
                        paperData.hasFile = false;
                    }
                }
                
                // Clean up non-serializable data
                delete paperData.pdfFile;
                delete paperData.pdfUrl;
                
                paperFiles[`data/papers/${paper.id}.json`] = paperData;
                
            } catch (error) {
                console.warn(`Failed to export paper ${paper.id}:`, error);
            }
        }
        
        return paperFiles;
    }

    // Convert File to base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Convert Blob to base64
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Download all files as ZIP
    async downloadAsZip() {
        // Note: You'll need to include JSZip library for this to work
        if (typeof JSZip === 'undefined') {
            alert('JSZip library is required for ZIP download. Please include it in your HTML.');
            return;
        }

        try {
            const files = await this.exportToStaticFiles();
            const zip = new JSZip();
            
            // Add all files to ZIP
            Object.entries(files).forEach(([path, data]) => {
                const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                zip.file(path, content);
            });
            
            // Generate and download ZIP
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `literature-data-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log('Static data ZIP downloaded successfully');
            
        } catch (error) {
            console.error('Failed to create ZIP:', error);
            alert('Failed to create ZIP file. Check console for details.');
        }
    }

    // Save individual files (for manual download)
    async downloadIndividualFiles() {
        try {
            const files = await this.exportToStaticFiles();
            
            // Download each file individually
            Object.entries(files).forEach(([path, data]) => {
                const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = path.replace(/\//g, '_'); // Replace slashes with underscores
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
            });
            
            console.log('All static files downloaded successfully');
            
        } catch (error) {
            console.error('Failed to download files:', error);
            alert('Failed to download files. Check console for details.');
        }
    }
}

// Export for use in main application
window.StaticDataExporter = StaticDataExporter;