import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import api from '../services/api';
import websocket from '../services/websocket';

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizeOrder = (order) => {
    if (!order) return null;

    // Determine status string safely
    let statusStr = 'PLACED';
    if (typeof order.status === 'string') {
        statusStr = order.status;
    } else if (order.status && typeof order.status.name === 'string') {
        statusStr = order.status.name;
    } else if (order.status && order.status.toString() !== '[object Object]') {
        statusStr = order.status.toString();
    }

    const isParcel = order.orderType === 'PARCEL' || order.type === 'PARCEL' || !order.tableNumber || order.tableNumber === '0' || order.tableNumber === 0;
    const rawToken = order.tokenNumber || order.id;
    const formattedToken = String(rawToken).padStart(4, '0');

    return {
        ...order,
        tokenNumber: formattedToken,
        items: Array.isArray(order.items) ? order.items.map(item => ({
            ...item,
            id: item.id || item.menuItemId, // Fallback to menuItemId if id is missing
            price: toNumber(item.price, 0),
            quantity: toNumber(item.quantity, 0),
            status: (item.itemStatus || item.status || 'PENDING').toUpperCase()
        })) : [],
        isParcel,
        status: statusStr.toUpperCase(),
        total: toNumber(order.total, 0),
        subtotal: toNumber(order.subtotal, 0),
        cgst: toNumber(order.cgst, 0),
        sgst: toNumber(order.sgst, 0),
        createdAt: order.createdAt ?
            (order.createdAt.includes('T') ? order.createdAt : new Date(order.createdAt).toISOString()) :
            new Date().toISOString()
    };
};

const normalizeMenuItem = (item) => {
    if (!item) return null;
    let img = item.imageUrl || item.image || '';

    // If it's just a filename and not a full URL or base64
    if (img && !img.startsWith('http') && !img.startsWith('data:')) {
        // Repeatedly and robustly remove any combination of leading slashes and "uploads/"
        let cleanPath = img.trim();
        while (cleanPath.startsWith('/') || cleanPath.toLowerCase().startsWith('uploads/')) {
            cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath.substring(8);
        }
        img = `http://localhost:8080/uploads/${cleanPath}`;
    }

    return {
        id: item.id,
        name: item.name || 'Untitled',
        price: toNumber(item.price, 0),
        type: item.type || 'STARTERS',
        imageUrl: img
    };
};

const normalizeSettings = (data) => {
    if (!data) return null;

    // If backend returns an array, take the first element (common with some generic API responses)
    const s = Array.isArray(data) ? data[0] : data;
    if (!s) return null;

    return {
        restaurantName: s.restaurantName || s.restaurant_name || 'Hotel Gourmet',
        address: s.address || '123, Food Street, Gourmet City',
        city: s.city || 'Tamil Nadu, India, 641001',
        phone: s.phone || '+91 98765-43210',
        email: s.email || 'contact@hotelgourmet.com',
        gstin: s.gstin || '',
        footerMessage: s.footerMessage || s.footer_message || 'Thank you for dining with us!\nVisit again!',
        termsConditions: s.termsConditions || s.terms_conditions || 'Food once served cannot be exchanged.',
        enableDiscount: s.enableDiscount !== undefined ? s.enableDiscount : (s.enable_discount !== undefined ? s.enable_discount : true),
        enableTax: s.enableTax !== undefined ? s.enableTax : (s.enable_tax !== undefined ? s.enable_tax : true)
    };
};

const AppContext = createContext();

