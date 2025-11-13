const { Plugin, ItemView, PluginSettingTab, Setting, TFile } = require('obsidian');

const VIEW_TYPE = 'start-page-view';

class StartPageView extends ItemView {
    constructor(leaf, app, plugin) {
        super(leaf);
        this.app = app;
        this.plugin = plugin;
        this.icon = 'home';
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return 'Start Page';
    }

    getIcon() {
        return 'home';
    }

    async onOpen() {
        // Hide sidebars when start page opens
        this.hideSidebars();

        await this.renderContent();

        // Listen for file changes
        this.registerEvent(this.app.vault.on('modify', () => this.renderContent()));
        this.registerEvent(this.app.vault.on('create', () => this.renderContent()));
        this.registerEvent(this.app.vault.on('delete', () => this.renderContent()));
        this.registerEvent(this.app.vault.on('rename', () => this.renderContent()));
    }

    hideSidebars() {
        // Hide left sidebar
        const leftSplit = this.app.workspace.leftSplit;
        if (leftSplit && !leftSplit.collapsed) {
            this.app.workspace.leftSplit.collapse();
        }

        // Hide right sidebar
        const rightSplit = this.app.workspace.rightSplit;
        if (rightSplit && !rightSplit.collapsed) {
            this.app.workspace.rightSplit.collapse();
        }
    }

    async onClose() {
        // Cleanup
    }

    async renderContent() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('start-page-container');

        // Create tabs
        const tabsContainer = container.createEl('div', { cls: 'tabs-container' });

        const notesTab = tabsContainer.createEl('div', { text: 'Notes', cls: 'tab tab-active' });
        const calendarTab = tabsContainer.createEl('div', { text: 'Calendar', cls: 'tab' });
        const tasksTab = tabsContainer.createEl('div', { text: 'Tasks', cls: 'tab' });
        const trashTab = tabsContainer.createEl('div', { text: 'Trash', cls: 'tab' });

        // Tab content container
        const contentArea = container.createEl('div', { cls: 'tab-content' });

        // Store contentArea reference for use in dialogs
        this.currentContentArea = contentArea;

