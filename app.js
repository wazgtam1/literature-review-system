// Literature Review Management System JavaScript

class LiteratureManager {
    constructor() {
        this.papers = [];
        this.filteredPapers = [];
        this.currentCategory = 'all';
        this.currentSort = 'year-desc';
        this.currentPage = 1;
        this.papersPerPage = 12;
        this.currentChart = null;
        
        // Initialize IndexedDB storage
        this.storage = new IndexedDBStorage();
        this.storageInitialized = false;
        
        // Initialize static data support
        this.staticLoader = null;
        this.isStaticMode = false;
        this.staticExporter = new StaticDataExporter(this);
        
        this.filters = {
            search: '',
            category: 'all',
            yearMin: 2000,
            yearMax: 2024,
            methodologies: [],
            studyTypes: [],
            venue: '',
            citationMin: null,
            citationMax: null
        };
        
        this.init();
    }
    
    async init() {
        // Initialize IndexedDB storage first
        await this.initStorage();
        
        // Load data from IndexedDB or localStorage
        await this.loadData();
        
        this.setupEventListeners();
        this.initializeFilters();
        this.applyFilters();
    }
    
    // Initialize IndexedDB storage
    async initStorage() {
        try {
            if (!this.storageInitialized) {
                await this.storage.init();
                this.storageInitialized = true;
                console.log('IndexedDB storage initialized successfully');
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize IndexedDB storage:', error);
            this.showNotification('Storage initialization failed. Using fallback mode.', 'warning');
            return false;
        }
    }
    
    async loadData() {
        try {
            // First try to initialize static mode (for deployed version)
            const staticModeInitialized = await this.initializeStaticMode();
            if (staticModeInitialized) {
                return; // Skip local storage loading if static mode is available
            }
            
            if (this.storageInitialized) {
                // Try to load from IndexedDB first
                console.log('Loading data from IndexedDB...');
                const indexedDBPapers = await this.storage.getAllPapers();
                
                if (indexedDBPapers && indexedDBPapers.length > 0) {
                    this.papers = indexedDBPapers;
                    this.filteredPapers = [...this.papers];
                    
                    // Load thumbnails for papers
                    for (let paper of this.papers) {
                        if (!paper.thumbnail) {
                            const thumbnail = await this.storage.getThumbnail(paper.id);
                            if (thumbnail) {
                                paper.thumbnail = thumbnail;
                            }
                        }
                    }
                    
                    console.log(`Loaded ${this.papers.length} papers from IndexedDB`);
                    setTimeout(() => {
                        this.showNotification(`✅ Loaded ${this.papers.length} papers from secure storage`, 'success');
                    }, 500);
                    return;
                }
            }
            
            // Fallback: Try to load data from localStorage
            console.log('Loading data from localStorage (fallback)...');
            const savedPapers = localStorage.getItem('literaturePapers');
            if (savedPapers) {
                try {
                    const parsedPapers = JSON.parse(savedPapers);
                    if (Array.isArray(parsedPapers) && parsedPapers.length > 0) {
                        // Check if there are papers with blob URLs that might be invalid
                        const hasInvalidPdfLinks = parsedPapers.some(paper => 
                            paper.pdfUrl && paper.pdfUrl.startsWith('blob:')
                        );
                        
                        // Check for persistent PDF files (base64)
                        const hasPersistentPdfs = parsedPapers.some(paper => 
                            paper.pdfUrl && paper.pdfUrl.startsWith('data:')
                        );
                        
                        this.papers = parsedPapers;
                        this.filteredPapers = [...this.papers];
                        console.log(`Loaded ${this.papers.length} papers from localStorage`);
                        
                        // Migrate to IndexedDB if storage is initialized
                        if (this.storageInitialized) {
                            setTimeout(() => {
                                this.showNotification('🔄 Migrating data to secure storage...', 'info');
                                this.migrateToIndexedDB();
                            }, 1000);
                        }
                        
                        // Show notification for successful data loading
                        setTimeout(() => {
                            if (hasInvalidPdfLinks && !hasPersistentPdfs) {
                                this.showNotification(`Loaded ${this.papers.length} papers from local storage\n⚠️ Note: Uploaded PDF links will expire after page refresh`, 'warning');
                            } else if (hasPersistentPdfs) {
                                this.showNotification(`Loaded ${this.papers.length} papers from local storage\n✅ PDF files are permanently saved and can be viewed anytime`, 'success');
                            } else {
                                this.showNotification(`Loaded ${this.papers.length} papers from local storage`, 'info');
                            }
                        }, 500);
                        return;
                    }
                } catch (error) {
                    console.error('Failed to parse local storage data:', error);
                    this.showNotification('Failed to parse local storage data, using default data', 'warning');
                }
            }
            
            // No saved data found
            this.papers = [];
            this.filteredPapers = [];
            console.log('No saved data found, system ready for new papers');
            setTimeout(() => {
                this.showNotification('🚀 Welcome! Upload your first paper to get started.', 'info');
            }, 500);
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data: ' + error.message, 'error');
            // Initialize with empty data
            this.papers = [];
            this.filteredPapers = [];
        }
        
        // Check for backup reminders after loading data
        setTimeout(() => {
            this.checkBackupReminder();
        }, 2000);
    }
    
    // Migrate data from localStorage to IndexedDB
    async migrateToIndexedDB() {
        try {
            if (!this.storageInitialized || this.papers.length === 0) {
                return;
            }
            
            console.log('Starting migration to IndexedDB...');
            let migratedCount = 0;
            
            for (let paper of this.papers) {
                try {
                    // Generate ID if missing
                    if (!paper.id) {
                        paper.id = 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    }
                    
                    // Save paper data to IndexedDB
                    await this.storage.savePaper(paper);
                    
                    // Save thumbnail if exists
                    if (paper.thumbnail) {
                        await this.storage.saveThumbnail(paper.id, paper.thumbnail);
                    }
                    
                    migratedCount++;
                } catch (error) {
                    console.error('Error migrating paper:', paper.title, error);
                }
            }
            
            console.log(`Migration completed: ${migratedCount}/${this.papers.length} papers migrated`);
            
            if (migratedCount > 0) {
                // Clear localStorage after successful migration
                localStorage.removeItem('literaturePapers');
                this.showNotification(`✅ Successfully migrated ${migratedCount} papers to secure storage!`, 'success');
            }
            
        } catch (error) {
            console.error('Error during migration:', error);
            this.showNotification('Migration failed: ' + error.message, 'error');
        }
    }
    
    // Save data using IndexedDB or localStorage fallback
    async saveData() {
        try {
            if (this.storageInitialized) {
                // Use IndexedDB for unlimited storage
                console.log('Saving data to IndexedDB...');
                
                // Note: Individual papers are saved when they're added/updated
                // This method is mainly for batch operations or fallback
                let savedCount = 0;
                
                for (let paper of this.papers) {
                    try {
                        if (!paper.id) {
                            paper.id = 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        }
                        await this.storage.savePaper(paper);
                        savedCount++;
                    } catch (error) {
                        console.error('Error saving paper:', paper.title, error);
                    }
                }
                
                console.log(`Successfully saved ${savedCount}/${this.papers.length} papers to IndexedDB`);
                return true;
            } else {
                // Fallback to localStorage with compression
                console.log('Saving data to localStorage (fallback)...');
                
                const papersToSave = this.papers.map(paper => ({
                    ...paper,
                    // Remove large binary data for localStorage
                    pdfFile: undefined,
                    // Keep only essential data
                    thumbnail: paper.thumbnail && paper.thumbnail.length < 50000 ? paper.thumbnail : null
                }));
                
                localStorage.setItem('literaturePapers', JSON.stringify(papersToSave));
                console.log('Data saved to localStorage (compressed)');
                return true;
            }
        } catch (error) {
            console.error('Failed to save data:', error);
            
            if (error.name === 'QuotaExceededError') {
                this.showNotification('Storage quota exceeded! Please upgrade to secure storage or clear old data.', 'error');
                
                // Show storage management options
                setTimeout(() => {
                    this.showStorageInfo();
                }, 1000);
            } else {
                this.showNotification('Failed to save data: ' + error.message, 'error');
            }
            return false;
        }
    }
    
    setupEventListeners() {
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });
        
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Year range sliders
        const yearMinSlider = document.getElementById('yearMin');
        const yearMaxSlider = document.getElementById('yearMax');
        
        yearMinSlider.addEventListener('input', (e) => {
            this.filters.yearMin = parseInt(e.target.value);
            if (this.filters.yearMin > this.filters.yearMax) {
                this.filters.yearMax = this.filters.yearMin;
                yearMaxSlider.value = this.filters.yearMin;
            }
            this.updateYearDisplay();
            this.applyFilters();
        });
        