export function AppProvider({ children }) {
    const [role, setRole] = useState(() => {
        const r = localStorage.getItem('X-Role');
        return r ? r.toUpperCase() : null;
    });
    const [username, setUsername] = useState(localStorage.getItem('X-Username'));

    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [userId, setUserId] = useState(() => {
        const id = localStorage.getItem('X-UserId');
        return id ? parseInt(id) : null;
    });
    const [settings, setSettings] = useState({
        restaurantName: 'Hotel Gourmet',
        address: '123, Food Street, Gourmet City',
        city: 'Tamil Nadu, India, 641001',
        phone: '+91 98765-43210',
        email: 'contact@hotelgourmet.com',
        gstin: '',
        footerMessage: 'Thank you for dining with us!\nVisit again!',
        termsConditions: 'Food once served cannot be exchanged.',
        enableDiscount: true,
        enableTax: true
    });

    // Global settings fetch for Login page
    useEffect(() => {
        const fetchGlobalSettings = async () => {
            try {
                const s = await api.getSettings();
                if (s) setSettings(normalizeSettings(s));
            } catch (se) { console.log('Global settings not found'); }
        };
        fetchGlobalSettings();
    }, []);

    // Fetch initial data
    const fetchData = useCallback(async () => {
        if (!role || !username) return;
        try {
            const menu = await api.getMenu();
            setMenuItems(Array.isArray(menu) ? menu.map(normalizeMenuItem) : []);

            // Fetch user ID — auto-create if not found in DB
            try {
                const fetchedUsers = await api.getUsers();
                if (Array.isArray(fetchedUsers)) {
                    setUsers(fetchedUsers);
                    let me = fetchedUsers.find(u => u.username === username);
                    if (!me) {
                        // User doesn't exist in DB yet — create them automatically
                        me = await api.createUser({ username, role: role ? role.toUpperCase() : 'BILLING' });
                    }
                    if (me && me.id) {
                        setUserId(me.id);
                        localStorage.setItem('X-UserId', me.id);
                    }
                }
            } catch (ue) { console.log('Could not fetch/create user ID:', ue); }

            if (role === 'ADMIN' || role === 'BILLING') {
                try {
                    const s = await api.getSettings();
                    if (s) setSettings(normalizeSettings(s));
                } catch (se) { console.log('Settings not found, using defaults'); }

                if (role === 'ADMIN') {
                    const p = await api.getPurchases();
                    setPurchases(Array.isArray(p) ? p : []);
                    try {
                        const inv = await api.getInventoryItems();
                        setInventoryItems(Array.isArray(inv) ? inv : []);
                    } catch (invErr) { console.log('Inventory API might not exist yet'); }
                }
            }

            const o = await api.getOrders();
            setOrders(Array.isArray(o) ? o.map(normalizeOrder) : []);

            const n = await api.getNotifications();
            setNotifications(Array.isArray(n) ? n.map(notif => ({
                ...notif,
                message: notif.message || '',
                isRead: !!notif.isRead,
                time: notif.time || new Date(notif.createdAt).toLocaleTimeString() || ''
            })) : []);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }, [role, username]);

    const playNotificationSound = () => {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, context.currentTime); // A5 note
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);

            gainNode.gain.setValueAtTime(0, context.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + 0.5);
        } catch (e) {
            console.log('Audio error:', e);
        }
    };

    useEffect(() => {
        fetchData();

        // Connect WebSocket
        if (role && username) {
            websocket.connect((data) => {
                // Handle real-time updates
                if (data.type === 'ORDER_UPDATE' || data.type === 'NEW_ORDER') {
                    // If an order became READY, play sound for Waiter
                    if (role === 'WAITER' && (data.status === 'READY')) {
                        playNotificationSound();
                    }
                    fetchData();
                } else if (data.message) {
                    // General notification
                    if (role === 'WAITER' && data.message.toLowerCase().includes('ready')) {
                        playNotificationSound();
                    }
                    setNotifications(prev => [{
                        ...data,
                        id: data.id || Date.now(),
                        time: new Date().toLocaleTimeString(),
                        isRead: false
                    }, ...prev]);
                }
            });
        }

        return () => websocket.disconnect();
    }, [role, username, fetchData]);

    /* ── Logout ── */
    const handleLogout = () => {
        localStorage.removeItem('X-Role');
        localStorage.removeItem('X-Username');
        setRole(null);
        setUsername('');
        setOrders([]);
        setNotifications([]);
    };

    /* ── Order placement ── */
    const placeOrder = async (cart, tableNumber, waiterName) => {
        if (cart.length === 0 || !tableNumber.trim()) return null;

        // Parse to numeric to avoid backend NumberFormatException
        let parsedTable = parseInt(tableNumber.trim().replace(/\D/g, ''), 10);
        if (isNaN(parsedTable)) parsedTable = 0; // fallback to 0 aka Parcel

        const orderData = {
            tableNumber: parsedTable.toString(),
            items: cart.map(item => ({
                menuItemId: item.id,
                quantity: item.qty
            }))
        };

        try {
            const newOrder = await api.createOrder(orderData);
            const normalized = normalizeOrder(newOrder);
            setOrders(prev => [normalized, ...prev]);
            return normalized.tokenNumber;
        } catch (error) {
            console.error('Error placing order:', error);
            return null;
        }
    };

    /* ── Edit existing order ── */
    const saveEditOrder = async (editingToken, cart, tableNumber) => {
        if (cart.length === 0) return;

        let parsedTable = parseInt(tableNumber.trim().replace(/\D/g, ''), 10);
        if (isNaN(parsedTable)) parsedTable = 0;

        const orderData = {
            tableNumber: parsedTable.toString(),
            items: cart.map(item => ({
                menuItemId: item.id,
                quantity: item.qty
            }))
        };

        try {
            const rawToken = parseInt(editingToken, 10);

            await api.updateOrder(rawToken, orderData);
            // After updating items, force status back to PLACED so Chef sees it
            const statusReset = await api.updateOrderStatus(rawToken, 'PLACED');

            setOrders(prev => prev.map(o => {
                if (o.tokenNumber === editingToken) {
                    const normalized = normalizeOrder(statusReset);
                    // Merge: if normalized has items, use them; otherwise keep old items
                    return {
                        ...o,
                        ...normalized,
                        items: (normalized.items && normalized.items.length > 0) ? normalized.items : o.items
                    };
                }
                return o;
            }));
        } catch (error) {
            console.error('Error updating order:', error);
        }
    };

    /* ── Status update ── */
    const updateOrderStatus = useCallback(async (token, newStatus) => {
        try {
            const rawToken = parseInt(token, 10);
            const updatedOrderResponse = await api.updateOrderStatus(rawToken, newStatus);

            setOrders(prev => prev.map(o => {
                if (o.tokenNumber === token) {
                    const normalized = normalizeOrder(updatedOrderResponse);
                    return {
                        ...o,
                        ...normalized,
                        status: newStatus.toUpperCase(),
                        items: (normalized.items && normalized.items.length > 0) ? normalized.items : o.items
                    };
                }
                return o;
            }));
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    }, []);

    const updateItemStatus = useCallback(async (token, itemId, newStatus) => {
        try {
            const rawToken = parseInt(token, 10);

            const updatedOrderResponse = await api.updateItemStatus(rawToken, itemId, newStatus);
            setOrders(prev => prev.map(o => {
                if (o.tokenNumber === token) {
                    const normalized = normalizeOrder(updatedOrderResponse);
                    // If we got a full order back, use it
                    if (normalized.items && normalized.items.length > 0) {
                        return normalized;
                    }
                    // Otherwise partial update
                    return {
                        ...o,
                        items: o.items.map(item => item.id === itemId ? { ...item, status: newStatus } : item)
                    };
                }
                return o;
            }));
        } catch (error) {
            console.error('Error updating item status:', error);
        }
    }, []);

    const markNotifRead = async (id) => {
        try {
            await api.markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    /* ── Menu CRUD ── */
    const addMenuItem = async (item, imageFile) => {
        try {
            const newItem = await api.createMenuItem(item, imageFile);
            if (!newItem || !newItem.id) throw new Error('Invalid response from server');
            setMenuItems(prev => [...prev, normalizeMenuItem(newItem)]);
            return newItem;
        } catch (error) {
            console.error('Error adding menu item:', error);
            alert('Failed to add menu item: ' + (error.message || 'Unknown error'));
            throw error;
        }
    };

    const updateMenuItem = async (id, updates, imageFile) => {
        try {
            const updatedItem = await api.updateMenuItem(id, updates, imageFile);
            if (!updatedItem || !updatedItem.id) throw new Error('Invalid response from server');
            const normalized = normalizeMenuItem(updatedItem);
            setMenuItems(prev => prev.map(i => i.id === id ? normalized : i));
            return updatedItem;
        } catch (error) {
            console.error('Error updating menu item:', error);
            alert('Failed to update menu item: ' + (error.message || 'Unknown error'));
            throw error;
        }
    };

    const deleteMenuItem = async (id) => {
        try {
            await api.deleteMenuItem(id);
            setMenuItems(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            console.error('Error deleting menu item:', error);
        }
    };

    /* ── Purchase CRUD ── */
    const addPurchase = async (entry) => {
        try {
            const newPurchase = await api.createPurchase(entry);
            setPurchases(prev => [newPurchase, ...prev]);
        } catch (error) {
            console.error('Error adding purchase:', error);
        }
    };

    const deletePurchase = async (id) => {
        try {
            await api.deletePurchase(id);
            setPurchases(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error('Error deleting purchase:', error);
        }
    };

    /* ── User Management ── */
    const addUser = async (userData) => {
        try {
            const newUser = await api.createUser(userData);
            setUsers(prev => [...prev, newUser]);
            return newUser;
        } catch (error) {
            console.error('Error adding user:', error);
            throw error;
        }
    };

    const editUser = async (id, userData) => {
        try {
            const updatedUser = await api.updateUser(id, userData);
            setUsers(prev => prev.map(u => u.id === id ? updatedUser : u));
            return updatedUser;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    };

    const removeUser = async (id) => {
        try {
            await api.deleteUser(id);
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    };

    /* ── Inventory Management ── */
    const addInventoryItem = async (itemData) => {
        try {
            const newItem = await api.createInventoryItem(itemData);
            setInventoryItems(prev => [...prev, newItem]);
            return newItem;
        } catch (error) {
            console.error('Error adding inventory item:', error);
            throw error;
        }
    };

    const updateInventoryItem = async (id, itemData) => {
        try {
            const updatedItem = await api.updateInventoryItem(id, itemData);
            setInventoryItems(prev => prev.map(i => i.id === id ? updatedItem : i));
            return updatedItem;
        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    };

    const deleteInventoryItem = async (id) => {
        try {
            await api.deleteInventoryItem(id);
            setInventoryItems(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    };

    /* ── Billing API (Updated) ── */
    const getPendingTokensByTable = useCallback(async (tableNo) => api.getPendingTokensByTable(tableNo), []);
    const previewCombinedBill = useCallback(async (data) => api.previewCombinedBill(data), []);
    const getBillByNumber = useCallback(async (billNo) => api.getBillByNumber(billNo), []);
    const getBillsByDate = useCallback(async (start, end) => api.getBillsByDate(start, end), []);

    const closeTokens = async (billingData) => {
        try {
            const result = await api.closeTokens(billingData);
            await fetchData();
            return result;
        } catch (error) {
            console.error('Error closing tokens:', error);
            throw error;
        }
    };

    const splitBill = async (splitData) => api.splitBill(splitData);
    const getDailySales = async () => api.getDailySales();

    const placeParcelOrder = async (cart, paymentMethod, waiterName) => {
        try {
            const data = {
                items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty })),
                paymentMethod,
                waiterId: userId || null, // Send null if userId is not yet loaded
                customerName: null,
                notes: null
            };
            console.log('DEBUG: Sending Parcel Order Data:', data);
            const result = await api.createParcelOrder(data);
            await fetchData();
            return result;
        } catch (error) {
            console.error('Error placing parcel order:', error);
            throw error;
        }
    };

    const updateSettings = async (newSettings) => {
        try {
            const result = await api.updateSettings(newSettings);
            setSettings(normalizeSettings(result));
            return result;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    };


    const getTodayLocal = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayLocal();

    const todayOrders = React.useMemo(() => orders.filter(o => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return dateStr === todayStr;
    }), [orders, todayStr]);

    const getNextToken = useCallback(() => {
        const currentTodayStr = new Date().toISOString().split('T')[0];
        let currentTodayOrders = orders.filter(o => {
            const orderDateStr = (o.createdAt || new Date().toISOString()).split('T')[0];
            return orderDateStr === currentTodayStr;
        });

        if (currentTodayOrders.length === 0) {
            return "0001";
        }

        const maxToken = Math.max(...currentTodayOrders.map(o => parseInt(o.tokenNumber, 10) || 0));
        return String(maxToken + 1).padStart(4, '0');
    }, [orders]);

    const todayPurchases = React.useMemo(() => purchases.filter(p => p.purchaseDate === todayStr), [purchases, todayStr]);

    const value = {
        role, setRole, username, setUsername, handleLogout,
        menuItems, addMenuItem, updateMenuItem, deleteMenuItem,
        orders, todayOrders, placeOrder, saveEditOrder, updateOrderStatus, updateItemStatus,
        notifications, markNotifRead,
        purchases, todayPurchases, addPurchase, deletePurchase,
        users, addUser, editUser, removeUser,
        inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem,
        getPendingTokensByTable, previewCombinedBill, getBillByNumber, getBillsByDate, closeTokens, splitBill, getDailySales,
        settings, updateSettings,
        getNextToken,
        refreshData: fetchData,
        placeParcelOrder,
        userId
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    return useContext(AppContext);
}
