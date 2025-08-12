// Static Data Export Tool for GitHub Pages Deployment
class StaticDataExporter {
    constructor(literatureManager) {
        this.literatureManager = literatureManager;
    }

    // Export all data to static JSON files (with GitHub Releases support)
    async exportToStaticFiles(options = {}) {
        try {
            console.log('Starting static data export...');
            
            // 1. Export papers metadata
            const papersData = await this.exportPapersMetadata();
            
            // 2. Export thumbnails as base64
            const thumbnailsData = await this.exportThumbnails();
            
            // 3. Create index file for fast loading
            const indexData = this.createIndexFile(papersData);
            
            // 4. Export each paper's full data (with PDF handling options)
            const paperFiles = await this.exportIndividualPapers(options);
            
            // 5. Create PDF files list for GitHub Releases upload
            const pdfFiles = await this.preparePDFFilesForRelease();
            
            // 6. Create deployment structure
            const deploymentFiles = {
                'data/index.json': indexData,
                'data/papers.json': papersData,
                'data/thumbnails.json': thumbnailsData,
                ...paperFiles
            };
            
            console.log('Static export completed successfully');
            return {
                jsonFiles: deploymentFiles,
                pdfFiles: pdfFiles,
                releaseInfo: this.generateReleaseInfo()
            };
            
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

    // Export individual papers with full data (GitHub Releases optimized)
    async exportIndividualPapers(options = {}) {
        const paperFiles = {};
        
        for (const paper of this.literatureManager.papers) {
            try {
                const paperData = { ...paper };
                
                console.log(`Processing paper ${paper.id}: title="${paper.title}"`);
                console.log(`Paper has pdfFile:`, !!paper.pdfFile);
                console.log(`Storage available:`, !!(this.literatureManager.storage && this.literatureManager.storage.db));
                
                if (paper.pdfFile || (this.literatureManager.storage && this.literatureManager.storage.db)) {
                    try {
                        // For GitHub Releases, we store PDF reference instead of base64
                        if (options.useGitHubReleases) {
                            const pdfFileName = `${paper.id}.pdf`;
                            paperData.pdfUrl = `https://cdn.jsdelivr.net/gh/${options.repoOwner}/${options.repoName}@${options.releaseTag}/${pdfFileName}`;
                            paperData.originalFileName = this.getPdfFileName(paper);
                            paperData.hasFile = true;
                            console.log(`✅ Set jsDelivr CDN URL for paper ${paper.id}`);
                        } else {
                            // Fallback: convert to base64 (original behavior)
                            let pdfData = null;
                            
                            if (paper.pdfFile) {
                                console.log(`Converting pdfFile to base64 for paper ${paper.id}`);
                                pdfData = await this.fileToBase64(paper.pdfFile);
                            } else if (this.literatureManager.storage && this.literatureManager.storage.db) {
                                console.log(`Getting PDF from IndexedDB for paper ${paper.id}`);
                                const pdfFile = await this.literatureManager.storage.getPDFFile(paper.id);
                                console.log(`Retrieved PDF from IndexedDB:`, !!pdfFile, pdfFile ? `size: ${pdfFile.blob?.size || 'unknown'}` : '');
                                if (pdfFile && pdfFile.blob) {
                                    pdfData = await this.blobToBase64(pdfFile.blob);
                                    paperData.originalFileName = pdfFile.fileName;
                                    console.log(`Converted PDF to base64, length: ${pdfData?.length || 'unknown'}`);
                                }
                            }
                            
                            if (pdfData) {
                                paperData.pdfBase64 = pdfData;
                                paperData.hasFile = true;
                                console.log(`✅ Successfully added PDF data for paper ${paper.id}`);
                            } else {
                                console.log(`❌ No PDF data found for paper ${paper.id}`);
                            }
                        }
                        
                    } catch (error) {
                        console.warn(`Failed to process PDF for paper ${paper.id}:`, error);
                        paperData.hasFile = false;
                    }
                } else {
                    console.log(`⚠️ No PDF source available for paper ${paper.id}`);
                }
                
                // Clean up non-serializable data
                delete paperData.pdfFile;
                if (options.useGitHubReleases) {
                    delete paperData.pdfBase64; // Don't include base64 when using CDN
                } else {
                    delete paperData.pdfUrl; // Don't include URL when using base64
                }
                
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

    // Prepare PDF files for GitHub Releases upload
    async preparePDFFilesForRelease() {
        const pdfFiles = [];
        
        for (const paper of this.literatureManager.papers) {
            try {
                let pdfBlob = null;
                let fileName = `${paper.id}.pdf`;
                
                if (paper.pdfFile) {
                    pdfBlob = paper.pdfFile;
                    fileName = this.getPdfFileName(paper) || fileName;
                } else if (this.literatureManager.storage && this.literatureManager.storage.db) {
                    const pdfFile = await this.literatureManager.storage.getPDFFile(paper.id);
                    if (pdfFile && pdfFile.blob) {
                        pdfBlob = pdfFile.blob;
                        fileName = pdfFile.fileName || fileName;
                    }
                }
                
                if (pdfBlob) {
                    pdfFiles.push({
                        paperId: paper.id,
                        fileName: fileName,
                        standardFileName: `${paper.id}.pdf`, // Standard name for CDN
                        blob: pdfBlob,
                        size: pdfBlob.size
                    });
                }
                
            } catch (error) {
                console.warn(`Failed to prepare PDF for paper ${paper.id}:`, error);
            }
        }
        
        return pdfFiles;
    }

    // Generate release information
    generateReleaseInfo() {
        const now = new Date();
        const version = `v${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;
        
        return {
            tag: version,
            name: `Literature Data Release ${version}`,
            body: `Automated release of literature review data\n\n` +
                  `- Export date: ${now.toISOString()}\n` +
                  `- Total papers: ${this.literatureManager.papers.length}\n` +
                  `- Contains JSON metadata and PDF files\n\n` +
                  `Access via jsDelivr CDN: https://cdn.jsdelivr.net/gh/[owner]/[repo]@${version}/`,
            draft: false,
            prerelease: false
        };
    }

    // Helper: Get PDF filename from paper
    getPdfFileName(paper) {
        if (paper.pdfFile && paper.pdfFile.name) {
            return paper.pdfFile.name;
        }
        if (paper.originalFileName) {
            return paper.originalFileName;
        }
        return `${paper.title?.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) || paper.id}.pdf`;
    }

    // Download all files as ZIP (updated for GitHub Releases)
    async downloadAsZip(options = {}) {
        if (typeof JSZip === 'undefined') {
            alert('JSZip library is required for ZIP download. Please include it in your HTML.');
            return;
        }

        try {
            const exportResult = await this.exportToStaticFiles(options);
            const zip = new JSZip();
            
            // Add JSON files
            Object.entries(exportResult.jsonFiles).forEach(([path, data]) => {
                const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                zip.file(path, content);
            });
            
            // Add PDF files (if not using GitHub Releases)
            if (!options.useGitHubReleases && exportResult.pdfFiles) {
                exportResult.pdfFiles.forEach(pdfFile => {
                    zip.file(`pdfs/${pdfFile.standardFileName}`, pdfFile.blob);
                });
            }
            
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
            return exportResult;
            
        } catch (error) {
            console.error('Failed to create ZIP:', error);
            alert('Failed to create ZIP file. Check console for details.');
            throw error;
        }
    }

    // Export for GitHub Releases (main method)
    async exportForGitHubReleases(options = {}) {
        const finalOptions = {
            useGitHubReleases: true,
            repoOwner: options.repoOwner || 'your-username',
            repoName: options.repoName || 'your-repo',
            releaseTag: null, // Will be auto-generated
            ...options
        };
        
        const exportResult = await this.exportToStaticFiles(finalOptions);
        
        // Auto-generate release tag if not provided
        if (!finalOptions.releaseTag) {
            finalOptions.releaseTag = exportResult.releaseInfo.tag;
            
            // Update PDF URLs with the correct tag
            const updatedJsonFiles = {};
            Object.entries(exportResult.jsonFiles).forEach(([path, data]) => {
                if (path.includes('papers/') && path.endsWith('.json')) {
                    const paperData = { ...data };
                    if (paperData.pdfUrl) {
                        paperData.pdfUrl = paperData.pdfUrl.replace('@undefined', `@${finalOptions.releaseTag}`);
                    }
                    updatedJsonFiles[path] = paperData;
                } else {
                    updatedJsonFiles[path] = data;
                }
            });
            exportResult.jsonFiles = updatedJsonFiles;
        }
        
        return {
            ...exportResult,
            options: finalOptions,
            instructions: this.generateUploadInstructions(finalOptions, exportResult)
        };
    }
    
    // Generate instructions for GitHub upload
    generateUploadInstructions(options, exportResult) {
        return {
            steps: [
                '1. Create a new release on GitHub:',
                `   - Tag: ${options.releaseTag || exportResult.releaseInfo.tag}`,
                `   - Title: ${exportResult.releaseInfo.name}`,
                `   - Description: ${exportResult.releaseInfo.body}`,
                '',
                '2. Upload PDF files to the release:',
                ...exportResult.pdfFiles.map(pdf => `   - ${pdf.standardFileName}`),
                '',
                '3. Update your repository with JSON files:',
                ...Object.keys(exportResult.jsonFiles).map(path => `   - ${path}`),
                '',
                '4. Your PDFs will be available via jsDelivr CDN:',
                `   https://cdn.jsdelivr.net/gh/${options.repoOwner}/${options.repoName}@${options.releaseTag}/[filename].pdf`
            ],
            pdfCount: exportResult.pdfFiles.length,
            jsonFileCount: Object.keys(exportResult.jsonFiles).length
        };
    }

    // Save individual files (updated)
    async downloadIndividualFiles(options = {}) {
        try {
            const exportResult = await this.exportToStaticFiles(options);
            
            // Download JSON files
            Object.entries(exportResult.jsonFiles).forEach(([path, data]) => {
                const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = path.replace(/\//g, '_');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
            });
            
            // Download PDF files separately (if available)
            if (exportResult.pdfFiles) {
                exportResult.pdfFiles.forEach(pdfFile => {
                    const url = URL.createObjectURL(pdfFile.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = pdfFile.standardFileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }
            
            console.log('All static files downloaded successfully');
            return exportResult;
            
        } catch (error) {
            console.error('Failed to download files:', error);
            alert('Failed to download files. Check console for details.');
            throw error;
        }
    }
}

// Export for use in main application
window.StaticDataExporter = StaticDataExporter;