        yearMaxSlider.addEventListener('input', (e) => {
            this.filters.yearMax = parseInt(e.target.value);
            if (this.filters.yearMax < this.filters.yearMin) {
                this.filters.yearMin = this.filters.yearMax;
                yearMinSlider.value = this.filters.yearMax;
            }
            this.updateYearDisplay();
            this.applyFilters();
        });
        
        // Citation range inputs
        document.getElementById('citationMin').addEventListener('input', (e) => {
            this.filters.citationMin = e.target.value ? parseInt(e.target.value) : null;
            this.applyFilters();
        });
        
        document.getElementById('citationMax').addEventListener('input', (e) => {
            this.filters.citationMax = e.target.value ? parseInt(e.target.value) : null;
            this.applyFilters();
        });
        
        // Venue filter
        document.getElementById('venueFilter').addEventListener('change', (e) => {
            this.filters.venue = e.target.value;
            this.applyFilters();
        });
        
        // Category tab buttons
        document.querySelectorAll('.category-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                this.filters.category = btn.dataset.category;
                this.applyFilters();
            });
        });
        
        // Sort functionality
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.sortPapers();
            this.updateView();
        });
        
        // Reset filters
        document.getElementById('resetFilters').addEventListener('click', () => {
            this.resetFilters();
        });
        
        // Export functionality
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportResults();
        });
        
        // Export static data for GitHub Pages
        document.getElementById('exportStaticBtn').addEventListener('click', () => {
            this.exportStaticData();
        });
        
        // Upload functionality
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.showUploadModal();
        });
        
        // Visualization modal
        document.getElementById('visualizationBtn').addEventListener('click', () => {
            this.showVisualizationModal();
        });
        
        document.getElementById('closeVisualization').addEventListener('click', () => {
            this.hideVisualizationModal();
        });
        
        // Paper details modal
        document.getElementById('closePaper').addEventListener('click', () => {
            this.hidePaperModal();
        });
        
        // Chart tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.showChart(tab.dataset.chart);
            });
        });
        
        // Modal backdrop click to close
        document.getElementById('visualizationModal').addEventListener('click', (e) => {
            if (e.target.id === 'visualizationModal') {
                this.hideVisualizationModal();
            }
        });
        
        document.getElementById('paperModal').addEventListener('click', (e) => {
            if (e.target.id === 'paperModal') {
                this.hidePaperModal();
            }
        });
        
        // Upload modal events
        document.getElementById('closeUpload').addEventListener('click', () => {
            this.hideUploadModal();
        });
        
        document.getElementById('uploadModal').addEventListener('click', (e) => {
            if (e.target.id === 'uploadModal') {
                this.hideUploadModal();
            }
        });
        
        // Upload tab switching
        document.querySelectorAll('.upload-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.switchUploadTab(tab.dataset.tab);
            });
        });
        
        // File upload events
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            console.log('File input changed, files:', e.target.files);
            if (e.target.files && e.target.files.length > 0) {
                this.handleFileSelect(e.target.files);
                // Clear the input value to allow selecting the same file again if needed
                e.target.value = '';
            }
        });
        
        // Drag and drop events
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });
        
        uploadArea.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        // Manual entry form
        document.getElementById('manualEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleManualEntry();
        });
        
        document.getElementById('cancelManualEntry').addEventListener('click', () => {
            this.hideUploadModal();
        });
        
        // Image manager events
        document.getElementById('closeImageManager').addEventListener('click', () => {
            this.hideImageManager();
        });
        
        document.getElementById('imageManagerModal').addEventListener('click', (e) => {
            if (e.target.id === 'imageManagerModal') {
                this.hideImageManager();
            }
        });
        
        // Image upload events
        document.getElementById('imageUploadArea').addEventListener('click', () => {
            document.getElementById('imageFileInput').click();
        });
        
        document.getElementById('imageFileInput').addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });
        
        // Image drag and drop
        const imageUploadArea = document.getElementById('imageUploadArea');
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.classList.add('drag-over');
        });
        
        imageUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('drag-over');
        });
        
        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.handleImageUpload(e.dataTransfer.files[0]);
            }
        });
        
        // Image management buttons
        document.getElementById('resetImageBtn').addEventListener('click', () => {
            this.resetPaperImage();
        });
        
        document.getElementById('removeImageBtn').addEventListener('click', () => {
            this.removePaperImage();
        });
        
        // PDF viewer events
        document.getElementById('closePdfViewer').addEventListener('click', () => {
            this.closePdfViewer();
        });
        
        document.getElementById('pdfViewerModal').addEventListener('click', (e) => {
            if (e.target.id === 'pdfViewerModal') {
                this.closePdfViewer();
            }
        });
        
        // Storage management button
        document.getElementById('storageInfoBtn').addEventListener('click', () => {
            this.showStorageInfo();
        });
        
        // Test add button
        document.getElementById('testAddBtn').addEventListener('click', () => {
            this.testAddPaper();
        });
    }
    
    initializeFilters() {
        // Initialize methodology filters
        const methodologies = [...new Set(this.papers.map(p => p.methodology))];
        this.createCheckboxGroup('methodologyFilters', methodologies, 'methodologies');
        
        // Initialize study type filters
        const studyTypes = [...new Set(this.papers.map(p => p.studyType))];
        this.createCheckboxGroup('studyTypeFilters', studyTypes, 'studyTypes');
        
        // Initialize venue options
        const venues = [...new Set(this.papers.map(p => p.journal))].sort();
        const venueSelect = document.getElementById('venueFilter');
        venues.forEach(venue => {
            const option = document.createElement('option');
            option.value = venue;
            option.textContent = venue;
            venueSelect.appendChild(option);
        });
        
        this.updateYearDisplay();
    }
    
    createCheckboxGroup(containerId, items, filterKey) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // Clear existing items
        items.forEach(item => {
            const itemCount = this.papers.filter(p => {
                if (filterKey === 'methodologies') return p.methodology === item;
                if (filterKey === 'studyTypes') return p.studyType === item;
                return false;
            }).length;
            
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';
            checkboxItem.innerHTML = `
                <input type="checkbox" id="${filterKey}_${item.replace(/\s+/g, '_')}" value="${item}">
                <label for="${filterKey}_${item.replace(/\s+/g, '_')}">${item}</label>
                <span class="item-count">${itemCount}</span>
            `;
            
            const checkbox = checkboxItem.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.filters[filterKey].push(item);
                } else {
                    this.filters[filterKey] = this.filters[filterKey].filter(i => i !== item);
                }
                this.applyFilters();
            });
            
            container.appendChild(checkboxItem);
        });
    }
    
    updateYearDisplay() {
        document.getElementById('yearMinDisplay').textContent = this.filters.yearMin;
        document.getElementById('yearMaxDisplay').textContent = this.filters.yearMax;
    }
    
    applyFilters() {
        console.log('=== APPLY FILTERS DEBUG ===');
        console.log('Current filters:', this.filters);
        console.log('Total papers before filtering:', this.papers.length);
        
        this.filteredPapers = this.papers.filter(paper => {
            // Search filter
            if (this.filters.search) {
                const searchText = this.filters.search;
                const searchIn = `${paper.title} ${paper.authors.join(' ')} ${paper.abstract} ${paper.keywords.join(' ')}`.toLowerCase();
                if (!searchIn.includes(searchText)) return false;
            }
            
            // Category filter
            if (this.filters.category !== 'all' && paper.researchArea !== this.filters.category) {
                return false;
            }
            
            // Year filter
            if (paper.year < this.filters.yearMin || paper.year > this.filters.yearMax) {
                console.log(`Paper "${paper.title}" (${paper.year}) filtered out by year range ${this.filters.yearMin}-${this.filters.yearMax}`);
                return false;
            }
            
            // Methodology filter
            if (this.filters.methodologies.length > 0 && !this.filters.methodologies.includes(paper.methodology)) {
                return false;
            }
            
            // Study type filter
            if (this.filters.studyTypes.length > 0 && !this.filters.studyTypes.includes(paper.studyType)) {
                return false;
            }
            
            // Venue filter
            if (this.filters.venue && paper.journal !== this.filters.venue) {
                return false;
            }
            
            // Citation range filter
            if (this.filters.citationMin !== null && paper.citations < this.filters.citationMin) {
                return false;
            }
            if (this.filters.citationMax !== null && paper.citations > this.filters.citationMax) {
                return false;
            }
            
            return true;
        });
        
        console.log('Filtered papers count:', this.filteredPapers.length);
        console.log('Recently added papers:', this.papers.slice(-3).map(p => `${p.id}: ${p.title} (${p.year})`));
        
        this.sortPapers();
        this.currentPage = 1;
        this.updateStatistics();
        this.renderPapersGrid();
        this.updatePagination();
        
        console.log('=== FILTERS APPLIED ===');
    }
    
    sortPapers() {
        this.filteredPapers.sort((a, b) => {
            switch (this.currentSort) {
                case 'year-desc':
                    return b.year - a.year;
                case 'year-asc':
                    return a.year - b.year;
                case 'citations-desc':
                    return b.citations - a.citations;
                case 'citations-asc':
                    return a.citations - b.citations;
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                default:
                    return b.year - a.year;
            }
        });
    }
    
    updateStatistics() {
        document.getElementById('totalCount').textContent = this.papers.length;
        document.getElementById('filteredCount').textContent = this.filteredPapers.length;
        
        // Update category count
        const categoryCount = this.currentCategory === 'all' ? 
            this.filteredPapers.length : 
            this.papers.filter(p => p.researchArea === this.currentCategory).length;
        document.getElementById('categoryCount').textContent = categoryCount;
    }
    
    renderPapersGrid() {
        const container = document.getElementById('papersGrid');
        const startIndex = (this.currentPage - 1) * this.papersPerPage;
        const endIndex = Math.min(startIndex + this.papersPerPage, this.filteredPapers.length);
        const paginatedPapers = this.filteredPapers.slice(startIndex, endIndex);
        
        if (paginatedPapers.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <h3>No matching papers found</h3>
                    <p>Please try adjusting filter conditions or search keywords</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = paginatedPapers.map(paper => `
            <div class="paper-card" data-paper-id="${paper.id}">
                <div class="paper-card-header">
                    <div class="paper-image-container">
                        ${paper.thumbnail ? 
                            `<img src="${paper.thumbnail}" alt="PDF Preview" class="paper-thumbnail" />` :
                            `<div class="paper-icon">${this.getPaperIcon(paper.researchArea)}</div>`
                        }
                        <div class="image-overlay" data-paper-id="${paper.id}" data-action="image-manager">
                            <div class="overlay-icon">📷</div>
                        </div>
                    </div>
                </div>
                <div class="paper-card-content">
                    <h3 class="paper-card-title">${paper.title}</h3>
                    <div class="paper-card-meta">
                        <div class="paper-card-authors">${paper.authors.join(', ')}</div>
                        <div class="paper-card-info">
                            <span class="paper-card-venue">${paper.journal}</span>
                            <span class="paper-card-year">${paper.year}</span>
                        </div>
                        <div class="paper-card-stats">
                            <div class="paper-stat">
                                <span class="paper-stat-icon">📊</span>
                                <span>${paper.citations}</span>
                            </div>
                            <div class="paper-stat">
                                <span class="paper-stat-icon">📥</span>
                                <span>${paper.downloads}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for paper cards
        container.querySelectorAll('.paper-card').forEach(card => {
            const paperId = card.dataset.paperId;
            
            // Main card click handler
            card.addEventListener('click', (e) => {
                // Check if click is on image overlay
                if (e.target.closest('.image-overlay')) {
                    e.stopPropagation();
                    this.showImageManager(paperId);
                } else {
                    this.showPaperDetails(paperId);
                }
            });
        });
    }
    
    getPaperIcon(researchArea) {
        const icons = {
            'Accessible Interaction': '♿',
            'HCI New Wearable Devices': '⌚',
            'Immersive Interaction': '🥽',
            'Mobile Device': '📱',
            'Special Scenarios': '🎭',
            'General': '📄'
        };
        return icons[researchArea] || '📄';
    }
    
    renderTimelineView() {
        const container = document.getElementById('timelineView');
        const papersByYear = {};
        
        this.filteredPapers.forEach(paper => {
            if (!papersByYear[paper.year]) {
                papersByYear[paper.year] = [];
            }
            papersByYear[paper.year].push(paper);
        });
        
        const years = Object.keys(papersByYear).sort((a, b) => b - a);
        
        container.innerHTML = years.map(year => `
            <div class="timeline-year">
                <h3 class="timeline-year-label">${year} (${papersByYear[year].length} papers)</h3>
                <div class="timeline-papers">
                    ${papersByYear[year].map(paper => `
                        <div class="paper-card" onclick="literatureManager.showPaperDetails(${paper.id})">
                            <div class="paper-header">
                                <h4 class="paper-title">${paper.title}</h4>
                                <div class="paper-authors">${paper.authors.join(', ')}</div>
                                <div class="paper-venue">${paper.journal}</div>
                            </div>
                            <div class="paper-meta">
                                <div class="meta-item">
                                    <span>Field: ${paper.researchArea}</span>
                                </div>
                                <div class="meta-item">
                                    <span>Citations: ${paper.citations}</span>
                                </div>
                            </div>
                            <div class="paper-keywords">
                                ${paper.keywords.slice(0, 3).map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
    
    updatePagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredPapers.length / this.papersPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="literatureManager.goToPage(${this.currentPage - 1})">Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="literatureManager.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += `<span class="pagination-info">...</span>`;
            }
        }
        
        // Next button
        paginationHTML += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="literatureManager.goToPage(${this.currentPage + 1})">Next</button>`;
        
        // Page info
        paginationHTML += `<span class="pagination-info">Page ${this.currentPage} of ${totalPages}</span>`;
        
        pagination.innerHTML = paginationHTML;
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.renderPapersGrid();
        this.updatePagination();
    }
    
    resetFilters() {
        this.filters = {
            search: '',
            category: 'all',
            yearMin: 2000,
            yearMax: 2024,
            methodologies: [],
            studyTypes: [],
            venue: '',
            citationMin: null,
            citationMax: null
        };
        
        // Reset UI elements
        document.getElementById('searchInput').value = '';
        document.getElementById('yearMin').value = 2000;
        document.getElementById('yearMax').value = 2024;
        document.getElementById('citationMin').value = '';
        document.getElementById('citationMax').value = '';
        document.getElementById('venueFilter').value = '';
        
        // Reset category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.category === 'all') {
                tab.classList.add('active');
            }
        });
        this.currentCategory = 'all';
        
        // Reset checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.updateYearDisplay();
        this.applyFilters();
    }
    
    showPaperDetails(paperId) {
        const paper = this.papers.find(p => p.id === paperId);
        if (!paper) return;
        
        this.currentEditingPaper = paper;
        this.isEditMode = false;
        
        document.getElementById('paperTitle').textContent = paper.title;
        this.renderPaperDetails(paper);
        
        document.getElementById('paperModal').classList.remove('hidden');
    }
    
    renderPaperDetails(paper) {
        const isEditMode = this.isEditMode;
        
        document.getElementById('paperDetails').innerHTML = `
            <div class="paper-details-layout">
                <div class="paper-details-image">
                    ${paper.thumbnail ? 
                        `<img src="${paper.thumbnail}" alt="PDF Preview" class="paper-details-thumbnail" />` :
                        `<div class="paper-details-icon">${this.getPaperIcon(paper.researchArea)}</div>`
                    }
                </div>
                <div class="paper-details-content">
                    <div class="paper-details-actions">
                        ${!isEditMode ? 
                            `<button class="btn btn--secondary btn--sm edit-btn" onclick="literatureManager.toggleEditMode()">✏️ Edit</button>
                             <button class="btn btn--danger btn--sm delete-btn" onclick="literatureManager.confirmDeletePaper()">🗑️ Delete</button>` :
                            `<button class="btn btn--primary btn--sm save-btn" onclick="literatureManager.savePaperDetails()">💾 Save</button>
                             <button class="btn btn--outline btn--sm cancel-btn" onclick="literatureManager.cancelEditMode()">❌ Cancel</button>`
                        }
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Authors</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.authors.join(', ') :
                                `<input type="text" class="detail-input" id="edit-authors" value="${paper.authors.join(', ')}" placeholder="Separate multiple authors with commas">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Journal/Conference</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.journal :
                                `<input type="text" class="detail-input" id="edit-journal" value="${paper.journal}" placeholder="Journal or conference name">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Publication Year</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.year :
                                `<input type="number" class="detail-input" id="edit-year" value="${paper.year}" min="1900" max="2030" placeholder="Publication year">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Research Field</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.researchArea :
                                `<select class="detail-input" id="edit-researchArea">
                                    <option value="Accessible Interaction" ${paper.researchArea === 'Accessible Interaction' ? 'selected' : ''}>Accessible Interaction</option>
                                    <option value="HCI New Wearable Devices" ${paper.researchArea === 'HCI New Wearable Devices' ? 'selected' : ''}>HCI New Wearable Devices</option>
                                    <option value="Immersive Interaction" ${paper.researchArea === 'Immersive Interaction' ? 'selected' : ''}>Immersive Interaction</option>
                                    <option value="Mobile Device" ${paper.researchArea === 'Mobile Device' ? 'selected' : ''}>Mobile Device</option>
                                    <option value="Special Scenarios" ${paper.researchArea === 'Special Scenarios' ? 'selected' : ''}>Special Scenarios</option>
                                    <option value="General" ${paper.researchArea === 'General' ? 'selected' : ''}>Other</option>
                                </select>`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Research Method</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.methodology :
                                `<select class="detail-input" id="edit-methodology">
                                    <option value="Experimental" ${paper.methodology === 'Experimental' ? 'selected' : ''}>Experimental Research</option>
                                    <option value="Survey" ${paper.methodology === 'Survey' ? 'selected' : ''}>Survey</option>
                                    <option value="Computational" ${paper.methodology === 'Computational' ? 'selected' : ''}>Computational Methods</option>
                                    <option value="Design Research" ${paper.methodology === 'Design Research' ? 'selected' : ''}>Design Research</option>
                                    <option value="Theoretical" ${paper.methodology === 'Theoretical' ? 'selected' : ''}>Theoretical Research</option>
                                </select>`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Study Type</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.studyType :
                                `<select class="detail-input" id="edit-studyType">
                                    <option value="Empirical" ${paper.studyType === 'Empirical' ? 'selected' : ''}>Empirical Research</option>
                                    <option value="Review" ${paper.studyType === 'Review' ? 'selected' : ''}>Review</option>
                                    <option value="Case Study" ${paper.studyType === 'Case Study' ? 'selected' : ''}>Case Study</option>
                                </select>`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Abstract</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                `<div class="detail-abstract">${paper.abstract}</div>` :
                                `<textarea class="detail-textarea" id="edit-abstract" placeholder="Paper abstract" rows="4">${paper.abstract}</textarea>`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Keywords</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.keywords.join(', ') :
                                `<input type="text" class="detail-input" id="edit-keywords" value="${paper.keywords.join(', ')}" placeholder="Separate multiple keywords with commas">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Citations</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.citations :
                                `<input type="number" class="detail-input" id="edit-citations" value="${paper.citations}" min="0" placeholder="Citation count">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Downloads</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.downloads :
                                `<input type="number" class="detail-input" id="edit-downloads" value="${paper.downloads}" min="0" placeholder="Download count">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">DOI</div>
                        <div class="detail-value">
                            ${!isEditMode ? 
                                paper.doi :
                                `<input type="text" class="detail-input" id="edit-doi" value="${paper.doi}" placeholder="10.xxxx/xxxxxx">`
                            }
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="detail-label">Links</div>
                        <div class="detail-links">
                            ${paper.pdfUrl && paper.pdfUrl !== '#' ? 
                                (paper.pdfUrl.startsWith('data:') ? 
                                    `<button class="detail-link detail-link--primary" onclick="literatureManager.showPdfViewerAndCloseModal('${paper.pdfUrl}', '${paper.title}')">📄 View PDF Document (Built-in Viewer)</button>` :
                                    paper.pdfUrl.startsWith('blob:') ?
                                        `<span class="detail-link detail-link--disabled">⚠️ PDF document link expired</span>` :
                                        `<a href="${paper.pdfUrl}" target="_blank" class="detail-link detail-link--primary">📄 View PDF Document</a>`
                                ) :
                                `<span class="detail-link detail-link--disabled">PDF document unavailable</span>`
                            }
                            ${paper.websiteUrl && paper.websiteUrl !== '#' ? 
                                `<a href="${paper.websiteUrl}" target="_blank" class="detail-link detail-link--secondary">🌐 Website Link</a>` :
                                `<span class="detail-link detail-link--disabled">Website link unavailable</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    toggleEditMode() {
        this.isEditMode = true;
        this.renderPaperDetails(this.currentEditingPaper);
    }
    
    cancelEditMode() {
        this.isEditMode = false;
        this.renderPaperDetails(this.currentEditingPaper);
    }
    
    savePaperDetails() {
        if (!this.currentEditingPaper) return;
        
        try {
            // Collect edited values
            const editedPaper = {
                ...this.currentEditingPaper,
                authors: document.getElementById('edit-authors').value.split(',').map(a => a.trim()).filter(a => a),
                journal: document.getElementById('edit-journal').value.trim(),
                year: parseInt(document.getElementById('edit-year').value),
                researchArea: document.getElementById('edit-researchArea').value,
                methodology: document.getElementById('edit-methodology').value,
                studyType: document.getElementById('edit-studyType').value,
                abstract: document.getElementById('edit-abstract').value.trim(),
                keywords: document.getElementById('edit-keywords').value.split(',').map(k => k.trim()).filter(k => k),
                citations: parseInt(document.getElementById('edit-citations').value) || 0,
                downloads: parseInt(document.getElementById('edit-downloads').value) || 0,
                doi: document.getElementById('edit-doi').value.trim()
            };
            
            // Validate required fields
            if (!editedPaper.authors.length || !editedPaper.journal || !editedPaper.year) {
                this.showNotification('Please fill in required fields: authors, journal and year', 'error');
                return;
            }
            
            if (editedPaper.year < 1900 || editedPaper.year > 2030) {
                this.showNotification('Please enter a valid publication year', 'error');
                return;
            }
            
            // Update the paper in the papers array
            const paperIndex = this.papers.findIndex(p => p.id === this.currentEditingPaper.id);
            if (paperIndex !== -1) {
                // Update H-index based on citations
                editedPaper.hIndex = Math.floor(editedPaper.citations / 3);
                
                this.papers[paperIndex] = editedPaper;
                this.currentEditingPaper = editedPaper;
                
                // Save to localStorage
                this.saveData();
                
                // Refresh filters and view
                this.applyFilters();
                this.initializeFilters();
                
                // Exit edit mode and show success
                this.isEditMode = false;
                this.renderPaperDetails(editedPaper);
                this.showNotification('Paper information saved successfully!', 'success');
            }
            
        } catch (error) {
            console.error('Error saving paper details:', error);
            this.showNotification('Save failed: ' + error.message, 'error');
        }
    }
    
    hidePaperModal() {
        document.getElementById('paperModal').classList.add('hidden');
    }
    
    showVisualizationModal() {
        document.getElementById('visualizationModal').classList.remove('hidden');
        // Show default chart
        this.showChart('timeline');
    }
    
    hideVisualizationModal() {
        document.getElementById('visualizationModal').classList.add('hidden');
        if (this.currentChart) {
            this.currentChart.destroy();
            this.currentChart = null;
        }
    }
    
    showChart(chartType) {
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        
        const ctx = document.getElementById('visualizationChart').getContext('2d');
        const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];
        
        switch (chartType) {
            case 'timeline':
                this.showTimelineChart(ctx, colors);
                break;
            case 'areas':
                this.showAreasChart(ctx, colors);
                break;
            case 'methodology':
                this.showMethodologyChart(ctx, colors);
                break;
            case 'citations':
                this.showCitationsChart(ctx, colors);
                break;
        }
    }
    
    showTimelineChart(ctx, colors) {
        const yearData = {};
        this.filteredPapers.forEach(paper => {
            yearData[paper.year] = (yearData[paper.year] || 0) + 1;
        });
        
        const years = Object.keys(yearData).sort();
        const counts = years.map(year => yearData[year]);
        
        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Published Papers',
                    data: counts,
                    borderColor: colors[0],
                    backgroundColor: colors[0] + '20',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Literature Publication Timeline'
                    }
                }
            }
        });
    }
    
    showAreasChart(ctx, colors) {
        const areaData = {};
        this.filteredPapers.forEach(paper => {
            areaData[paper.researchArea] = (areaData[paper.researchArea] || 0) + 1;
        });
        
        const areas = Object.keys(areaData);
        const counts = areas.map(area => areaData[area]);
        
        this.currentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: areas,
                datasets: [{
                    data: counts,
                    backgroundColor: colors.slice(0, areas.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Research Field Distribution'
                    },
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
    
    showMethodologyChart(ctx, colors) {
        const methodData = {};
        this.filteredPapers.forEach(paper => {
            methodData[paper.methodology] = (methodData[paper.methodology] || 0) + 1;
        });
        
        const methods = Object.keys(methodData);
        const counts = methods.map(method => methodData[method]);
        
        this.currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: methods,
                datasets: [{
                    label: 'Number of Papers',
                    data: counts,
                    backgroundColor: colors.slice(0, methods.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Research Method Distribution'
                    }
                }
            }
        });
    }
    
    showCitationsChart(ctx, colors) {
        const citationRanges = ['0-10', '11-30', '31-50', '51+'];
        const rangeCounts = [0, 0, 0, 0];
        
        this.filteredPapers.forEach(paper => {
            if (paper.citations <= 10) rangeCounts[0]++;
            else if (paper.citations <= 30) rangeCounts[1]++;
            else if (paper.citations <= 50) rangeCounts[2]++;
            else rangeCounts[3]++;
        });
        
        this.currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: citationRanges,
                datasets: [{
                    label: 'Number of Papers',
                    data: rangeCounts,
                    backgroundColor: colors.slice(0, 4)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Citation Distribution'
                    }
                }
            }
        });
    }
    
    exportResults() {
        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'literature-review-results.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    generateCSV() {
        const headers = ['Title', 'Authors', 'Year', 'Journal', 'Research Field', 'Method', 'Type', 'Keywords', 'Citations', 'DOI'];
        const csvData = [headers.join(',')];
        
        this.filteredPapers.forEach(paper => {
            const row = [
                `"${paper.title.replace(/"/g, '""')}"`,
                `"${paper.authors.join('; ').replace(/"/g, '""')}"`,
                paper.year,
                `"${paper.journal.replace(/"/g, '""')}"`,
                `"${paper.researchArea.replace(/"/g, '""')}"`,
                `"${paper.methodology.replace(/"/g, '""')}"`,
                `"${paper.studyType.replace(/"/g, '""')}"`,
                `"${paper.keywords.join('; ').replace(/"/g, '""')}"`,
                paper.citations,
                `"${paper.doi.replace(/"/g, '""')}"`
            ];
            csvData.push(row.join(','));
        });
        
        return '\ufeff' + csvData.join('\n'); // UTF-8 BOM for proper encoding
    }
    
    // Upload Modal Methods
    showUploadModal() {
        document.getElementById('uploadModal').classList.remove('hidden');
        this.resetUploadForm();
    }
    
    hideUploadModal() {
        document.getElementById('uploadModal').classList.add('hidden');
        this.resetUploadForm();
    }
    
    switchUploadTab(tabName) {
        document.getElementById('fileUploadTab').classList.toggle('hidden', tabName !== 'file');
        document.getElementById('manualEntryTab').classList.toggle('hidden', tabName !== 'manual');
    }
    
    resetUploadForm() {
        // Reset file upload
        document.getElementById('fileInput').value = '';
        document.getElementById('uploadArea').classList.remove('drag-over');
        document.getElementById('uploadProgress').classList.add('hidden');
        document.getElementById('progressFill').style.width = '0%';
        
        // Reset category selection to auto
        document.getElementById('categoryAuto').checked = true;
        
        // Reset manual entry form
        document.getElementById('manualEntryForm').reset();
        
        // Remove any file lists
        const existingFileList = document.querySelector('.file-list');
        if (existingFileList) {
            existingFileList.remove();
        }
    }
    
    handleFileSelect(files) {
        console.log('handleFileSelect called with files:', files);
        if (files.length === 0) {
            console.log('No files selected');
            return;
        }
        
        try {
            const fileList = this.createFileList(files);
            const fileUploadTab = document.getElementById('fileUploadTab');
            
            // Remove existing file list
            const existingFileList = fileUploadTab.querySelector('.file-list');
            if (existingFileList) {
                existingFileList.remove();
            }
            
            fileUploadTab.appendChild(fileList);
            
            // Show immediate feedback
            this.showNotification(`Selected ${files.length} file(s) for upload`, 'info');
            
            // Process files
            this.processFiles(files);
        } catch (error) {
            console.error('Error in handleFileSelect:', error);
            this.showNotification('Error processing selected files: ' + error.message, 'error');
        }
    }
    
    createFileList(files) {
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        
        Array.from(files).forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.type)}</div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <div class="file-status processing" id="fileStatus-${index}">Processing</div>
                <button class="remove-file" data-index="${index}">×</button>
            `;
            
            fileItem.querySelector('.remove-file').addEventListener('click', () => {
                fileItem.remove();
                if (fileList.children.length === 0) {
                    fileList.remove();
                }
            });
            
            fileList.appendChild(fileItem);
        });
        
        return fileList;
    }
    
    getFileIcon(fileType) {
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('json')) return '📋';
        if (fileType.includes('csv')) return '📊';
        if (fileType.includes('doc')) return '📝';
        return '📄';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async processFiles(files) {
        console.log('Starting to process files:', files);
        const results = [];
        
        // Show processing notification
        this.showNotification(`Processing ${files.length} file(s)...`, 'info');
        
        // Get selected category for upload
        const selectedCategoryElement = document.querySelector('input[name="uploadCategory"]:checked');
        const selectedCategory = selectedCategoryElement ? selectedCategoryElement.value : 'auto';
        
        console.log('Selected category for upload:', selectedCategory);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const statusElement = document.getElementById(`fileStatus-${i}`);
            
            try {
                statusElement.textContent = 'Parsing...';
                statusElement.className = 'file-status processing';
                
                // Show different status for PDF files
                if (file.type === 'application/pdf') {
                    statusElement.textContent = 'Generating thumbnail...';
                }
                
                console.log('Processing file:', file.name, 'with category:', selectedCategory);
                const paperData = await this.parseFile(file, selectedCategory);
                console.log('Parsed paper data:', paperData);
                
                if (paperData) {
                    console.log('Adding paper to collection...');
                    this.addPaper(paperData);
                    statusElement.textContent = 'Success';
                    statusElement.className = 'file-status success';
                    results.push({ success: true, file: file.name, data: paperData });
                } else {
                    console.log('Failed to parse paper data');
                    statusElement.textContent = 'Parse failed';
                    statusElement.className = 'file-status error';
                    results.push({ success: false, file: file.name, error: 'Unable to parse file content' });
                }
            } catch (error) {
                console.error('Error processing file:', error);
                statusElement.textContent = 'Error';
                statusElement.className = 'file-status error';
                results.push({ success: false, file: file.name, error: error.message });
            }
        }
        
        console.log('Upload results:', results);
        this.showUploadResults(results);
    }
    
    async parseFile(file, selectedCategory = 'auto') {
        const extension = file.name.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'json':
                return await this.parseJSON(file, selectedCategory);
            case 'csv':
                return await this.parseCSV(file, selectedCategory);
            case 'pdf':
                return await this.parsePDF(file, selectedCategory);
            case 'doc':
            case 'docx':
                return await this.parseDoc(file, selectedCategory);
            default:
                throw new Error('Unsupported file format');
        }
    }
    
    async parseJSON(file, selectedCategory = 'auto') {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate required fields
        if (!data.title || !data.authors || !data.year) {
            throw new Error('JSON file missing required fields (title, authors, year)');
        }
        
        return this.normalizepaperData(data, selectedCategory);
    }
    
    async parseCSV(file, selectedCategory = 'auto') {
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        if (lines.length < 2) {
            throw new Error('CSV file is empty or format is incorrect');
        }
        
        const papers = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const paperData = {};
            
            headers.forEach((header, index) => {
                paperData[header] = values[index] || '';
            });
            
            if (paperData.title && paperData.authors && paperData.year) {
                papers.push(this.normalizepaperData(paperData, selectedCategory));
            }
        }
        
        if (papers.length === 0) {
            throw new Error('No valid paper data found in CSV file');
        }
        
        return papers[0]; // For simplicity, return first paper
    }
    
    async parsePDF(file, selectedCategory = 'auto') {
        try {
            // Convert PDF file to base64 for persistent storage
            const pdfBase64 = await this.convertFileToBase64(file);
            
            // Initialize PDF.js
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                // Generate thumbnail from first page
                const thumbnail = await this.generatePDFThumbnail(pdf);
                
                let fullText = '';
                const maxPages = Math.min(pdf.numPages, 3); // Only parse first 3 pages
                
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                
                // Extract paper information using NLP patterns
                const extractedInfo = this.extractPaperInfo(fullText);
                const fileName = file.name.replace('.pdf', '');
                
                // Determine research area based on selection
                let researchArea;
                if (selectedCategory === 'auto') {
                    researchArea = this.classifyResearchArea(extractedInfo.title + ' ' + fullText.substring(0, 500));
                } else {
                    researchArea = selectedCategory;
                }
                
                return {
                    title: extractedInfo.title || fileName,
                    authors: extractedInfo.authors || ['Unknown Author'],
                    year: extractedInfo.year || new Date().getFullYear(),
                    journal: extractedInfo.journal || 'Unknown Journal',
                    researchArea: researchArea,
                    methodology: 'Experimental',
                    studyType: 'Empirical',
                    keywords: extractedInfo.keywords || [],
                    citations: 0,
                    hIndex: 0,
                    downloads: 0,
                    abstract: extractedInfo.abstract || fullText.substring(0, 300) + '...',
                    doi: extractedInfo.doi || '',
                    pdfUrl: pdfBase64, // Store base64 instead of blob URL
                    websiteUrl: '#',
                    thumbnail: thumbnail,
                    originalThumbnail: thumbnail,
                    pdfFileSize: file.size, // Store file size for reference
                    isPersistentPDF: true // Flag to indicate this PDF will persist
                };
            } else {
                // Fallback to basic parsing
                const fileName = file.name.replace('.pdf', '');
                const researchArea = selectedCategory === 'auto' ? 'General' : selectedCategory;
                
                return {
                    title: fileName,
                    authors: ['Unknown Author'],
                    year: new Date().getFullYear(),
                    journal: 'Unknown Journal',
                    researchArea: researchArea,
                    methodology: 'Experimental',
                    studyType: 'Empirical',
                    keywords: [],
                    citations: 0,
                    hIndex: 0,
                    downloads: 0,
                    abstract: `Paper parsed from PDF file "${file.name}", please manually edit relevant information.`,
                    doi: '',
                    pdfUrl: pdfBase64, // Use base64 for fallback too
                    websiteUrl: '#',
                    thumbnail: null,
                    pdfFileSize: file.size,
                    isPersistentPDF: true
                };
            }
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error('PDF parsing failed: ' + error.message);
        }
    }
    
    // Convert file to base64 for persistent storage
    async convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(file);
        });
    }
    
    async generatePDFThumbnail(pdf) {
        try {
            const page = await pdf.getPage(1); // Get first page
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render PDF page to canvas
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            // Convert canvas to data URL
            return canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
            console.error('Thumbnail generation error:', error);
            return null;
        }
    }
    
    extractPaperInfo(text) {
        const info = {
            title: null,
            authors: [],
            year: null,
            journal: null,
            abstract: null,
            keywords: [],
            doi: null
        };
        
        // Extract title (usually in the first few lines, often in caps or bold)
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 0) {
            // Look for title in first 5 lines
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i].trim();
                if (line.length > 20 && line.length < 200 && !line.includes('@') && !line.includes('Abstract')) {
                    info.title = line;
                    break;
                }
            }
        }
        
        // Extract DOI
        const doiMatch = text.match(/(?:DOI|doi)[\s:]*(\d{2}\.\d{4}\/[^\s]+)/i);
        if (doiMatch) {
            info.doi = doiMatch[1];
        }
        
        // Extract year
        const yearMatch = text.match(/\b(19|20)\d{2}\b/g);
        if (yearMatch) {
            const years = yearMatch.map(y => parseInt(y)).filter(y => y >= 1990 && y <= new Date().getFullYear());
            if (years.length > 0) {
                info.year = Math.max(...years); // Use the most recent year found
            }
        }
        
        // Extract abstract
        const abstractMatch = text.match(/abstract[\s\n]*(.{100,1000}?)(?:\n\n|keywords|introduction)/i);
        if (abstractMatch) {
            info.abstract = abstractMatch[1].trim();
        }
        
        // Extract keywords
        const keywordsMatch = text.match(/keywords?[\s:\-]*(.{10,200}?)(?:\n\n|\d+\.|introduction)/i);
        if (keywordsMatch) {
            info.keywords = keywordsMatch[1].split(/[,;]/).map(k => k.trim()).filter(k => k.length > 1).slice(0, 8);
        }
        
        // Extract authors (look for patterns like "Name, Name and Name" or "Name et al.")
        const authorPatterns = [
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)*)\s+(?:and|&)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/,
            /([A-Z][a-z]+(?:\s+[A-Z]\.)*\s+[A-Z][a-z]+)(?:\s*,\s*([A-Z][a-z]+(?:\s+[A-Z]\.)*\s+[A-Z][a-z]+))*\s+et\s+al\./
        ];
        
        for (const pattern of authorPatterns) {
            const match = text.match(pattern);
            if (match) {
                info.authors = match[0].split(/\s+and\s+|,\s*/).map(a => a.trim()).filter(a => a && a !== 'et' && a !== 'al.');
                break;
            }
        }
        
        // Extract journal/venue information
        const venuePatterns = [
            /(?:In\s+)?Proceedings\s+of\s+(.{5,50}?)(?:\s*,|\s*\d{4}|\n)/i,
            /(?:Published\s+in\s+)?([A-Z][a-zA-Z\s&]+(?:Journal|Conference|Workshop|Symposium))/,
            /([A-Z][a-zA-Z\s]+)\s+(?:Journal|Conference)\s+(?:on|of)/
        ];
        
        for (const pattern of venuePatterns) {
            const match = text.match(pattern);
            if (match) {
                info.journal = match[1].trim();
                break;
            }
        }
        
        return info;
    }
    
    classifyResearchArea(text) {
        const classifications = {
            'Accessible Interaction': [
                'accessibility', 'impairment', 'disability', 'visually impaired', 
                'motor impairment', 'blind', 'deaf', 'assistive', 'accessible',
                'touchscreen', 'motor disabilities', 'visual disabilities'
            ],
            'HCI New Wearable Devices': [
                'wearable', 'earput', 'behind-the-ear', 'ear-based', 'clothing buttons',
                'wearable device', 'smart watch', 'fitness tracker', 'augmented reality glasses',
                'ear-worn', 'button', 'clothing'
            ],
            'Immersive Interaction': [
                'mixed reality', 'virtual reality', 'immersive', 'vr', 'mr',
                'digital shapes', 'virtual environment', 'desktop virtual reality',
                'presentation', 'boundary', 'immersion', 'virtual world'
            ],
            'Mobile Device': [
                'mobile', 'smartphone', 'finger', 'gesture', 'touch interaction',
                'one-handed', 'touchscreen', 'mobile input', 'finger-grained',
                'smart devices', 'touch', 'mobile device'
            ],
            'Special Scenarios': [
                'conductor', 'musical', 'string instruments', 'performance',
                'sleight of hand', 'finger motion', 'expressiveness', 'visualization',
                'musical interface', 'gesture elicitation', 'interface morphologies'
            ]
        };
        
        const textLower = text.toLowerCase();
        
        for (const [area, keywords] of Object.entries(classifications)) {
            for (const keyword of keywords) {
                if (textLower.includes(keyword)) {
                    return area;
                }
            }
        }
        
        return 'General';
    }
    
    async parseDoc(file, selectedCategory = 'auto') {
        // Basic DOC parsing - similar to PDF
        const fileName = file.name.replace(/\.(doc|docx)$/, '');
        const researchArea = selectedCategory === 'auto' ? 'General' : selectedCategory;
        
        return {
            title: fileName,
            authors: ['Unknown Author'],
            year: new Date().getFullYear(),
            journal: 'Unknown Journal',
            researchArea: researchArea,
            methodology: 'Experimental',
            studyType: 'Empirical',
            keywords: [],
            citations: 0,
            hIndex: 0,
            downloads: 0,
            abstract: `Paper parsed from DOC file "${file.name}", please manually edit relevant information.`,
            doi: '',
            pdfUrl: '#',
            websiteUrl: '#'
        };
    }
    
    normalizepaperData(data, selectedCategory = 'auto') {
        // Determine research area based on selection
        let researchArea;
        if (selectedCategory === 'auto') {
            researchArea = data.researchArea || data['Research Field'] || 'General';
        } else {
            researchArea = selectedCategory;
        }
        
        return {
            id: this.papers.length + 1,
            title: data.title || data['Title'] || 'Untitled',
            authors: Array.isArray(data.authors) ? data.authors : 
                     (data.authors || data['Authors'] || 'Unknown').split(/[,;]/).map(a => a.trim()),
            year: parseInt(data.year || data['Year'] || new Date().getFullYear()),
            journal: data.journal || data['Journal'] || data.venue || 'Unknown Journal',
            researchArea: researchArea,
            methodology: data.methodology || data['Method'] || 'Experimental',
            studyType: data.studyType || data['Type'] || 'Empirical',
            keywords: Array.isArray(data.keywords) ? data.keywords :
                      (data.keywords || data['Keywords'] || '').split(/[,;]/).map(k => k.trim()).filter(k => k),
            citations: parseInt(data.citations || data['Citations'] || 0),
            hIndex: parseInt(data.hIndex || data['H-Index'] || 0),
            downloads: parseInt(data.downloads || data['Downloads'] || 0),
            abstract: data.abstract || data['Abstract'] || '',
            doi: data.doi || data['DOI'] || '',
            pdfUrl: data.pdfUrl || data['PDF Link'] || '#',
            websiteUrl: data.websiteUrl || data['Website Link'] || '#'
        };
    }
    
    handleManualEntry() {
        const formData = new FormData(document.getElementById('manualEntryForm'));
        const paperData = {
            id: this.papers.length + 1,
            title: document.getElementById('titleInput').value,
            authors: document.getElementById('authorsInput').value.split(',').map(a => a.trim()),
            year: parseInt(document.getElementById('yearInput').value),
            journal: document.getElementById('journalInput').value,
            researchArea: document.getElementById('researchAreaInput').value,
            methodology: document.getElementById('methodologyInput').value,
            studyType: document.getElementById('studyTypeInput').value,
            keywords: document.getElementById('keywordsInput').value.split(',').map(k => k.trim()).filter(k => k),
            citations: parseInt(document.getElementById('citationsInput').value) || 0,
            hIndex: Math.floor((parseInt(document.getElementById('citationsInput').value) || 0) / 3),
            downloads: parseInt(document.getElementById('downloadsInput').value) || 0,
            abstract: document.getElementById('abstractInput').value,
            doi: document.getElementById('doiInput').value,
            pdfUrl: '#',
            websiteUrl: '#',
            thumbnail: null // Manual entries don't have thumbnails
        };
        
        this.addPaper(paperData);
        this.hideUploadModal();
        this.showNotification('Paper added successfully!', 'success');
    }
    
    async addPaper(paperData) {
        console.log('addPaper called with:', paperData);
        
        try {
            // Generate unique ID if not present
            if (!paperData.id) {
                paperData.id = 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            
            console.log('Assigned ID:', paperData.id);
            console.log('Current papers count before adding:', this.papers.length);
            
            // Save to IndexedDB first if available to get proper PDF URL
            if (this.storageInitialized) {
                console.log('Saving new paper to IndexedDB...');
                await this.storage.savePaper(paperData, paperData.pdfFile);
                
                // Save thumbnail if exists
                if (paperData.thumbnail) {
                    await this.storage.saveThumbnail(paperData.id, paperData.thumbnail);
                }
                
                // Get PDF URL from IndexedDB for immediate viewing
                if (paperData.pdfFile && !paperData.pdfUrl.startsWith('data:')) {
                    const pdfData = await this.storage.getPDFFile(paperData.id);
                    if (pdfData) {
                        paperData.pdfUrl = pdfData.url;
                        paperData.isPersistentPDF = true;
                        console.log('PDF URL set from IndexedDB:', paperData.pdfUrl.substring(0, 50) + '...');
                    }
                }
                
                console.log('Paper successfully saved to IndexedDB');
            } else {
                // Fallback to localStorage
                console.log('IndexedDB not available, using localStorage fallback');
            }
            
            // Add to memory
            this.papers.push(paperData);
            console.log('Papers count after adding:', this.papers.length);
            
            // Save to localStorage as backup if using IndexedDB
            if (this.storageInitialized) {
                // Just save metadata to localStorage, not the full file
                const lightweightPaper = {
                    ...paperData,
                    pdfFile: undefined // Remove large file data
                };
                const existingLocalData = localStorage.getItem('literaturePapers');
                let localPapers = [];
                if (existingLocalData) {
                    try {
                        localPapers = JSON.parse(existingLocalData);
                    } catch (e) {
                        console.log('Error parsing existing localStorage data');
                    }
                }
                localPapers.push(lightweightPaper);
                try {
                    localStorage.setItem('literaturePapers', JSON.stringify(localPapers));
                } catch (e) {
                    console.log('localStorage backup failed, but IndexedDB save was successful');
                }
            } else {
                await this.saveData();
            }
            
            // Update UI immediately
            this.applyFilters();
            this.initializeFilters();
            
            // Jump to first page and show the new paper
            this.currentPage = 1;
            this.renderPapersGrid();
            this.updatePagination();
            
            console.log('UI updated, new paper should be visible and clickable');
            console.log('Added new paper:', paperData.title);
            
            return paperData.id;
            
        } catch (error) {
            console.error('Error in addPaper:', error);
            this.showNotification('Error adding paper: ' + error.message, 'error');
            throw error;
        }
    }
    
    showUploadResults(results) {
        console.log('showUploadResults called with:', results);
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        console.log(`Upload summary: ${successCount}/${totalCount} successful`);
        
        if (successCount === totalCount && successCount > 0) {
            this.showNotification(`Successfully uploaded ${successCount} papers! Saved locally`, 'success');
            setTimeout(() => {
                console.log('Hiding upload modal and refreshing view...');
                this.hideUploadModal();
                // Reset filters and go to first page to show new papers
                this.resetFilters();
                this.currentPage = 1;
                this.renderPapersGrid();
                this.updatePagination();
                console.log('View refreshed after successful upload');
            }, 1500);
        } else {
            this.showNotification(`Upload completed: ${successCount}/${totalCount} successful`, 'warning');
            // Still refresh view even if some uploads failed
            setTimeout(() => {
                console.log('Refreshing view after partial upload success...');
                this.resetFilters();
                this.currentPage = 1;
                this.renderPapersGrid();
                this.updatePagination();
                console.log('View refreshed after partial upload');
            }, 1000);
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('.notification-styles')) {
            const style = document.createElement('style');
            style.className = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-base);
                    padding: var(--space-12) var(--space-16);
                    box-shadow: var(--shadow-lg);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: var(--space-12);
                    min-width: 300px;
                    animation: slideInRight 0.3s ease;
                }
                
                .notification--success {
                    border-left: 4px solid var(--color-success);
                }
                
                .notification--error {
                    border-left: 4px solid var(--color-error);
                }
                
                .notification--warning {
                    border-left: 4px solid var(--color-warning);
                }
                
                .notification--info {
                    border-left: 4px solid var(--color-info);
                }
                
                .notification-close {
                    background: none;
                    border: none;
                    font-size: var(--font-size-lg);
                    cursor: pointer;
                    color: var(--color-text-secondary);
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    // Image Manager Methods
    showImageManager(paperId) {
        this.currentEditingPaper = this.papers.find(p => p.id === paperId);
        if (!this.currentEditingPaper) return;
        
        document.getElementById('imageManagerModal').classList.remove('hidden');
        this.updateCurrentImageDisplay();
    }
    
    hideImageManager() {
        document.getElementById('imageManagerModal').classList.add('hidden');
        this.currentEditingPaper = null;
        document.getElementById('imageFileInput').value = '';
    }
    
    updateCurrentImageDisplay() {
        const container = document.getElementById('currentImageContainer');
        
        if (this.currentEditingPaper.thumbnail) {
            container.innerHTML = `<img src="${this.currentEditingPaper.thumbnail}" alt="Current Image" class="current-image-preview" />`;
        } else {
            container.innerHTML = `
                <div class="current-image-placeholder">
                    <span>${this.getPaperIcon(this.currentEditingPaper.researchArea)}</span>
                </div>
            `;
        }
    }
    
    async handleImageUpload(file) {
        if (!file || !this.currentEditingPaper) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select a valid image file!', 'error');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Image file too large, please select an image smaller than 5MB!', 'error');
            return;
        }
        
        try {
            // Convert image to base64
            const imageDataUrl = await this.convertImageToDataUrl(file);
            
            // Update paper thumbnail
            this.currentEditingPaper.thumbnail = imageDataUrl;
            this.updateCurrentImageDisplay();
            this.renderPapersGrid();
            this.saveData(); // Save changes to localStorage
            
            this.showNotification('Image replaced successfully!', 'success');
        } catch (error) {
            this.showNotification('Image processing failed: ' + error.message, 'error');
        }
    }
    
    convertImageToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Create image to resize if needed
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate dimensions to maintain aspect ratio
                    const maxWidth = 400;
                    const maxHeight = 300;
                    let { width, height } = img;
                    
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width *= ratio;
                        height *= ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw and compress image
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(file);
        });
    }
    
    resetPaperImage() {
        if (!this.currentEditingPaper) return;
        
        // Reset to original thumbnail or remove custom image
        if (this.currentEditingPaper.originalThumbnail) {
            this.currentEditingPaper.thumbnail = this.currentEditingPaper.originalThumbnail;
        } else {
            this.currentEditingPaper.thumbnail = null;
        }
        
        this.updateCurrentImageDisplay();
        this.renderPapersGrid();
        this.saveData(); // Save changes to localStorage
        this.showNotification('Reset to default image!', 'success');
    }
    
    removePaperImage() {
        if (!this.currentEditingPaper) return;
        
        this.currentEditingPaper.thumbnail = null;
        this.updateCurrentImageDisplay();
        this.renderPapersGrid();
        this.saveData(); // Save changes to localStorage
        this.showNotification('Image removed!', 'success');
    }
    
    // Test function to add a sample paper
    testAddPaper() {
        console.log('Testing paper addition...');
        const testPaper = {
            title: "Test Paper - Application of AI in Education",
            authors: ["Test Author A", "Test Author B"],
            year: 2024,
            journal: "Test Journal",
            researchArea: "Machine Learning",
            methodology: "Experimental",
            studyType: "Empirical",
            keywords: ["AI", "Education", "Machine Learning"],
            citations: 5,
            hIndex: 2,
            downloads: 100,
            abstract: "This is a test paper to verify the system's paper adding and display functionality.",
            doi: "10.test/testpaper.2024",
            pdfUrl: "#",
            websiteUrl: "#"
        };
        
        this.addPaper(testPaper);
        this.showNotification('Test paper added successfully!', 'success');
    }
    
    // Removed: clearAllData, exportFullBackup, importFullBackup methods
    // These features have been simplified for the final deployment version
    
    // Export static data for GitHub Pages deployment
    async exportStaticData() {
        if (this.papers.length === 0) {
            alert('No papers to export. Please add some papers first.');
            return;
        }

        const exportBtn = document.getElementById('exportStaticBtn');
        const originalText = exportBtn.textContent;
        
        try {
            exportBtn.textContent = '🔄 Exporting...';
            exportBtn.disabled = true;
            
            this.showNotification('Starting static export for GitHub Pages...', 'info');
            
            // Use the static exporter to create deployment files
            await this.staticExporter.downloadAsZip();
            
            this.showNotification(`✅ Static export completed! ${this.papers.length} papers exported for GitHub Pages deployment.`, 'success');
            
            // Show deployment instructions
            this.showDeploymentInstructions();
            
        } catch (error) {
            console.error('Static export failed:', error);
            this.showNotification('❌ Static export failed. Check console for details.', 'error');
        } finally {
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
        }
    }
    
    // Show deployment instructions
    showDeploymentInstructions() {
        const instructions = `