        // Tab switching logic
        const tabs = [notesTab, calendarTab, tasksTab, trashTab];
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.removeClass('tab-active'));
                tab.addClass('tab-active');

                if (tab === notesTab) {
                    this.renderNotesTab(contentArea);
                } else if (tab === calendarTab) {
                    this.renderCalendarTab(contentArea);
                } else if (tab === tasksTab) {
                    this.renderTasksTab(contentArea);
                } else if (tab === trashTab) {
                    this.renderTrashTab(contentArea);
                }
            });
        });

        // Render initial tab (Notes)
        this.renderNotesTab(contentArea);
    }

    async renderNotesTab(contentArea, selectedTag = null) {
        // Ensure we're using the correct content area
        if (!contentArea) {
            contentArea = this.currentContentArea;
        }

        // Clear all existing content
        contentArea.empty();

        // Get all files and their tags
        const allFiles = this.app.vault.getMarkdownFiles();
        const allTags = new Set();

        for (const file of allFiles) {
            const content = await this.app.vault.cachedRead(file);
            const tags = this.extractTags(content);
            tags.forEach(tag => allTags.add(tag));
        }

        // Get recent files
        let recentFiles = await this.getRecentFiles(this.plugin.settings.recentNotesLimit);

        // Filter by tag if selected
        if (selectedTag) {
            const filteredFiles = [];
            for (const file of recentFiles) {
                const content = await this.app.vault.cachedRead(file);
                const tags = this.extractTags(content);
                if (tags.includes(selectedTag)) {
                    filteredFiles.push(file);
                }
            }
            recentFiles = filteredFiles;
        }

        // Create header
        const header = contentArea.createEl('div', { cls: 'recent-notes-header' });
        const title = selectedTag ? `Documents tagged ${selectedTag}` : 'Recent documents';
        header.createEl('h2', { text: title, cls: 'section-title' });

        // Create controls
        const controls = header.createEl('div', { cls: 'header-controls' });

        // Record button
        const recordBtnText = this.isRecording ? '■ Stop' : '● Record';
        const recordBtn = controls.createEl('button', {
            text: recordBtnText,
            cls: this.isRecording ? 'record-btn recording' : 'record-btn'
        });
        recordBtn.addEventListener('click', async () => {
            this.startRecording(contentArea);
        });

        // New note button
        const newNoteBtn = controls.createEl('button', { text: 'New note', cls: 'new-note-btn' });
        newNoteBtn.addEventListener('click', async () => {
            const file = await this.app.vault.create(`Untitled-${Date.now()}.md`, '');
            this.app.workspace.openLinkText(file.path, '', false);
        });

        // Dropdown for file count
        controls.createEl('span', { text: 'Show count', cls: 'recent-notes-limit-label' });
        const select = controls.createEl('select');
        for (let i = 5; i <= 50; i += 5) {
            const option = select.createEl('option', { value: i.toString(), text: i.toString() });
            if (i === this.plugin.settings.recentNotesLimit) {
                option.selected = true;
            }
        }
        select.addEventListener('change', async () => {
            this.plugin.settings.recentNotesLimit = parseInt(select.value);
            await this.plugin.saveSettings();
            this.renderNotesTab(contentArea, selectedTag);
        });

        // Create tag filter bar (after header)
        if (allTags.size > 0) {
            const tagFilterBar = contentArea.createEl('div', { cls: 'tag-filter-bar' });

            const allTagBtn = tagFilterBar.createEl('button', {
                text: 'All',
                cls: selectedTag ? 'filter-tag' : 'filter-tag active'
            });
            allTagBtn.addEventListener('click', () => {
                this.renderNotesTab(contentArea, null);
            });

            const sortedTags = Array.from(allTags).sort();
            sortedTags.forEach(tag => {
                const tagBtn = tagFilterBar.createEl('button', {
                    text: tag,
                    cls: selectedTag === tag ? 'filter-tag active' : 'filter-tag'
                });
                tagBtn.addEventListener('click', () => {
                    this.renderNotesTab(contentArea, tag);
                });
            });
        }

        // Create grid of file cards
        const grid = contentArea.createEl('div', { cls: 'notes-grid' });

        if (recentFiles.length === 0) {
            const emptyMsg = grid.createEl('div', {
                text: `No documents found${selectedTag ? ' with this tag' : ''}`,
                cls: 'empty-message'
            });
        } else {
            for (const file of recentFiles) {
                const card = await this.createFileCard(file, contentArea, selectedTag);
                grid.appendChild(card);
            }
        }
    }

    async createFileCard(file, contentArea = null, selectedTag = null) {
        const card = document.createElement('div');
        card.addClass('note-card');

        // Read file content for preview
        const content = await this.app.vault.cachedRead(file);
        const preview = this.getPreviewText(content);
        const tags = this.extractTags(content);

        // Preview area
        const previewArea = card.createEl('div', { cls: 'note-preview' });

        // Create preview lines
        const lines = preview.split('\n').slice(0, 8);
        lines.forEach(line => {
            const lineEl = previewArea.createEl('div', { cls: 'preview-line' });
            lineEl.textContent = line || ' ';
        });

        // File info area
        const info = card.createEl('div', { cls: 'note-info' });

        const titleRow = info.createEl('div', { cls: 'note-title-row' });
        titleRow.createEl('div', { text: file.basename, cls: 'note-title' });

        // Button container for actions
        const btnContainer = titleRow.createEl('div', { cls: 'note-actions' });

        // Add tag button
        const addTagBtn = btnContainer.createEl('button', { text: '+', cls: 'add-tag-btn' });
        addTagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAddTagDialog(file, card);
        });

        // Delete button
        const deleteBtn = btnContainer.createEl('button', { text: '×', cls: 'delete-note-btn' });
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.deleteNote(file, contentArea, selectedTag);
        });

        // Display existing tags
        if (tags.length > 0) {
            const tagsContainer = info.createEl('div', { cls: 'tags-container' });
            tags.forEach(tag => {
                const tagEl = tagsContainer.createEl('span', { text: tag, cls: 'tag-badge' });
                tagEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Filter by this tag using the stored content area reference
                    this.renderNotesTab(this.currentContentArea, tag);
                });
            });
        }

        const meta = this.getFileMeta(file);
        info.createEl('div', { text: meta, cls: 'note-meta' });

        // Click handler for card
        card.addEventListener('click', () => {
            this.app.workspace.openLinkText(file.path, '', false);
        });

        return card;
    }

    async deleteNote(file, contentArea, selectedTag) {
        try {
            // Read file content before deleting
            const content = await this.app.vault.cachedRead(file);

            // Create trash entry
            const trashEntry = {
                id: Date.now().toString(),
                filename: file.basename,
                path: file.path,
                content: content,
                deletedAt: Date.now(),
                deletedDate: new Date().toLocaleString()
            };

            // Add to trash
            this.plugin.settings.trashedNotes.push(trashEntry);
            await this.plugin.saveSettings();

            // Delete the actual file
            await this.app.vault.delete(file);

            // Refresh the notes view
            this.renderNotesTab(this.currentContentArea, selectedTag);
        } catch (error) {
            alert('Failed to delete note: ' + error.message);
        }
    }

    extractTags(content) {
        const tagRegex = /#[\w-]+/g;
        const matches = content.match(tagRegex);
        if (!matches) return [];

        // Remove duplicates and return
        return [...new Set(matches)];
    }

    async showAddTagDialog(file, card) {
        const modal = document.createElement('div');
        modal.addClass('tag-modal');

        const modalContent = modal.createEl('div', { cls: 'tag-modal-content' });
        modalContent.createEl('h3', { text: 'Add tag to ' + file.basename });

        // Get all existing tags from all files
        const allFiles = this.app.vault.getMarkdownFiles();
        const allTags = new Set();

        for (const f of allFiles) {
            const content = await this.app.vault.cachedRead(f);
            const tags = this.extractTags(content);
            tags.forEach(tag => allTags.add(tag));
        }

        // Show existing tags as suggestions
        if (allTags.size > 0) {
            modalContent.createEl('p', { text: 'Existing tags:', cls: 'tag-suggestions-label' });
            const suggestionsContainer = modalContent.createEl('div', { cls: 'tag-suggestions' });

            const sortedTags = Array.from(allTags).sort();
            sortedTags.forEach(tag => {
                const tagBtn = suggestionsContainer.createEl('button', {
                    text: tag,
                    cls: 'tag-suggestion-btn'
                });
                tagBtn.addEventListener('click', async () => {
                    await this.addTagToFile(file, tag);
                    document.body.removeChild(modal);
                    // Update only this card instead of re-rendering everything
                    await this.updateCardTags(card, file);
                });
            });

            modalContent.createEl('p', { text: 'Or enter a new tag:', cls: 'tag-suggestions-label' });
        }

        const input = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Enter tag (without #)',
            cls: 'tag-input'
        });

        const buttonRow = modalContent.createEl('div', { cls: 'button-row' });
        const addBtn = buttonRow.createEl('button', { text: 'Add', cls: 'modal-btn primary' });
        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel', cls: 'modal-btn' });

        addBtn.addEventListener('click', async () => {
            const tag = input.value.trim();
            if (tag) {
                await this.addTagToFile(file, tag);
                document.body.removeChild(modal);
                // Update only this card instead of re-rendering everything
                await this.updateCardTags(card, file);
            }
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

        document.body.appendChild(modal);
        input.focus();

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async updateCardTags(card, file) {
        // Read updated file content
        const content = await this.app.vault.cachedRead(file);
        const tags = this.extractTags(content);

        // Find the note-info section in the card
        const noteInfo = card.querySelector('.note-info');
        if (!noteInfo) return;

        // Remove old tags container if it exists
        const oldTagsContainer = noteInfo.querySelector('.tags-container');
        if (oldTagsContainer) {
            oldTagsContainer.remove();
        }

        // Add new tags container if there are tags
        if (tags.length > 0) {
            // Find where to insert (after title row, before meta)
            const titleRow = noteInfo.querySelector('.note-title-row');
            const metaEl = noteInfo.querySelector('.note-meta');

            const tagsContainer = document.createElement('div');
            tagsContainer.addClass('tags-container');

            tags.forEach(tag => {
                const tagEl = tagsContainer.createEl('span', { text: tag, cls: 'tag-badge' });
                tagEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Filter by this tag using the stored content area reference
                    this.renderNotesTab(this.currentContentArea, tag);
                });
            });

            // Insert after title row but before meta
            noteInfo.insertBefore(tagsContainer, metaEl);
        }
    }

    async addTagToFile(file, tag) {
        // Ensure tag starts with #
        if (!tag.startsWith('#')) {
            tag = '#' + tag;
        }

        let content = await this.app.vault.read(file);

        // Add tag at the end if it doesn't exist
        if (!content.includes(tag)) {
            content = content.trim() + '\n\n' + tag;
            await this.app.vault.modify(file, content);
        }
    }

    async startRecording(contentArea) {
        // Check if browser supports audio recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Audio recording is not supported in your browser');
            return;
        }

        // If already recording, stop it
        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                this.audioChunks.push(event.data);
            });

            this.mediaRecorder.addEventListener('stop', async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.saveRecording(audioBlob);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                this.isRecording = false;
                this.renderNotesTab(contentArea);
            });

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Update UI
            this.renderNotesTab(contentArea);

        } catch (error) {
            alert('Could not access microphone: ' + error.message);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    async saveRecording(audioBlob) {
        const timestamp = Date.now();
        const fileName = `Recording-${timestamp}.wav`;

        // Convert WebM to WAV
        const wavBlob = await this.convertToWav(audioBlob);
        const arrayBuffer = await wavBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Create a new note with the recording
        const noteFileName = `Recording-${timestamp}.md`;
        const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const content = `# Voice Recording\n\nRecorded: ${new Date().toLocaleString()}\nDuration: ${duration}s\n\n[${fileName}](${fileName})`;

        // Save audio file
        await this.app.vault.createBinary(fileName, uint8Array);

        // Save markdown note
        await this.app.vault.create(noteFileName, content);
    }

    async convertToWav(audioBlob) {
        // Create an audio context to decode the audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert AudioBuffer to WAV format
        const wavBuffer = this.audioBufferToWav(audioBuffer);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    audioBufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const samples = audioBuffer.length;
        const dataSize = samples * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // Write WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true); // byte rate
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Write audio data
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }

        let offset = 44;
        for (let i = 0; i < samples; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, int16, true);
                offset += 2;
            }
        }

        return buffer;
    }

    getPreviewText(content) {
        // Remove frontmatter
        content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

        // Remove markdown formatting
        content = content.replace(/#{1,6}\s/g, ''); // Headers
        content = content.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
        content = content.replace(/\*(.+?)\*/g, '$1'); // Italic
        content = content.replace(/\[(.+?)\]\(.+?\)/g, '$1'); // Links
        content = content.replace(/`(.+?)`/g, '$1'); // Inline code
        content = content.replace(/^>\s/gm, ''); // Blockquotes
        content = content.replace(/^[-*+]\s/gm, ''); // List markers

        return content.trim();
    }

    getFileMeta(file) {
        const now = Date.now();
        const diff = now - file.stat.mtime;

        // Format time
        let timeStr;
        if (diff < 60000) {
            timeStr = 'just now';
        } else if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            timeStr = `${mins} minute${mins > 1 ? 's' : ''} ago`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            timeStr = `${days} day${days > 1 ? 's' : ''} ago`;
        } else {
            timeStr = new Date(file.stat.mtime).toLocaleDateString();
        }

        // Add folder path
        const folder = file.parent ? file.parent.path : '';
        return folder ? `${timeStr} • ${folder}` : timeStr;
    }

    async getRecentFiles(limit) {
        const lastOpenFiles = this.app.workspace.getLastOpenFiles();
        const files = this.app.vault.getMarkdownFiles();

        const scored = files.map(file => {
            let score = 0;
            const index = lastOpenFiles.indexOf(file.path);
            if (index !== -1) {
                score = Date.now() - (index * 60000);
            }
            const finalScore = Math.max(file.stat.mtime, score);
            return { file, score: finalScore };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map(item => item.file);
    }

    async renderCalendarTab(contentArea) {
        contentArea.empty();

        const calendarView = contentArea.createEl('div', { cls: 'calendar-view' });

        // View toggle buttons
        const viewToggle = calendarView.createEl('div', { cls: 'view-toggle' });
        const currentView = this.calendarViewMode || 'week';

        ['week', 'day'].forEach(view => {
            const btn = viewToggle.createEl('button', {
                text: view.charAt(0).toUpperCase() + view.slice(1),
                cls: currentView === view ? 'view-toggle-btn active' : 'view-toggle-btn'
            });
            btn.addEventListener('click', () => {
                this.calendarViewMode = view;
                this.renderCalendarTab(contentArea);
            });
        });

        // Header with navigation
        const header = calendarView.createEl('div', { cls: 'calendar-header' });

        const currentDate = this.currentCalendarDate || new Date();
        let titleText = '';

        if (currentView === 'week') {
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            titleText = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            titleText = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }

        const prevBtn = header.createEl('button', { text: '‹', cls: 'calendar-nav-btn' });
        const monthTitle = header.createEl('h2', { text: titleText, cls: 'calendar-title' });
        const nextBtn = header.createEl('button', { text: '›', cls: 'calendar-nav-btn' });
        const todayBtn = header.createEl('button', { text: 'Today', cls: 'calendar-today-btn' });

        prevBtn.addEventListener('click', () => {
            if (currentView === 'week') {
                this.currentCalendarDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else {
                this.currentCalendarDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
            }
            this.renderCalendarTab(contentArea);
        });

        nextBtn.addEventListener('click', () => {
            if (currentView === 'week') {
                this.currentCalendarDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else {
                this.currentCalendarDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
            }
            this.renderCalendarTab(contentArea);
        });

        todayBtn.addEventListener('click', () => {
            this.currentCalendarDate = new Date();
            this.renderCalendarTab(contentArea);
        });

        // Render appropriate view
        if (currentView === 'week') {
            this.renderWeekView(calendarView, currentDate);
        } else {
            this.renderDayView(calendarView, currentDate);
        }
    }


    renderWeekView(container, currentDate) {
        const weekContainer = container.createEl('div', { cls: 'week-view' });

        // Get start of week (Sunday)
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Create time slots for each hour with 15-minute intervals
        const hours = Array.from({ length: 24 }, (_, i) => i);

        const grid = weekContainer.createEl('div', { cls: 'time-grid' });

        // Header row with day names
        const headerRow = grid.createEl('div', { cls: 'time-grid-header' });
        headerRow.createEl('div', { cls: 'time-column-header' });

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            const isToday = this.isSameDay(day, new Date());

            const dayHeader = headerRow.createEl('div', {
                cls: isToday ? 'day-column-header today' : 'day-column-header'
            });
            dayHeader.createEl('div', { text: day.toLocaleDateString('en-US', { weekday: 'short' }), cls: 'day-name' });
            dayHeader.createEl('div', { text: day.getDate().toString(), cls: 'day-date' });
        }

        // Time grid
        const gridBody = grid.createEl('div', { cls: 'time-grid-body' });

        // Drag state
        let dragStartCell = null;
        let dragEndCell = null;
        let isDragging = false;

        hours.forEach(hour => {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

            // Create 4 rows of 15-minute blocks
            for (let quarter = 0; quarter < 4; quarter++) {
                const row = gridBody.createEl('div', { cls: 'time-row quarter-row' });

                // Show time label only on first quarter of the hour
                if (quarter === 0) {
                    row.createEl('div', { text: `${displayHour} ${ampm}`, cls: 'time-label' });
                } else {
                    row.createEl('div', { cls: 'quarter-spacer' });
                }

                for (let i = 0; i < 7; i++) {
                    const day = new Date(startOfWeek);
                    day.setDate(startOfWeek.getDate() + i);
                    const dateStr = this.formatDate(day);

                    const minutes = quarter * 15;
                    const timeSlot = hour * 4 + quarter; // 0-95 (24 hours * 4 quarters)

                    const cell = row.createEl('div', { cls: 'time-cell quarter-cell' });
                    cell.dataset.date = dateStr;
                    cell.dataset.timeslot = timeSlot;

                    // Mouse down - start drag
                    cell.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        dragStartCell = { date: dateStr, slot: timeSlot };
                        dragEndCell = { date: dateStr, slot: timeSlot };
                        cell.addClass('drag-selecting');
                    });

                    // Mouse enter - update drag
                    cell.addEventListener('mouseenter', (e) => {
                        if (isDragging && dragStartCell && dragStartCell.date === dateStr) {
                            container.querySelectorAll('.drag-selecting').forEach(c => c.removeClass('drag-selecting'));

                            dragEndCell = { date: dateStr, slot: timeSlot };
                            const startSlot = Math.min(dragStartCell.slot, dragEndCell.slot);
                            const endSlot = Math.max(dragStartCell.slot, dragEndCell.slot);

                            gridBody.querySelectorAll('.time-cell').forEach(c => {
                                if (c.dataset.date === dateStr) {
                                    const cellSlot = parseInt(c.dataset.timeslot);
                                    if (cellSlot >= startSlot && cellSlot <= endSlot) {
                                        c.addClass('drag-selecting');
                                    }
                                }
                            });
                        }
                    });

                    cell.addEventListener('click', (e) => {
                        if (!isDragging) {
                            const time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                            this.showAddEventDialog(dateStr, container.parentElement, time);
                        }
                    });

                    // Add events for this time slot
                    const dayEvents = this.getEventsForDate(dateStr);
                    dayEvents.forEach(event => {
                        if (event.time) {
                            const [eventHour, eventMin] = event.time.split(':').map(Number);
                            const eventSlot = eventHour * 4 + Math.floor(eventMin / 15);
                            if (eventSlot === timeSlot) {
                                const eventEl = cell.createEl('div', {
                                    text: event.title,
                                    cls: 'time-event'
                                });
                                if (event.tags && event.tags.length > 0) {
                                    eventEl.style.background = this.getTagColor(event.tags[0]);
                                    eventEl.style.color = 'white';
                                }
                                eventEl.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    this.showEventDetails(event, container.parentElement);
                                });
                            }
                        }
                    });
                }
            }
        });

        // Mouse up - finish drag and create event
        document.addEventListener('mouseup', async (e) => {
            if (isDragging && dragStartCell && dragEndCell) {
                isDragging = false;

                container.querySelectorAll('.drag-selecting').forEach(c => c.removeClass('drag-selecting'));

                const startSlot = Math.min(dragStartCell.slot, dragEndCell.slot);
                const endSlot = Math.max(dragStartCell.slot, dragEndCell.slot);

                // Convert slots back to time
                const startHour = Math.floor(startSlot / 4);
                const startMin = (startSlot % 4) * 15;
                const endHour = Math.floor((endSlot + 1) / 4);
                const endMin = ((endSlot + 1) % 4) * 15;

                const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

                this.showAddEventDialogWithDuration(dragStartCell.date, container.parentElement, startTime, endTime);

                dragStartCell = null;
                dragEndCell = null;
            }
        }, { once: false });

        // Add current time indicator
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSlot = currentHour * 4 + Math.floor(currentMinute / 15);
        const minuteOffset = currentMinute % 15;

        // Calculate position (each quarter is 15px min-height)
        const topPosition = currentSlot * 15 + (minuteOffset / 15) * 15;

        const timeIndicator = gridBody.createEl('div', { cls: 'current-time-indicator' });
        timeIndicator.style.top = `${topPosition}px`;

        // Auto-scroll to current time (center it if possible)
        setTimeout(() => {
            const scrollOffset = topPosition - (weekContainer.clientHeight / 2);
            weekContainer.scrollTop = Math.max(0, scrollOffset);
        }, 100);
    }

    renderDayView(container, currentDate) {
        const dayContainer = container.createEl('div', { cls: 'day-view' });

        const timeSlots = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
                          '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'];

        const dateStr = this.formatDate(currentDate);
        const dayEvents = this.getEventsForDate(dateStr);

        // Events without time (all-day events)
        const allDayEvents = dayEvents.filter(e => !e.time);
        if (allDayEvents.length > 0) {
            const allDaySection = dayContainer.createEl('div', { cls: 'all-day-events' });
            allDaySection.createEl('div', { text: 'All day', cls: 'all-day-label' });
            const allDayContainer = allDaySection.createEl('div', { cls: 'all-day-events-list' });

            allDayEvents.forEach(event => {
                const eventEl = allDayContainer.createEl('div', {
                    text: event.title,
                    cls: 'all-day-event'
                });
                if (event.tags && event.tags.length > 0) {
                    eventEl.style.borderLeft = `4px solid ${this.getTagColor(event.tags[0])}`;
                }
                eventEl.addEventListener('click', () => {
                    this.showEventDetails(event, container.parentElement);
                });
            });
        }

        // Time slots with 15-minute intervals
        const timeGrid = dayContainer.createEl('div', { cls: 'day-time-grid' });

        // Drag state
        let dragStartSlot = null;
        let dragEndSlot = null;
        let isDragging = false;

        const hours = Array.from({ length: 24 }, (_, i) => i);

        hours.forEach(hour => {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

            // Create 4 quarter rows
            for (let quarter = 0; quarter < 4; quarter++) {
                const minutes = quarter * 15;
                const timeSlot = hour * 4 + quarter;

                const row = timeGrid.createEl('div', { cls: 'day-hour-row' });

                // Show time label only on first quarter of the hour
                if (quarter === 0) {
                    row.createEl('div', { text: `${displayHour} ${ampm}`, cls: 'day-time-label' });
                } else {
                    row.createEl('div', { cls: 'day-time-spacer' });
                }

                const eventContainer = row.createEl('div', { cls: 'day-event-container quarter-block' });
                eventContainer.dataset.timeslot = timeSlot;

                // Mouse down - start drag
                eventContainer.addEventListener('mousedown', (e) => {
                    if (e.target.classList.contains('day-time-event')) return;

                    isDragging = true;
                    dragStartSlot = timeSlot;
                    dragEndSlot = timeSlot;
                    eventContainer.addClass('drag-selecting');
                });

                // Mouse enter - update drag
                eventContainer.addEventListener('mouseenter', (e) => {
                    if (isDragging) {
                        container.querySelectorAll('.drag-selecting').forEach(c => c.removeClass('drag-selecting'));

                        dragEndSlot = timeSlot;
                        const startSlot = Math.min(dragStartSlot, dragEndSlot);
                        const endSlot = Math.max(dragStartSlot, dragEndSlot);

                        timeGrid.querySelectorAll('.day-event-container').forEach(c => {
                            const cellSlot = parseInt(c.dataset.timeslot);
                            if (cellSlot >= startSlot && cellSlot <= endSlot) {
                                c.addClass('drag-selecting');
                            }
                        });
                    }
                });

                eventContainer.addEventListener('click', (e) => {
                    if (!isDragging && !e.target.classList.contains('day-time-event')) {
                        const time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        this.showAddEventDialog(dateStr, container.parentElement, time);
                    }
                });

                // Add events for this time slot
                dayEvents.forEach(event => {
                    if (event.time) {
                        const [eventHour, eventMin] = event.time.split(':').map(Number);
                        const eventSlot = eventHour * 4 + Math.floor(eventMin / 15);
                        if (eventSlot === timeSlot) {
                            const eventEl = eventContainer.createEl('div', {
                                text: `${event.time} - ${event.title}`,
                                cls: 'day-time-event'
                            });
                            if (event.tags && event.tags.length > 0) {
                                eventEl.style.background = this.getTagColor(event.tags[0]);
                                eventEl.style.color = 'white';
                            }
                            eventEl.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.showEventDetails(event, container.parentElement);
                            });
                        }
                    }
                });
            }
        });

        // Mouse up - finish drag and create event
        document.addEventListener('mouseup', async (e) => {
            if (isDragging && dragStartSlot !== null && dragEndSlot !== null) {
                isDragging = false;

                container.querySelectorAll('.drag-selecting').forEach(c => c.removeClass('drag-selecting'));

                const startSlot = Math.min(dragStartSlot, dragEndSlot);
                const endSlot = Math.max(dragStartSlot, dragEndSlot);

                // Convert slots back to time
                const startHour = Math.floor(startSlot / 4);
                const startMin = (startSlot % 4) * 15;
                const endHour = Math.floor((endSlot + 1) / 4);
                const endMin = ((endSlot + 1) % 4) * 15;

                const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

                this.showAddEventDialogWithDuration(dateStr, container.parentElement, startTime, endTime);

                dragStartSlot = null;
                dragEndSlot = null;
            }
        }, { once: false });

        // Add current time indicator
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSlot = currentHour * 4 + Math.floor(currentMinute / 15);
        const minuteOffset = currentMinute % 15;

        // Calculate position (each quarter is 15px min-height)
        const topPosition = currentSlot * 15 + (minuteOffset / 15) * 15;

        const timeIndicator = timeGrid.createEl('div', { cls: 'current-time-indicator' });
        timeIndicator.style.top = `${topPosition}px`;

        // Auto-scroll to current time (center it if possible)
        setTimeout(() => {
            const scrollOffset = topPosition - (dayContainer.clientHeight / 2);
            dayContainer.scrollTop = Math.max(0, scrollOffset);
        }, 100);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    getEventsForDate(dateStr) {
        return this.plugin.settings.calendarEvents.filter(event => event.date === dateStr);
    }

    getTagColor(tag) {
        const colors = {
            'work': '#3b82f6',
            'personal': '#10b981',
            'urgent': '#ef4444',
            'meeting': '#8b5cf6',
            'deadline': '#f59e0b'
        };
        const tagLower = tag.toLowerCase().replace('#', '');
        return colors[tagLower] || '#6b7280';
    }

    showAddEventDialogWithDuration(dateStr, contentArea, startTime, endTime) {
        const modal = document.createElement('div');
        modal.addClass('event-modal');

        const modalContent = modal.createEl('div', { cls: 'event-modal-content' });
        modalContent.createEl('h3', { text: 'New Event' });

        // Event title
        modalContent.createEl('label', { text: 'Title', cls: 'event-label' });
        const titleInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Event title',
            cls: 'event-input'
        });

        // Date
        modalContent.createEl('label', { text: 'Date', cls: 'event-label' });
        const dateInput = modalContent.createEl('input', {
            type: 'date',
            cls: 'event-input'
        });
        dateInput.value = dateStr;

        // Start and end time
        const timeRow = modalContent.createEl('div', { cls: 'time-row-input' });

        const startCol = timeRow.createEl('div', { cls: 'time-col' });
        startCol.createEl('label', { text: 'Start time', cls: 'event-label' });
        const startTimeInput = startCol.createEl('input', {
            type: 'time',
            cls: 'event-input'
        });
        startTimeInput.value = startTime;

        const endCol = timeRow.createEl('div', { cls: 'time-col' });
        endCol.createEl('label', { text: 'End time', cls: 'event-label' });
        const endTimeInput = endCol.createEl('input', {
            type: 'time',
            cls: 'event-input'
        });
        endTimeInput.value = endTime;

        // Description
        modalContent.createEl('label', { text: 'Description (optional)', cls: 'event-label' });
        const descInput = modalContent.createEl('textarea', {
            placeholder: 'Event description',
            cls: 'event-textarea'
        });

        // Tags
        modalContent.createEl('label', { text: 'Tags', cls: 'event-label' });
        const tagsInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Add tags (comma-separated)',
            cls: 'event-input'
        });

        // Buttons
        const buttonRow = modalContent.createEl('div', { cls: 'button-row' });
        const saveBtn = buttonRow.createEl('button', { text: 'Save', cls: 'modal-btn primary' });
        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel', cls: 'modal-btn' });

        saveBtn.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            if (!title) return;

            const tags = tagsInput.value.split(',').map(t => {
                const tag = t.trim();
                return tag.startsWith('#') ? tag : '#' + tag;
            }).filter(t => t.length > 1);

            const event = {
                id: Date.now().toString(),
                title,
                date: dateInput.value,
                time: startTimeInput.value || null,
                endTime: endTimeInput.value || null,
                description: descInput.value || null,
                tags
            };

            this.plugin.settings.calendarEvents.push(event);
            await this.plugin.saveSettings();
            document.body.removeChild(modal);
            this.renderCalendarTab(contentArea);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.body.appendChild(modal);
        titleInput.focus();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showAddEventDialog(dateStr, contentArea, defaultTime = null) {
        const modal = document.createElement('div');
        modal.addClass('event-modal');

        const modalContent = modal.createEl('div', { cls: 'event-modal-content' });
        modalContent.createEl('h3', { text: 'New Event' });

        // Event title
        modalContent.createEl('label', { text: 'Title', cls: 'event-label' });
        const titleInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Event title',
            cls: 'event-input'
        });

        // Date
        modalContent.createEl('label', { text: 'Date', cls: 'event-label' });
        const dateInput = modalContent.createEl('input', {
            type: 'date',
            cls: 'event-input'
        });
        dateInput.value = dateStr;

        // Time
        modalContent.createEl('label', { text: 'Time (optional)', cls: 'event-label' });
        const timeInput = modalContent.createEl('input', {
            type: 'time',
            cls: 'event-input'
        });
        if (defaultTime) timeInput.value = defaultTime;

        // Description
        modalContent.createEl('label', { text: 'Description (optional)', cls: 'event-label' });
        const descInput = modalContent.createEl('textarea', {
            placeholder: 'Event description',
            cls: 'event-textarea'
        });

        // Tags
        modalContent.createEl('label', { text: 'Tags', cls: 'event-label' });
        const tagsInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Add tags (comma-separated)',
            cls: 'event-input'
        });

        // Buttons
        const buttonRow = modalContent.createEl('div', { cls: 'button-row' });
        const saveBtn = buttonRow.createEl('button', { text: 'Save', cls: 'modal-btn primary' });
        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel', cls: 'modal-btn' });

        saveBtn.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            if (!title) return;

            const tags = tagsInput.value.split(',').map(t => {
                const tag = t.trim();
                return tag.startsWith('#') ? tag : '#' + tag;
            }).filter(t => t.length > 1);

            const event = {
                id: Date.now().toString(),
                title,
                date: dateInput.value,
                time: timeInput.value || null,
                description: descInput.value || null,
                tags
            };

            this.plugin.settings.calendarEvents.push(event);
            await this.plugin.saveSettings();
            document.body.removeChild(modal);
            this.renderCalendarTab(contentArea);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.body.appendChild(modal);
        titleInput.focus();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showEventDetails(event, contentArea) {
        const modal = document.createElement('div');
        modal.addClass('event-modal');

        const modalContent = modal.createEl('div', { cls: 'event-modal-content' });
        modalContent.createEl('h3', { text: event.title });

        // Display event details
        const detailsContainer = modalContent.createEl('div', { cls: 'event-details' });

        const dateText = event.time ?
            `${new Date(event.date).toLocaleDateString()} at ${event.time}` :
            new Date(event.date).toLocaleDateString();
        detailsContainer.createEl('p', { text: dateText, cls: 'event-detail-date' });

        if (event.description) {
            detailsContainer.createEl('p', { text: event.description, cls: 'event-detail-desc' });
        }

        if (event.tags && event.tags.length > 0) {
            const tagsContainer = detailsContainer.createEl('div', { cls: 'event-tags' });
            event.tags.forEach(tag => {
                const tagEl = tagsContainer.createEl('span', { text: tag, cls: 'tag-badge' });
                tagEl.style.background = this.getTagColor(tag);
            });
        }

        // Buttons
        const buttonRow = modalContent.createEl('div', { cls: 'button-row' });
        const editBtn = buttonRow.createEl('button', { text: 'Edit', cls: 'modal-btn' });
        const deleteBtn = buttonRow.createEl('button', { text: 'Delete', cls: 'modal-btn danger' });
        const closeBtn = buttonRow.createEl('button', { text: 'Close', cls: 'modal-btn' });

        editBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            this.showEditEventDialog(event, contentArea);
        });

        deleteBtn.addEventListener('click', async () => {
            if (confirm('Delete this event?')) {
                this.plugin.settings.calendarEvents = this.plugin.settings.calendarEvents.filter(e => e.id !== event.id);
                await this.plugin.saveSettings();
                document.body.removeChild(modal);
                this.renderCalendarTab(contentArea);
            }
        });

        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showEditEventDialog(event, contentArea) {
        const modal = document.createElement('div');
        modal.addClass('event-modal');

        const modalContent = modal.createEl('div', { cls: 'event-modal-content' });
        modalContent.createEl('h3', { text: 'Edit Event' });

        // Event title
        modalContent.createEl('label', { text: 'Title', cls: 'event-label' });
        const titleInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Event title',
            cls: 'event-input'
        });
        titleInput.value = event.title;

        // Date
        modalContent.createEl('label', { text: 'Date', cls: 'event-label' });
        const dateInput = modalContent.createEl('input', {
            type: 'date',
            cls: 'event-input'
        });
        dateInput.value = event.date;

        // Time
        modalContent.createEl('label', { text: 'Time (optional)', cls: 'event-label' });
        const timeInput = modalContent.createEl('input', {
            type: 'time',
            cls: 'event-input'
        });
        if (event.time) timeInput.value = event.time;

        // Description
        modalContent.createEl('label', { text: 'Description (optional)', cls: 'event-label' });
        const descInput = modalContent.createEl('textarea', {
            placeholder: 'Event description',
            cls: 'event-textarea'
        });
        if (event.description) descInput.value = event.description;

        // Tags
        modalContent.createEl('label', { text: 'Tags', cls: 'event-label' });
        const tagsInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Add tags (comma-separated)',
            cls: 'event-input'
        });
        if (event.tags) tagsInput.value = event.tags.join(', ');

        // Buttons
        const buttonRow = modalContent.createEl('div', { cls: 'button-row' });
        const saveBtn = buttonRow.createEl('button', { text: 'Save', cls: 'modal-btn primary' });
        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel', cls: 'modal-btn' });

        saveBtn.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            if (!title) return;

            const tags = tagsInput.value.split(',').map(t => {
                const tag = t.trim();
                return tag.startsWith('#') ? tag : '#' + tag;
            }).filter(t => t.length > 1);

            const eventIndex = this.plugin.settings.calendarEvents.findIndex(e => e.id === event.id);
            if (eventIndex !== -1) {
                this.plugin.settings.calendarEvents[eventIndex] = {
                    id: event.id,
                    title,
                    date: dateInput.value,
                    time: timeInput.value || null,
                    description: descInput.value || null,
                    tags
                };
                await this.plugin.saveSettings();
            }

            document.body.removeChild(modal);
            this.renderCalendarTab(contentArea);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.body.appendChild(modal);
        titleInput.focus();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async renderTrashTab(contentArea) {
        contentArea.empty();

        const trashView = contentArea.createEl('div', { cls: 'trash-view' });

        // Header
        const header = trashView.createEl('div', { cls: 'recent-notes-header' });
        header.createEl('h2', { text: 'Trash', cls: 'section-title' });

        const controls = header.createEl('div', { cls: 'header-controls' });

        // Empty trash button
        if (this.plugin.settings.trashedNotes.length > 0) {
            const emptyTrashBtn = controls.createEl('button', {
                text: 'Empty Trash',
                cls: 'empty-trash-btn'
            });
            emptyTrashBtn.addEventListener('click', async () => {
                const confirmed = confirm('Permanently delete all items in trash? This cannot be undone.');
                if (confirmed) {
                    this.plugin.settings.trashedNotes = [];
                    await this.plugin.saveSettings();
                    this.renderTrashTab(contentArea);
                }
            });
        }

        // Grid of trash cards
        const grid = trashView.createEl('div', { cls: 'notes-grid' });

        if (this.plugin.settings.trashedNotes.length === 0) {
            grid.createEl('div', {
                text: 'Trash is empty',
                cls: 'empty-message'
            });
        } else {
            // Sort by deletion date (newest first)
            const sortedTrash = [...this.plugin.settings.trashedNotes].sort((a, b) => b.deletedAt - a.deletedAt);

            sortedTrash.forEach(trashItem => {
                const card = this.createTrashCard(trashItem, contentArea);
                grid.appendChild(card);
            });
        }
    }

    createTrashCard(trashItem, contentArea) {
        const card = document.createElement('div');
        card.addClass('note-card', 'trash-card');

        // Preview area
        const preview = this.getPreviewText(trashItem.content);
        const previewArea = card.createEl('div', { cls: 'note-preview' });

        const lines = preview.split('\n').slice(0, 8);
        lines.forEach(line => {
            const lineEl = previewArea.createEl('div', { cls: 'preview-line' });
            lineEl.textContent = line || ' ';
        });

        // File info area
        const info = card.createEl('div', { cls: 'note-info' });

        const titleRow = info.createEl('div', { cls: 'note-title-row' });
        titleRow.createEl('div', { text: trashItem.filename, cls: 'note-title' });

        // Button container for actions
        const btnContainer = titleRow.createEl('div', { cls: 'note-actions' });

        // Restore button
        const restoreBtn = btnContainer.createEl('button', { text: '↻', cls: 'restore-note-btn' });
        restoreBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.restoreNote(trashItem, contentArea);
        });

        // Permanent delete button
        const deleteBtn = btnContainer.createEl('button', { text: '×', cls: 'delete-note-btn' });
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.permanentlyDeleteNote(trashItem, contentArea);
        });

        // Meta info
        info.createEl('div', {
            text: `Deleted: ${trashItem.deletedDate}`,
            cls: 'note-meta'
        });

        // Click handler for card (preview content)
        card.addEventListener('click', () => {
            // Could show a modal with the full content
        });

        return card;
    }

    async restoreNote(trashItem, contentArea) {
        try {
            // Recreate the file
            await this.app.vault.create(trashItem.path, trashItem.content);

            // Remove from trash
            this.plugin.settings.trashedNotes = this.plugin.settings.trashedNotes.filter(
                item => item.id !== trashItem.id
            );
            await this.plugin.saveSettings();

            // Refresh trash view
            this.renderTrashTab(contentArea);
        } catch (error) {
            alert('Failed to restore note: ' + error.message);
        }
    }

    async permanentlyDeleteNote(trashItem, contentArea) {
        const confirmed = confirm(`Permanently delete "${trashItem.filename}"? This cannot be undone.`);
        if (!confirmed) return;

        try {
            // Remove from trash
            this.plugin.settings.trashedNotes = this.plugin.settings.trashedNotes.filter(
                item => item.id !== trashItem.id
            );
            await this.plugin.saveSettings();

            // Refresh trash view
            this.renderTrashTab(contentArea);
        } catch (error) {
            alert('Failed to delete note: ' + error.message);
        }
    }

    renderTasksTab(contentArea) {
        contentArea.empty();
        const tasksView = contentArea.createEl('div', { cls: 'tasks-view' });
        tasksView.createEl('h2', { text: 'Tasks', cls: 'section-title' });
        tasksView.createEl('p', { text: 'Tasks view coming soon...', cls: 'placeholder-text' });
    }
}

class StartPageSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Recent notes limit')
            .setDesc('Number of recent files to show')
            .addDropdown(dropdown => {
                for (let i = 5; i <= 50; i += 5) {
                    dropdown.addOption(i.toString(), i.toString());
                }
                dropdown.setValue(this.plugin.settings.recentNotesLimit.toString());
                dropdown.onChange(async (value) => {
                    this.plugin.settings.recentNotesLimit = parseInt(value);
                    await this.plugin.saveSettings();
                    this.refreshStartPage();
                });
            });

        new Setting(containerEl)
            .setName('Replace new tab')
            .setDesc('Open start page when creating a new tab')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.replaceNewTab);
                toggle.onChange(async (value) => {
                    this.plugin.settings.replaceNewTab = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    refreshStartPage() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => {
            if (leaf.view instanceof StartPageView) {
                leaf.view.renderContent();
            }
        });
    }
}

const DEFAULT_SETTINGS = {
    recentNotesLimit: 20,
    replaceNewTab: true,
    calendarEvents: [],
    trashedNotes: []
};

class StartPagePlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE,
            (leaf) => new StartPageView(leaf, this.app, this)
        );

        this.addRibbonIcon('home', 'Open start page', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-start-page',
            name: 'Open start page',
            callback: () => {
                this.activateView();
            }
        });

        this.addSettingTab(new StartPageSettingTab(this.app, this));

        // Replace new tab
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (this.settings.replaceNewTab && leaf) {
                    const state = leaf.getViewState();
                    if (state.type === 'empty') {
                        this.replaceWithStartPage(leaf);
                    }
                }
            })
        );
    }

    async activateView() {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true
        });
    }

    async replaceWithStartPage(leaf) {
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => leaf.detach());
    }
}

module.exports = StartPagePlugin;
