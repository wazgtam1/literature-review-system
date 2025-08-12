// Cloud Storage Integration for Literature Review System
class CloudStorageManager {
    constructor() {
        this.providers = {
            github: new GitHubStorageProvider(),
            gist: new GistStorageProvider(),
            webdav: new WebDAVStorageProvider()
        };
        this.currentProvider = null;
        this.syncEnabled = false;
    }

    // Initialize cloud storage
    async initialize(providerName, config) {
        try {
            const provider = this.providers[providerName];
            if (!provider) {
                throw new Error(`Unknown storage provider: ${providerName}`);
            }
            
            await provider.initialize(config);
            this.currentProvider = provider;
            this.syncEnabled = true;
            
            console.log(`Cloud storage initialized: ${providerName}`);
            return true;
        } catch (error) {
            console.error('Failed to initialize cloud storage:', error);
            return false;
        }
    }

    // Sync data to cloud
    async syncToCloud(data) {
        if (!this.syncEnabled || !this.currentProvider) {
            throw new Error('Cloud storage not initialized');
        }

        try {
            // Prepare data for cloud storage (remove binary data, keep metadata)
            const cloudData = this.prepareDataForCloud(data);
            
            const result = await this.currentProvider.save(cloudData);
            console.log('Data synced to cloud successfully');
            return result;
        } catch (error) {
            console.error('Failed to sync to cloud:', error);
            throw error;
        }
    }

    // Load data from cloud
    async loadFromCloud() {
        if (!this.syncEnabled || !this.currentProvider) {
            throw new Error('Cloud storage not initialized');
        }

        try {
            const cloudData = await this.currentProvider.load();
            console.log('Data loaded from cloud successfully');
            return cloudData;
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            throw error;
        }
    }

    // Prepare data for cloud storage (remove large files, keep metadata)
    prepareDataForCloud(data) {
        const cloudData = {
            version: '1.0',
            syncDate: new Date().toISOString(),
            papers: data.papers.map(paper => ({
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
                // Exclude: pdfFile, pdfUrl, thumbnail (binary data)
                hasFile: !!paper.pdfFile || !!paper.pdfUrl,
                hasThumbnail: !!paper.thumbnail
            }))
        };
        return cloudData;
    }

    // Merge cloud data with local data
    mergeWithLocalData(cloudData, localPapers) {
        const mergedPapers = [...localPapers];
        
        if (cloudData && cloudData.papers) {
            cloudData.papers.forEach(cloudPaper => {
                const localIndex = mergedPapers.findIndex(p => p.id === cloudPaper.id);
                
                if (localIndex >= 0) {
                    // Update existing paper (keep local files)
                    const localPaper = mergedPapers[localIndex];
                    mergedPapers[localIndex] = {
                        ...cloudPaper,
                        pdfFile: localPaper.pdfFile,
                        pdfUrl: localPaper.pdfUrl,
                        thumbnail: localPaper.thumbnail
                    };
                } else {
                    // Add new paper from cloud
                    mergedPapers.push(cloudPaper);
                }
            });
        }
        
        return mergedPapers;
    }
}

// GitHub Repository Storage Provider
class GitHubStorageProvider {
    constructor() {
        this.apiBase = 'https://api.github.com';
        this.token = null;
        this.repo = null;
        this.owner = null;
        this.filePath = 'literature-data.json';
    }

    async initialize(config) {
        this.token = config.token;
        this.owner = config.owner;
        this.repo = config.repo;
        
        // Test connection
        await this.testConnection();
    }

    async testConnection() {
        const response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}`, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API test failed: ${response.status}`);
        }
    }

    async save(data) {
        try {
            // Get current file SHA if exists
            let sha = null;
            try {
                const currentFile = await this.load();
                if (currentFile && currentFile._sha) {
                    sha = currentFile._sha;
                }
            } catch (error) {
                // File doesn't exist, that's okay
            }

            const content = btoa(JSON.stringify(data, null, 2));
            
            const body = {
                message: `Update literature data - ${new Date().toISOString()}`,
                content: content,
                branch: 'main'
            };
            
            if (sha) {
                body.sha = sha;
            }

            const response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`GitHub save failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub save error:', error);
            throw error;
        }
    }

    async load() {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null; // File doesn't exist
                }
                throw new Error(`GitHub load failed: ${response.status}`);
            }

            const fileData = await response.json();
            const content = atob(fileData.content.replace(/\n/g, ''));
            const data = JSON.parse(content);
            
            // Store SHA for future updates
            data._sha = fileData.sha;
            
            return data;
        } catch (error) {
            console.error('GitHub load error:', error);
            throw error;
        }
    }
}

// GitHub Gist Storage Provider (simpler alternative)
class GistStorageProvider {
    constructor() {
        this.apiBase = 'https://api.github.com';
        this.token = null;
        this.gistId = null;
        this.fileName = 'literature-data.json';
    }

    async initialize(config) {
        this.token = config.token;
        this.gistId = config.gistId;
        
        if (!this.gistId) {
            // Create new gist
            this.gistId = await this.createGist();
        }
    }

    async createGist() {
        const response = await fetch(`${this.apiBase}/gists`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Literature Review Data Storage',
                public: false,
                files: {
                    [this.fileName]: {
                        content: JSON.stringify({
                            version: '1.0',
                            papers: [],
                            created: new Date().toISOString()
                        }, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create gist: ${response.status}`);
        }

        const gist = await response.json();
        return gist.id;
    }

    async save(data) {
        const response = await fetch(`${this.apiBase}/gists/${this.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [this.fileName]: {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gist save failed: ${response.status}`);
        }

        return await response.json();
    }

    async load() {
        const response = await fetch(`${this.apiBase}/gists/${this.gistId}`, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`Gist load failed: ${response.status}`);
        }

        const gist = await response.json();
        const content = gist.files[this.fileName].content;
        return JSON.parse(content);
    }
}

// WebDAV Storage Provider (for services like Nextcloud, OneDrive, etc.)
class WebDAVStorageProvider {
    constructor() {
        this.baseUrl = null;
        this.username = null;
        this.password = null;
        this.filePath = 'literature-data.json';
    }

    async initialize(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.username = config.username;
        this.password = config.password;
        
        // Test connection
        await this.testConnection();
    }

    async testConnection() {
        const response = await fetch(this.baseUrl, {
            method: 'PROPFIND',
            headers: {
                'Authorization': `Basic ${btoa(`${this.username}:${this.password}`)}`,
                'Depth': '0'
            }
        });

        if (!response.ok) {
            throw new Error(`WebDAV connection failed: ${response.status}`);
        }
    }

    async save(data) {
        const response = await fetch(`${this.baseUrl}/${this.filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${btoa(`${this.username}:${this.password}`)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data, null, 2)
        });

        if (!response.ok) {
            throw new Error(`WebDAV save failed: ${response.status}`);
        }

        return { success: true, status: response.status };
    }

    async load() {
        const response = await fetch(`${this.baseUrl}/${this.filePath}`, {
            headers: {
                'Authorization': `Basic ${btoa(`${this.username}:${this.password}`)}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // File doesn't exist
            }
            throw new Error(`WebDAV load failed: ${response.status}`);
        }

        return await response.json();
    }
}

// Export for use in main application
window.CloudStorageManager = CloudStorageManager;