📋 GitHub Pages Deployment Instructions:

1. 解压下载的ZIP文件到本地文件夹
2. 在GitHub创建新仓库 (或使用现有仓库)
3. 将所有文件上传到仓库根目录，包括:
   - index.html, style.css, app.js 等主文件
   - data/ 文件夹 (包含所有JSON数据文件)
4. 在GitHub仓库设置中启用GitHub Pages
5. 选择 "Deploy from a branch" 
6. 选择 "main" 分支和 "/ (root)" 文件夹
7. 等待几分钟，您的网站就会在 https://username.github.io/repository-name 上线

✨ 部署后的网站将自动加载静态数据，无需数据库！

注意: PDF文件已转换为base64格式存储在JSON中，首次加载可能较慢。
`;
        
        alert(instructions);
    }

    // Initialize static data loading (for deployed version)
    async initializeStaticMode() {
        try {
            this.staticLoader = new StaticDataLoader();
            const initialized = await this.staticLoader.initialize();
            
            if (initialized) {
                this.isStaticMode = true;
                console.log('Static mode initialized successfully');
                
                // Load papers from static data
                const staticPapers = this.staticLoader.getAllPapers();
                
                // Convert static data format to internal format
                this.papers = staticPapers.map(paper => {
                    console.log('Processing paper:', paper.title);
                    
                    return {
                        ...paper,
                        // Ensure required fields are present with fallbacks
                        id: paper.id,
                        title: paper.title || 'Untitled',
                        authors: Array.isArray(paper.authors) ? paper.authors : 
                                paper.authors ? [paper.authors] : ['Unknown Author'],
                        year: paper.year || new Date().getFullYear(),
                        journal: paper.journal || paper.venue || 'Unknown Journal',
                        researchArea: paper.researchArea || 'General',
                        methodology: paper.methodology || 'Experimental', 
                        studyType: paper.studyType || 'Empirical',
                        keywords: Array.isArray(paper.keywords) ? paper.keywords : [],
                        citations: paper.citations || 0,
                        downloads: paper.downloads || 0,
                        hIndex: paper.hIndex || Math.floor((paper.citations || 0) / 3),
                        abstract: paper.abstract || '',
                        doi: paper.doi || '',
                        websiteUrl: paper.websiteUrl || '#',
                        pdfUrl: paper.pdfUrl || '#',
                        // Get thumbnail from static loader
                        thumbnail: this.staticLoader.getThumbnail(paper.id)
                    };
                });
                
                this.filteredPapers = [...this.papers];
                console.log(`Loaded ${this.papers.length} papers from static data`);
                console.log('Sample paper data:', this.papers[0]);
                
                this.showNotification(`📚 Loaded ${this.papers.length} papers from static data`, 'success');
                
                // Initialize UI components
                setTimeout(() => {
                    this.initializeFilters();
                    this.applyFilters();
                    console.log('Filters applied, papers should be visible now');
                }, 100);
                
                return true;
            }
        } catch (error) {
            console.log('Static mode not available, using local storage mode');
        }
        
        return false;
    }

    // PDF Viewer Methods
    viewPDF(pdfUrl, title) {
        this.showPdfViewer(pdfUrl, title);
    }
    
    showPdfViewerAndCloseModal(pdfUrl, title) {
        // Close the paper details modal first
        this.hidePaperModal();
        
        // Then show the PDF viewer
        this.showPdfViewer(pdfUrl, title);
    }
    
    showPdfViewer(pdfUrl, title) {
        if (!pdfUrl || pdfUrl === '#') {
            this.showNotification('PDF file is not available', 'warning');
            return;
        }
        
        // Set title
        document.getElementById('pdfViewerTitle').textContent = title || 'PDF Document';
        
        // Show modal and loading state
        document.getElementById('pdfViewerModal').classList.remove('hidden');
        document.getElementById('pdfLoading').classList.remove('hidden');
        document.getElementById('pdfScrollContainer').classList.add('hidden');
        document.getElementById('pdfError').classList.add('hidden');
        
        // Load and display PDF
        this.loadPdfContent(pdfUrl);
    }
    
    async loadPdfContent(pdfUrl) {
        try {
            // Convert data URL to array buffer if needed
            let pdfData;
            if (pdfUrl.startsWith('data:application/pdf')) {
                // Convert base64 to array buffer
                const base64Data = pdfUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                pdfData = bytes.buffer;
            } else if (pdfUrl.startsWith('blob:')) {
                // Fetch blob data
                const response = await fetch(pdfUrl);
                pdfData = await response.arrayBuffer();
            } else {
                throw new Error('Unsupported PDF URL format');
            }
            
            // Initialize PDF.js if available
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js library not loaded');
            }
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            // Load PDF document
            const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
            
            // Clear loading state
            document.getElementById('pdfLoading').classList.add('hidden');
            document.getElementById('pdfScrollContainer').classList.remove('hidden');
            
            // Render all pages
            await this.renderAllPdfPages(pdf);
            
        } catch (error) {
            console.error('PDF loading error:', error);
            document.getElementById('pdfLoading').classList.add('hidden');
            document.getElementById('pdfError').classList.remove('hidden');
        }
    }
    
    async renderAllPdfPages(pdf) {
        const container = document.getElementById('pdfPagesContainer');
        container.innerHTML = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                
                // Create page wrapper
                const pageWrapper = document.createElement('div');
                pageWrapper.className = 'pdf-page-wrapper';
                
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-page-canvas';
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Create page label
                const pageLabel = document.createElement('div');
                pageLabel.className = 'pdf-page-label';
                pageLabel.textContent = `Page ${pageNum}`;
                
                // Render page
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                await page.render(renderContext).promise;
                
                // Add to DOM
                pageWrapper.appendChild(canvas);
                pageWrapper.appendChild(pageLabel);
                container.appendChild(pageWrapper);
                
            } catch (error) {
                console.error(`Error rendering page ${pageNum}:`, error);
                
                // Add error placeholder
                const errorDiv = document.createElement('div');
                errorDiv.className = 'pdf-page-error';
                errorDiv.innerHTML = `<p>Unable to render page ${pageNum}</p>`;
                container.appendChild(errorDiv);
            }
        }
    }
    
    closePdfViewer() {
        document.getElementById('pdfViewerModal').classList.add('hidden');
        
        // Clear PDF content
        const container = document.getElementById('pdfPagesContainer');
        container.innerHTML = '';
        
        // Reset modal state
        document.getElementById('pdfLoading').classList.remove('hidden');
        document.getElementById('pdfScrollContainer').classList.add('hidden');
        document.getElementById('pdfError').classList.add('hidden');
    }
    
    // Override PDF viewing for static mode
    async openPDFViewerStatic(paperId) {
        if (this.isStaticMode) {
            try {
                // Load full paper data including PDF
                const paperData = await this.staticLoader.getPaperData(paperId);
                
                if (paperData && paperData.pdfUrl) {
                    // Use the existing PDF viewer with the blob URL
                    this.viewPDF(paperData.pdfUrl, paperData.title);
                } else {
                    this.showNotification('PDF file not available for this paper', 'warning');
                }
            } catch (error) {
                console.error('Failed to load PDF in static mode:', error);
                this.showNotification('Failed to load PDF file', 'error');
            }
        } else {
            // Use original method for local storage mode
            this.viewPDFFromStorage(paperId);
        }
    }
    
    async viewPDFFromStorage(paperId) {
        const paper = this.papers.find(p => p.id === paperId);
        if (!paper) {
            this.showNotification('Paper not found', 'error');
            return;
        }
        
        if (paper.pdfUrl && paper.pdfUrl !== '#') {
            this.showPdfViewer(paper.pdfUrl, paper.title);
        } else {
            this.showNotification('PDF file not available for this paper', 'warning');
        }
    }
}

// Initialize the application
let literatureManager;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize main app directly
    initializeLiteratureManager();
});

function initializeLiteratureManager() {
    literatureManager = new LiteratureManager();
    window.literatureManager = literatureManager; // For global access
}
