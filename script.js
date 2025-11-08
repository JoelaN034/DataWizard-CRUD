// Cache implementation
class DataCache {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 300000; // 5 minutes cache
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        const now = Date.now();
        if (now - item.timestamp > this.cacheDuration) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }

    clear() {
        this.cache.clear();
    }

    refresh(key, fetchFunction) {
        return fetchFunction().then(data => {
            this.set(key, data);
            return data;
        });
    }
}

// Main application
class CRUDApp {
    constructor() {
        this.cache = new DataCache();
        this.apiUrl = 'https://jsonplaceholder.typicode.com/users'; // Using placeholder API
        this.initElements();
        this.bindEvents();
        this.loadData();
    }

    initElements() {
        this.dataTable = document.getElementById('dataTable');
        this.addBtn = document.getElementById('addBtn');
        this.dataModal = document.getElementById('dataModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.dataForm = document.getElementById('dataForm');
        this.recordId = document.getElementById('recordId');
        this.closeModal = document.getElementById('closeModal');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.refreshCache = document.getElementById('refreshCache');
    }

    bindEvents() {
        this.addBtn.addEventListener('click', () => this.showModal());
        this.closeModal.addEventListener('click', () => this.hideModal());
        this.cancelBtn.addEventListener('click', () => this.hideModal());
        this.dataForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.refreshCache.addEventListener('click', () => this.refreshData());
    }

    async loadData() {
        const cachedData = this.cache.get('users');
        if (cachedData) {
            this.renderData(cachedData);
            return;
        }

        try {
            const response = await fetch(this.apiUrl);
            const data = await response.json();
            this.cache.set('users', data);
            this.renderData(data);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please try again.');
        }
    }

    async refreshData() {
        this.refreshCache.classList.add('refreshing');
        try {
            const data = await this.cache.refresh('users', async () => {
                const response = await fetch(this.apiUrl);
                return await response.json();
            });
            this.renderData(data);
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh data. Please try again.');
        } finally {
            this.refreshCache.classList.remove('refreshing');
            feather.replace();
        }
    }

    renderData(data) {
        this.dataTable.innerHTML = '';
        
        if (!data || data.length === 0) {
            this.dataTable.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">No data available</td>
                </tr>
            `;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge status-active">Active</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button class="text-blue-500 hover:text-blue-700 mr-3 edit-btn" data-id="${item.id}">
                        <i data-feather="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-700 delete-btn" data-id="${item.id}">
                        <i data-feather="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            `;
            this.dataTable.appendChild(row);
        });

        // Rebind events for new elements
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.editRecord(e));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteRecord(e));
        });

        feather.replace();
    }

    showModal(record = null) {
        this.dataForm.reset();
        this.recordId.value = '';
        
        if (record) {
            this.modalTitle.textContent = 'Edit Record';
            this.recordId.value = record.id;
            document.getElementById('name').value = record.name;
            document.getElementById('email').value = record.email;
            document.getElementById('status').value = record.status || 'active';
        } else {
            this.modalTitle.textContent = 'Add New Record';
        }
        
        this.dataModal.classList.add('show');
        this.dataModal.classList.remove('hidden');
    }

    hideModal() {
        this.dataModal.classList.remove('show');
        this.dataModal.classList.add('hidden');
    }

    editRecord(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const cachedData = this.cache.get('users');
        if (!cachedData) return;
        
        const record = cachedData.find(item => item.id == id);
        if (record) {
            this.showModal(record);
        }
    }

    async deleteRecord(e) {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this record?')) return;
        
        try {
            // In a real app, you would call your API here
            const cachedData = this.cache.get('users');
            if (cachedData) {
                const newData = cachedData.filter(item => item.id != id);
                this.cache.set('users', newData);
                this.renderData(newData);
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            this.showError('Failed to delete record. Please try again.');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = {
            id: this.recordId.value,
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            status: document.getElementById('status').value
        };

        // Input validation
        if (!formData.name || !formData.email) {
            this.showError('Please fill in all required fields');
            return;
        }

        if (!this.validateEmail(formData.email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            let cachedData = this.cache.get('users') || [];
            
            if (formData.id) {
                // Update existing record
                const index = cachedData.findIndex(item => item.id == formData.id);
                if (index !== -1) {
                    cachedData[index] = { ...cachedData[index], ...formData };
                }
            } else {
                // Add new record
                formData.id = Math.max(...cachedData.map(item => item.id), 0) + 1;
                cachedData.unshift(formData);
            }
            
            this.cache.set('users', cachedData);
            this.renderData(cachedData);
            this.hideModal();
        } catch (error) {
            console.error('Error saving data:', error);
            this.showError('Failed to save data. Please try again.');
        }
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    showError(message) {
        alert(message); // In a real app, you'd use a more elegant error display
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CRUDApp();
});