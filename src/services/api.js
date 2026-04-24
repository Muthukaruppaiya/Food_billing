const BASE_URL = 'http://localhost:8080/api';
const IMAGE_BASE_URL = 'http://localhost:8080/uploads';

const getHeaders = () => {
    const username = localStorage.getItem('X-Username');
    const role = localStorage.getItem('X-Role');
    const headers = {
        'Content-Type': 'application/json',
    };
    if (username) headers['X-Username'] = username;
    if (role) headers['X-Role'] = role.toUpperCase();
    return headers;
};

const api = {
    // Menu API
    getMenu: () => fetch(`${BASE_URL}/menu`, { headers: getHeaders() }).then(res => res.json()),
    getMenuItem: (id) => fetch(`${BASE_URL}/menu/${id}`, { headers: getHeaders() }).then(res => res.json()),

    // Users API
    getUsers: () => fetch(`${BASE_URL}/users`, { headers: getHeaders() }).then(res => res.json()),
    createUser: (data) => fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),
    updateUser: (id, data) => fetch(`${BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),
    deleteUser: (id) => fetch(`${BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    }),
    loginUser: (data) => fetch(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => {
        if (!res.ok) throw new Error('Invalid username or password');
        return res.json();
    }),

    createMenuItem: (data, imageFile) => {
        const checkOk = (res) => {
            if (!res.ok) return res.json().then(e => { throw new Error(e.message || 'Failed to save menu item'); });
            return res.json();
        };
        if (!imageFile) {
            return fetch(`${BASE_URL}/menu/json`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            }).then(checkOk);
        }

        // Strip imageUrl (possibly a large base64 preview) — actual file sent as multipart.
        const { imageUrl: _omit, ...dataWithoutImage } = data;
        const formData = new FormData();
        formData.append('menuItem', JSON.stringify(dataWithoutImage));
        formData.append('image', imageFile);
        return fetch(`${BASE_URL}/menu`, {
            method: 'POST',
            headers: {
                'X-Username': localStorage.getItem('X-Username'),
                'X-Role': (localStorage.getItem('X-Role') || '').toUpperCase()
            },
            body: formData
        }).then(checkOk);
    },

    updateMenuItem: (id, data, imageFile) => {
        const checkOk = (res) => {
            if (!res.ok) return res.json().then(e => { throw new Error(e.message || 'Failed to update menu item'); });
            return res.json();
        };

        const { imageUrl: _omit, ...dataWithoutImage } = data;
        const formData = new FormData();
        formData.append('menuItem', JSON.stringify(dataWithoutImage));
        if (imageFile) formData.append('image', imageFile);

        return fetch(`${BASE_URL}/menu/${id}`, {
            method: 'PUT',
            headers: {
                'X-Username': localStorage.getItem('X-Username'),
                'X-Role': (localStorage.getItem('X-Role') || '').toUpperCase()
            },
            body: formData
        }).then(checkOk);
    },
    deleteMenuItem: (id) => fetch(`${BASE_URL}/menu/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    }),

    // Order API
    getOrders: (status) => {
        const url = status ? `${BASE_URL}/orders?status=${status}` : `${BASE_URL}/orders`;
        return fetch(url, { headers: getHeaders() }).then(res => res.json());
    },
    getOrderByToken: (tokenNumber) => fetch(`${BASE_URL}/orders/${tokenNumber}`, { headers: getHeaders() }).then(res => res.json()),
    createOrder: (orderData) => fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(orderData)
    }).then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.message || 'Error occurred'); });
        return res.json();
    }),
    updateOrder: (tokenNumber, orderData) => fetch(`${BASE_URL}/orders/${tokenNumber}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(orderData)
    }).then(res => res.json()),
    updateOrderStatus: (tokenNumber, status) => fetch(`${BASE_URL}/orders/${tokenNumber}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
    }).then(res => res.json()),
    updateItemStatus: (tokenNumber, itemId, status) => fetch(`${BASE_URL}/orders/${tokenNumber}/items/${itemId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
    }).then(res => res.json()),
    // Billing API (Updated for Table-based Billing)
    getPendingTokensByTable: (tableNumber) => fetch(`${BASE_URL}/billing/table/${tableNumber}/pending-tokens`, { headers: getHeaders() }).then(res => res.json()),

    previewCombinedBill: (data) => fetch(`${BASE_URL}/billing/generate-bill`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),

    closeTokens: (data) => fetch(`${BASE_URL}/billing/close-tokens`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),

    getBillByNumber: (billNumber) => fetch(`${BASE_URL}/billing/bill/${billNumber}`, { headers: getHeaders() }).then(res => res.json()),

    getBillsByDate: (startDate, endDate) => fetch(`${BASE_URL}/billing/bills?startDate=${startDate}&endDate=${endDate}`, { headers: getHeaders() }).then(res => res.json()),

    splitBill: (splitData) => fetch(`${BASE_URL}/billing/split-bill`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(splitData)
    }).then(res => res.json()),

    getDailySales: () => fetch(`${BASE_URL}/billing/daily-sales`, { headers: getHeaders() }).then(res => res.json()),

    // Settings API
    getSettings: () => fetch(`${BASE_URL}/settings`, { headers: getHeaders() }).then(res => res.json()),
    updateSettings: (data) => fetch(`${BASE_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),

    // Notification API
    getNotifications: () => fetch(`${BASE_URL}/notifications`, { headers: getHeaders() }).then(res => res.json()),
    getUnreadNotifications: () => fetch(`${BASE_URL}/notifications/unread`, { headers: getHeaders() }).then(res => res.json()),
    markNotificationRead: (id) => fetch(`${BASE_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getHeaders()
    }).then(res => res.json()),

    // Purchase API
    getPurchases: () => fetch(`${BASE_URL}/purchases`, { headers: getHeaders() }).then(res => res.json()),
    getPurchase: (id) => fetch(`${BASE_URL}/purchases/${id}`, { headers: getHeaders() }).then(res => res.json()),
    createPurchase: (purchaseData) => fetch(`${BASE_URL}/purchases`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(purchaseData)
    }).then(res => res.json()),
    deletePurchase: (id) => fetch(`${BASE_URL}/purchases/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    }),

    // Inventory API
    getInventoryItems: () => fetch(`${BASE_URL}/inventory`, { headers: getHeaders() }).then(res => res.json()),
    getActiveInventoryItems: () => fetch(`${BASE_URL}/inventory/active`, { headers: getHeaders() }).then(res => res.json()),
    getLowStockInventoryItems: () => fetch(`${BASE_URL}/inventory/low-stock`, { headers: getHeaders() }).then(res => res.json()),
    getInventoryItemsByCategory: (category) => fetch(`${BASE_URL}/inventory/category/${category}`, { headers: getHeaders() }).then(res => res.json()),
    getInventoryItem: (id) => fetch(`${BASE_URL}/inventory/${id}`, { headers: getHeaders() }).then(res => res.json()),
    createInventoryItem: (data) => fetch(`${BASE_URL}/inventory`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),
    updateInventoryItem: (id, data) => fetch(`${BASE_URL}/inventory/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),
    addInventoryStock: (id, quantity) => fetch(`${BASE_URL}/inventory/${id}/add-stock?quantity=${quantity}`, {
        method: 'PATCH',
        headers: getHeaders()
    }).then(res => res.json()),
    removeInventoryStock: (id, quantity) => fetch(`${BASE_URL}/inventory/${id}/remove-stock?quantity=${quantity}`, {
        method: 'PATCH',
        headers: getHeaders()
    }).then(res => res.json()),
    deleteInventoryItem: (id) => fetch(`${BASE_URL}/inventory/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    }),

    // Cash Sessions API
    openCashSession: (data) => fetch(`${BASE_URL}/cash-sessions/open`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),
    closeCashSession: (data) => fetch(`${BASE_URL}/cash-sessions/close`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),
    getCurrentCashSession: () => fetch(`${BASE_URL}/cash-sessions/current`, { headers: getHeaders() }).then(res => res.json()),

    // Reports API - New Advanced Reports
    getDailyReport: (date) => fetch(`${BASE_URL}/reports/daily?date=${date}`, { headers: getHeaders() }).then(res => res.json()),
    getMonthlyReport: (year, month) => fetch(`${BASE_URL}/reports/monthly?year=${year}&month=${month}`, { headers: getHeaders() }).then(res => res.json()),
    getYearlyReport: (year) => fetch(`${BASE_URL}/reports/yearly?year=${year}`, { headers: getHeaders() }).then(res => res.json()),
    getCustomDateRangeReport: (startDate, endDate) => fetch(`${BASE_URL}/reports/range`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ startDate, endDate })
    }).then(res => res.json()),

    createParcelOrder: (data) => fetch(`${BASE_URL}/orders/parcel`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    }).then(res => res.json()),

    getParcelOrders: (filters = {}) => {
        const query = new URLSearchParams(filters).toString();
        return fetch(`${BASE_URL}/orders/parcel/all?${query}`, { headers: getHeaders() }).then(res => res.json());
    },

    getParcelSummary: (date) => fetch(`${BASE_URL}/orders/parcel/summary?date=${date || ''}`, { headers: getHeaders() }).then(res => res.json()),

    cancelParcelOrder: (token, reason, refundMethod) => fetch(`${BASE_URL}/orders/parcel/cancel/${token}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason, refundMethod })
    }).then(res => res.json()),

    updateParcelStatus: (token, status) => fetch(`${BASE_URL}/orders/parcel/${token}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
    }).then(res => res.json()),
    IMAGE_BASE_URL
};

export default api;
