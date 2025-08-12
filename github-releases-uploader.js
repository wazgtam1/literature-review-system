// GitHub Releases Uploader for Literature Review System
class GitHubReleasesUploader {
    constructor(options = {}) {
        this.repoOwner = options.repoOwner;
        this.repoName = options.repoName;
        this.token = options.token;
        this.apiBase = 'https://api.github.com';
    }

    // Create a new release
    async createRelease(releaseInfo) {
        if (!this.token) {
            throw new Error('GitHub token is required for creating releases');
        }

        const response = await fetch(`${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/releases`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(releaseInfo)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create release: ${error.message}`);
        }

        return await response.json();
    }

    // Upload an asset to a release
    async uploadAsset(releaseId, fileName, fileBlob) {
        if (!this.token) {
            throw new Error('GitHub token is required for uploading assets');
        }

        const uploadUrl = `https://uploads.github.com/repos/${this.repoOwner}/${this.repoName}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/octet-stream',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: fileBlob
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to upload asset ${fileName}: ${error.message}`);
        }

        return await response.json();
    }

    // Upload multiple PDF files to a release
    async uploadPDFs(releaseId, pdfFiles, onProgress = null) {
        const results = [];
        
        for (let i = 0; i < pdfFiles.length; i++) {
            const pdfFile = pdfFiles[i];
            
            try {
                console.log(`Uploading ${pdfFile.standardFileName} (${i + 1}/${pdfFiles.length})`);
                
                const result = await this.uploadAsset(releaseId, pdfFile.standardFileName, pdfFile.blob);
                results.push({
                    success: true,
                    fileName: pdfFile.standardFileName,
                    paperId: pdfFile.paperId,
                    downloadUrl: result.browser_download_url,
                    cdnUrl: `https://cdn.jsdelivr.net/gh/${this.repoOwner}/${this.repoName}@${result.tag_name || 'latest'}/${pdfFile.standardFileName}`
                });

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: pdfFiles.length,
                        fileName: pdfFile.standardFileName,
                        status: 'uploaded'
                    });
                }

            } catch (error) {
                console.error(`Failed to upload ${pdfFile.standardFileName}:`, error);
                results.push({
                    success: false,
                    fileName: pdfFile.standardFileName,
                    paperId: pdfFile.paperId,
                    error: error.message
                });

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: pdfFiles.length,
                        fileName: pdfFile.standardFileName,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    // Complete workflow: create release and upload PDFs
    async deployToGitHubReleases(exportResult, onProgress = null) {
        try {
            // Step 1: Create release
            console.log('Creating GitHub release...');
            if (onProgress) {
                onProgress({ step: 'creating_release', message: 'Creating GitHub release...' });
            }

            const release = await this.createRelease(exportResult.releaseInfo);
            console.log(`Created release: ${release.name} (${release.tag_name})`);

            // Step 2: Upload PDF files
            if (exportResult.pdfFiles && exportResult.pdfFiles.length > 0) {
                console.log(`Uploading ${exportResult.pdfFiles.length} PDF files...`);
                if (onProgress) {
                    onProgress({ step: 'uploading_pdfs', message: `Uploading ${exportResult.pdfFiles.length} PDF files...` });
                }

                const uploadResults = await this.uploadPDFs(release.id, exportResult.pdfFiles, (progress) => {
                    if (onProgress) {
                        onProgress({
                            step: 'uploading_pdfs',
                            ...progress
                        });
                    }
                });

                // Update JSON files with correct CDN URLs
                const updatedJsonFiles = this.updateCDNUrls(exportResult.jsonFiles, release.tag_name, uploadResults);

                return {
                    success: true,
                    release: release,
                    uploadResults: uploadResults,
                    jsonFiles: updatedJsonFiles,
                    cdnBaseUrl: `https://cdn.jsdelivr.net/gh/${this.repoOwner}/${this.repoName}@${release.tag_name}/`,
                    instructions: this.generateDeploymentInstructions(release, uploadResults, updatedJsonFiles)
                };

            } else {
                console.log('No PDF files to upload');
                return {
                    success: true,
                    release: release,
                    uploadResults: [],
                    jsonFiles: exportResult.jsonFiles,
                    cdnBaseUrl: `https://cdn.jsdelivr.net/gh/${this.repoOwner}/${this.repoName}@${release.tag_name}/`,
                    instructions: this.generateDeploymentInstructions(release, [], exportResult.jsonFiles)
                };
            }

        } catch (error) {
            console.error('GitHub Releases deployment failed:', error);
            throw error;
        }
    }

    // Update JSON files with correct CDN URLs
    updateCDNUrls(jsonFiles, tagName, uploadResults) {
        const updatedFiles = { ...jsonFiles };
        const successfulUploads = uploadResults.filter(r => r.success);

        Object.keys(updatedFiles).forEach(filePath => {
            if (filePath.includes('papers/') && filePath.endsWith('.json')) {
                const paperData = { ...updatedFiles[filePath] };
                
                // Find corresponding upload result
                const uploadResult = successfulUploads.find(r => r.paperId === paperData.id);
                if (uploadResult) {
                    paperData.pdfUrl = uploadResult.cdnUrl;
                }

                updatedFiles[filePath] = paperData;
            }
        });

        return updatedFiles;
    }

    // Generate deployment instructions
    generateDeploymentInstructions(release, uploadResults, jsonFiles) {
        const successfulUploads = uploadResults.filter(r => r.success);
        const failedUploads = uploadResults.filter(r => !r.success);

        return {
            releaseUrl: release.html_url,
            cdnBaseUrl: `https://cdn.jsdelivr.net/gh/${this.repoOwner}/${this.repoName}@${release.tag_name}/`,
            summary: {
                totalPDFs: uploadResults.length,
                successfulUploads: successfulUploads.length,
                failedUploads: failedUploads.length,
                jsonFiles: Object.keys(jsonFiles).length
            },
            nextSteps: [
                '✅ Release created successfully',
                `✅ Uploaded ${successfulUploads.length}/${uploadResults.length} PDF files`,
                '',
                '📝 Next steps:',
                '1. Update your repository with the JSON files:',
                ...Object.keys(jsonFiles).map(path => `   - ${path}`),
                '',
                '2. Your PDFs are now available via jsDelivr CDN',
                `   Base URL: https://cdn.jsdelivr.net/gh/${this.repoOwner}/${this.repoName}@${release.tag_name}/`,
                '',
                '3. Test a few CDN links to ensure they work:',
                ...successfulUploads.slice(0, 3).map(upload => `   - ${upload.cdnUrl}`),
                '',
                failedUploads.length > 0 ? '⚠️  Failed uploads (retry manually):' : '',
                ...failedUploads.map(failed => `   - ${failed.fileName}: ${failed.error}`)
            ].filter(Boolean),
            failedUploads: failedUploads
        };
    }

    // Download updated JSON files
    downloadUpdatedJSONFiles(jsonFiles, tagName = '') {
        Object.entries(jsonFiles).forEach(([path, data]) => {
            const content = JSON.stringify(data, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${path.replace(/\//g, '_')}${tagName ? `_${tagName}` : ''}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
        });
    }

    // Validate configuration
    validateConfig() {
        const issues = [];
        
        if (!this.repoOwner) issues.push('Repository owner is required');
        if (!this.repoName) issues.push('Repository name is required');
        if (!this.token) issues.push('GitHub token is required');
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }
}

// Export for use in main application
window.GitHubReleasesUploader = GitHubReleasesUploader;