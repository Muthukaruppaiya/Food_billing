import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';
import './AdminView.css';

export default function AdminView() {
    const { menuItems, addMenuItem, updateMenuItem, deleteMenuItem, orders, todayOrders, purchases, todayPurchases, addPurchase, deletePurchase, getDailySales, settings, updateSettings, refreshData, users, addUser, editUser, removeUser, inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useApp();
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const [adminView, setAdminView] = useState('dashboard');
    const [loadingSales, setLoadingSales] = useState(false);
    const [statusTab, setStatusTab] = useState('All');
    const [ordersDate, setOrdersDate] = useState(new Date().toISOString().split('T')[0]);

    // Inventory State
    const [newInventory, setNewInventory] = useState({ name: '', unit: 'kg', currentStock: 0 });
    const [editInventoryId, setEditInventoryId] = useState(null);

    // Report Filtering State
    const getLocalYearMonthDay = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const getLocalYearMonth = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const [reportMode, setReportMode] = useState('today'); // 'today', 'day', 'month', 'range'
    const [filterDate, setFilterDate] = useState(getLocalYearMonthDay());
    const [filterMonth, setFilterMonth] = useState(getLocalYearMonth());
    const [filterRange, setFilterRange] = useState({ start: getLocalYearMonthDay(), end: getLocalYearMonthDay() });

    const todayStr = getLocalYearMonthDay();

    // Dynamically filter orders and purchases based on report settings
    const filteredOrders = React.useMemo(() => {
        return orders.filter(o => {
            if (!o.createdAt) return false;
            const d = new Date(o.createdAt);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const monthStr = dateStr.slice(0, 7);

            if (reportMode === 'today') return dateStr === todayStr;
            if (reportMode === 'day') return dateStr === filterDate;
            if (reportMode === 'month') return monthStr === filterMonth;
            if (reportMode === 'range') return dateStr >= filterRange.start && dateStr <= filterRange.end;
            return false;
        });
    }, [orders, reportMode, filterDate, filterMonth, filterRange, todayStr]);

    const filteredPurchases = React.useMemo(() => {
        return purchases.filter(p => {
            const dateStr = p.purchaseDate;
            const monthStr = dateStr?.slice(0, 7);

            if (reportMode === 'today') return dateStr === todayStr;
            if (reportMode === 'day') return dateStr === filterDate;
            if (reportMode === 'month') return monthStr === filterMonth;
            if (reportMode === 'range') return dateStr >= filterRange.start && dateStr <= filterRange.end;
            return false;
        });
    }, [purchases, reportMode, filterDate, filterMonth, filterRange, todayStr]);

    // Settings State
    const [editSettings, setEditSettings] = useState(settings);

    // Sync local state when global settings change (e.g. after fetch)
    React.useEffect(() => {
        setEditSettings(settings);
    }, [settings]);

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            await updateSettings(editSettings);
            alert('Settings updated successfully!');
            setAdminView('menu');
        } catch (error) {
            alert('Failed to update settings.');
        }
    };

    const fetchSales = async () => {
        setLoadingSales(true);
        try {
            await getDailySales();
            setAdminView('sales');
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoadingSales(false);
        }
    };

    const [newFood, setNewFood] = useState({ name: '', price: '', type: 'STARTERS', imageUrl: '' });
    const [imageFile, setImageFile] = useState(null);
    const [editId, setEditId] = useState(null);

    const [newPurchase, setNewPurchase] = useState({ supplier: '', item: '', quantity: '', unitPrice: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' });

    // User Management State
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'WAITER', displayName: '' });
    const [editUserId, setEditUserId] = useState(null);

    const handleAddOrEditUser = async (e) => {
        e.preventDefault();
        try {
            if (editUserId) {
                await editUser(editUserId, newUser);
                alert('User updated successfully');
            } else {
                await addUser(newUser);
                alert('User added successfully');
            }
            setNewUser({ username: '', password: '', role: 'WAITER', displayName: '' });
            setEditUserId(null);
        } catch (err) {
            alert('Error saving user. Username might already exist.');
        }
    };

    const handleEditUserClick = (user) => {
        setNewUser({ username: user.username, password: '', role: user.role, displayName: user.displayName });
        setEditUserId(user.id);
    };

    const handleAddOrEditInventory = async (e) => {
        e.preventDefault();
        try {
            if (editInventoryId) {
                await updateInventoryItem(editInventoryId, newInventory);
                alert('Inventory item updated successfully');
            } else {
                await addInventoryItem(newInventory);
                alert('Inventory item added successfully');
            }
            setNewInventory({ name: '', unit: 'kg', currentStock: 0 });
            setEditInventoryId(null);
        } catch (err) {
            alert('Error saving inventory item.');
        }
    };

    const handleEditInventoryClick = (item) => {
        setNewInventory({ name: item.name, unit: item.unit, currentStock: item.currentStock });
        setEditInventoryId(item.id);
    };

    const handleAddFood = async (e) => {
        e.preventDefault();
        if (!newFood.name || !newFood.price) return;

        const foodData = {
            name: newFood.name,
            price: parseFloat(newFood.price),
            type: newFood.type,
            imageUrl: newFood.imageUrl,
            isActive: true
        };

        try {
            if (editId) {
                await updateMenuItem(editId, foodData, imageFile);
                setEditId(null);
            } else {
                await addMenuItem(foodData, imageFile);
            }
            setNewFood({ name: '', price: '', type: 'STARTERS', imageUrl: '' });
            setImageFile(null);
            setAdminView('menu');
        } catch (err) {
            // alert already shown inside addMenuItem / updateMenuItem
        }
    };

    const handleEditFood = (item) => {
        setNewFood({
            name: item.name || '',
            price: (item.price ?? '').toString(),
            type: item.type || 'STARTERS',
            imageUrl: item.imageUrl || item.image || ''
        });
        setImageFile(null);
        setEditId(item.id);
        setAdminView('add');
    };

    const handleImageUpload = (e) => {
        // For now, we'll just handle base64 or external URLs
        // If the backend expects Multipart, we'd use api.createMenuItem(formData)
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setNewFood(prev => ({ ...prev, imageUrl: reader.result }));
            reader.readAsDataURL(file);
        }
    };

    const handleAddPurchase = async (e) => {
        e.preventDefault();
        if (!newPurchase.supplier || !newPurchase.item || !newPurchase.quantity || !newPurchase.unitPrice) return;

        await addPurchase({
            supplier: newPurchase.supplier,
            item: newPurchase.item,
            quantity: parseFloat(newPurchase.quantity),
            unitPrice: parseFloat(newPurchase.unitPrice),
            total: parseFloat(newPurchase.quantity) * parseFloat(newPurchase.unitPrice),
            purchaseDate: newPurchase.purchaseDate,
            notes: newPurchase.notes
        });
        setNewPurchase({ supplier: '', item: '', quantity: '', unitPrice: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' });
    };

    return (
        <div className="app-layout">
            <Sidebar>
                <button className={`nav-btn ${adminView === 'dashboard' ? 'active' : ''}`} onClick={() => { setAdminView('dashboard'); setEditId(null); }}>Dashboard</button>
                <button className={`nav-btn ${adminView === 'menu' ? 'active' : ''}`} onClick={() => { setAdminView('menu'); setEditId(null); }}>Manage Menu</button>
                <button className={`nav-btn ${adminView === 'add' ? 'active' : ''}`} onClick={() => { setAdminView('add'); setEditId(null); setNewFood({ name: '', price: '', type: 'STARTER', imageUrl: '' }); }}>Add New Item</button>

                <div style={{ padding: '10px 20px', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', marginTop: '10px' }}>Management</div>
                <button className={`nav-btn ${adminView === 'inventory' ? 'active' : ''}`} onClick={() => { setAdminView('inventory'); setEditInventoryId(null); setNewInventory({ name: '', unit: 'kg', currentStock: 0 }); }}>📦 Inventory Master</button>
                <button className={`nav-btn ${adminView === 'purchases' ? 'active' : ''}`} onClick={() => setAdminView('purchases')}>
                    🛍️ Purchases {todayPurchases.length > 0 && <span className="nav-count">{todayPurchases.length}</span>}
                </button>
                <button className={`nav-btn ${adminView === 'orders' ? 'active' : ''}`} onClick={() => setAdminView('orders')}>Dining Orders</button>
                <button className={`nav-btn ${adminView === 'parcel_orders' ? 'active' : ''}`} onClick={() => setAdminView('parcel_orders')}>Parcel Orders</button>
                <button className={`nav-btn ${adminView === 'sales' ? 'active' : ''}`} onClick={fetchSales} disabled={loadingSales}>
                    {loadingSales ? 'Loading...' : '📊 Reports'}
                </button>
                <button className={`nav-btn ${adminView === 'users' ? 'active' : ''}`} onClick={() => { setAdminView('users'); setEditUserId(null); setNewUser({ username: '', password: '', role: 'WAITER', displayName: '' }); }}>👥 Manage Users</button>
                <button className={`nav-btn ${adminView === 'settings' ? 'active' : ''}`} onClick={() => setAdminView('settings')}>⚙️ Settings</button>
            </Sidebar>

            <main className="main-content">
                <header className="top-bar">
                    <h2>
                        {adminView === 'dashboard' ? 'Admin Dashboard' :
                            adminView === 'add' ? (editId ? 'Edit Food Item' : 'Add New Food Item') :
                                adminView === 'users' ? 'User Management' :
                                    adminView === 'inventory' ? 'Inventory Master' :
                                        adminView === 'orders' ? 'Dining Orders History' :
                                            adminView === 'parcel_orders' ? 'Parcel Orders (Billed)' :
                                                adminView === 'purchases' ? 'Purchase / Receive Entry' :
                                                    adminView === 'sales' ? "Business Report" :
                                                        adminView === 'settings' ? 'Restaurant & Receipt Settings' :
                                                            'Menu Management'}
                    </h2>
                    {(adminView === 'orders' || adminView === 'parcel_orders') && (
                        <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label>Filter Date:</label>
                            <input type="date" value={ordersDate} onChange={e => setOrdersDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                        </div>
                    )}
                </header>

                {/* Admin Dashboard */}
                {adminView === 'dashboard' && (
                    <section className="dashboard-wrap" style={{ padding: '24px' }}>
                        <div className="sales-stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon">📈</div>
                                <div className="stat-info">
                                    <h3>Total Orders Today</h3>
                                    <p className="stat-val">{todayOrders.length}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">💰</div>
                                <div className="stat-info">
                                    <h3>Today's Est. Revenue</h3>
                                    <p className="stat-val">₹{todayOrders.filter(o => o.status === 'BILLED').reduce((sum, o) => sum + toNum(o.total), 0).toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">⏳</div>
                                <div className="stat-info">
                                    <h3>Active Orders</h3>
                                    <p className="stat-val">{todayOrders.filter(o => o.status !== 'BILLED').length}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🛍️</div>
                                <div className="stat-info">
                                    <h3>Parcel Orders</h3>
                                    <p className="stat-val">{todayOrders.filter(o => o.isParcel).length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="report-card" style={{ marginTop: '24px' }}>
                            <div className="report-card-header">
                                <h3>Recent Orders Overview</h3>
                            </div>
                            <div className="admin-table-wrap compact">
                                <table className="admin-table">
                                    <thead><tr><th>Token</th><th>Type</th><th>Time</th><th>Status</th><th>Total</th></tr></thead>
                                    <tbody>
                                        {todayOrders.slice(0, 10).map((o, i) => (
                                            <tr key={i}>
                                                <td>#{o.tokenNumber}</td>
                                                <td>{o.isParcel ? 'Parcel' : `Table ${o.tableNumber}`}</td>
                                                <td>{new Date(o.createdAt).toLocaleTimeString()}</td>
                                                <td><span className={`status-pill ${(o.status || 'PLACED').toLowerCase()}`}>{o.status}</span></td>
                                                <td>₹{toNum(o.total).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {todayOrders.length === 0 && <p style={{ padding: '20px', textAlign: 'center' }}>No orders placed today.</p>}
                            </div>
                        </div>
                    </section>
                )}

                {/* Settings Form */}
                {adminView === 'settings' && (
                    <section className="form-wrap">
                        <form className="admin-form" onSubmit={handleUpdateSettings}>
                            <h3 className="form-title">🏨 Restaurant & Billing Settings</h3>
                            <div className="form-row">
                                <div className="input-group">
                                    <label>Restaurant Name</label>
                                    <input type="text" value={editSettings.restaurantName} onChange={e => setEditSettings({ ...editSettings, restaurantName: e.target.value })} required />
                                </div>
                                <div className="input-group">
                                    <label>GSTIN Number</label>
                                    <input type="text" value={editSettings.gstin} onChange={e => setEditSettings({ ...editSettings, gstin: e.target.value })} placeholder="e.g. 27ABCDE1234F1Z5" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="input-group">
                                    <label>Phone Number</label>
                                    <input type="text" value={editSettings.phone} onChange={e => setEditSettings({ ...editSettings, phone: e.target.value })} required />
                                </div>
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <input type="email" value={editSettings.email} onChange={e => setEditSettings({ ...editSettings, email: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label>Address Line</label>
                                    <input type="text" value={editSettings.address} onChange={e => setEditSettings({ ...editSettings, address: e.target.value })} required />
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label>City & Pincode</label>
                                    <input type="text" value={editSettings.city} onChange={e => setEditSettings({ ...editSettings, city: e.target.value })} required />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label>Terms & Conditions</label>
                                    <input type="text" value={editSettings.termsConditions} onChange={e => setEditSettings({ ...editSettings, termsConditions: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label>Receipt Footer Message</label>
                                    <textarea
                                        rows="3"
                                        value={editSettings.footerMessage}
                                        onChange={e => setEditSettings({ ...editSettings, footerMessage: e.target.value })}
                                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="form-row" style={{ flexDirection: 'row', gap: '30px', padding: '10px 0' }}>
                                <label className="stat-checkbox">
                                    <input type="checkbox" checked={editSettings.enableTax} onChange={e => setEditSettings({ ...editSettings, enableTax: e.target.checked })} />
                                    <span>Enable GST Calculation</span>
                                </label>
                                <label className="stat-checkbox">
                                    <input type="checkbox" checked={editSettings.enableDiscount} onChange={e => setEditSettings({ ...editSettings, enableDiscount: e.target.checked })} />
                                    <span>Enable Discount Options</span>
                                </label>
                            </div>

                            <button type="submit" className="primary-btn">Save Configuration</button>
                        </form>
                    </section>
                )}

                {/* Reports View */}
                {adminView === 'sales' && (
                    <section className="sales-report-wrap mobile-responsive-report">
                        <div className="report-filters-container" style={{ background: '#fff', padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', color: '#444' }}>Report Filtering</h3>
                            <div className="report-type-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                                <button className={`report-tab ${reportMode === 'today' ? 'active' : ''}`} onClick={() => setReportMode('today')}>Today</button>
                                <button className={`report-tab ${reportMode === 'day' ? 'active' : ''}`} onClick={() => setReportMode('day')}>Specific Day</button>
                                <button className={`report-tab ${reportMode === 'month' ? 'active' : ''}`} onClick={() => setReportMode('month')}>Monthly</button>
                                <button className={`report-tab ${reportMode === 'range' ? 'active' : ''}`} onClick={() => setReportMode('range')}>Date Range</button>
                            </div>

                            <div className="filter-inputs-row">
                                {reportMode === 'day' && (
                                    <div className="filter-input-group">
                                        <label>Select Date</label>
                                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                                    </div>
                                )}
                                {reportMode === 'month' && (
                                    <div className="filter-input-group">
                                        <label>Select Month</label>
                                        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
                                    </div>
                                )}
                                {reportMode === 'range' && (
                                    <>
                                        <div className="filter-input-group">
                                            <label>Start Date</label>
                                            <input type="date" value={filterRange.start} onChange={e => setFilterRange({ ...filterRange, start: e.target.value })} />
                                        </div>
                                        <div className="filter-input-group">
                                            <label>End Date</label>
                                            <input type="date" value={filterRange.end} onChange={e => setFilterRange({ ...filterRange, end: e.target.value })} />
                                        </div>
                                    </>
                                )}
                                <button className="refresh-report-btn" style={{ marginLeft: 'auto' }} onClick={() => { refreshData(); }}>🔄 Sync Data</button>
                            </div>
                        </div>

                        <div className="report-summary-header">
                            <h3 className="report-title">
                                {reportMode === 'today' ? "Today's Business Report" :
                                    reportMode === 'day' ? `Report for ${new Date(filterDate).toLocaleDateString('en-IN')}` :
                                        reportMode === 'month' ? `Report for ${new Date(filterMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}` :
                                            "Date Range Report"}
                            </h3>
                            <span className="report-period">
                                {reportMode === 'range' ? `${new Date(filterRange.start).toLocaleDateString('en-IN')} - ${new Date(filterRange.end).toLocaleDateString('en-IN')}` :
                                    new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </div>

                        {(() => {
                            // Calculate metrics using the dynamic filteredOrders and filteredPurchases
                            const billedItems = filteredOrders.filter(o => o.status === 'BILLED');
                            const totalRev = billedItems.reduce((sum, o) => sum + toNum(o.total), 0);
                            const totalTax = billedItems.reduce((sum, o) => sum + toNum(o.cgst) + toNum(o.sgst), 0);
                            const purchaseCost = filteredPurchases.reduce((a, p) => a + toNum(p.total), 0);

                            // Aggregate Item Sales
                            const itemStats = {};
                            billedItems.forEach(order => {
                                order.items.forEach(item => {
                                    if (!itemStats[item.itemName]) {
                                        itemStats[item.itemName] = { quantity: 0, revenue: 0 };
                                    }
                                    itemStats[item.itemName].quantity += toNum(item.quantity);
                                    itemStats[item.itemName].revenue += toNum(item.price) * toNum(item.quantity);
                                });
                            });

                            return (
                                <>
                                    <div className="sales-stats-grid">
                                        <div className="stat-card revenue">
                                            <div className="stat-icon">💰</div>
                                            <div className="stat-info">
                                                <h3>Total Revenue</h3>
                                                <p className="stat-val">₹{totalRev.toFixed(2)}</p>
                                                <span className="stat-sub">{billedItems.length} Bills Processed</span>
                                            </div>
                                        </div>
                                        <div className="stat-card tax">
                                            <div className="stat-icon">📄</div>
                                            <div className="stat-info">
                                                <h3>GST Collected</h3>
                                                <p className="stat-val">₹{totalTax.toFixed(2)}</p>
                                                <span className="stat-sub">Tax Amount</span>
                                            </div>
                                        </div>
                                        <div className="stat-card orders-today">
                                            <div className="stat-icon">🎟️</div>
                                            <div className="stat-info">
                                                <h3>Total Orders</h3>
                                                <p className="stat-val">{filteredOrders.length}</p>
                                                <span className="stat-sub">Including Pending</span>
                                            </div>
                                        </div>
                                        <div className="stat-card purchase-cost">
                                            <div className="stat-icon">🛒</div>
                                            <div className="stat-info">
                                                <h3>Purchase Cost</h3>
                                                <p className="stat-val">₹{purchaseCost.toFixed(2)}</p>
                                                <span className="stat-sub">{filteredPurchases.length} Entries In Period</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="report-sections-grid">
                                        <div className="report-card">
                                            <div className="report-card-header">
                                                <h3>🔥 Top Selling Items</h3>
                                            </div>
                                            <div className="admin-table-wrap compact">
                                                <table className="admin-table">
                                                    <thead><tr><th>Item</th><th>Qty</th><th>Sales (₹)</th></tr></thead>
                                                    <tbody>
                                                        {Object.entries(itemStats).length === 0 ? (
                                                            <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>No transactions in this period.</td></tr>
                                                        ) : (
                                                            Object.entries(itemStats)
                                                                .sort((a, b) => b[1].quantity - a[1].quantity)
                                                                .slice(0, 8)
                                                                .map(([name, stats], idx) => (
                                                                    <tr key={idx}>
                                                                        <td><strong>{name}</strong></td>
                                                                        <td>{stats.quantity}</td>
                                                                        <td className="td-price">₹{stats.revenue.toFixed(0)}</td>
                                                                    </tr>
                                                                ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="report-card">
                                            <div className="report-card-header">
                                                <h3>📊 Financial Summary (Est.)</h3>
                                            </div>
                                            <div className="profit-analysis">
                                                <div className="profit-row">
                                                    <span>Sales (Excl. Tax)</span>
                                                    <span>₹{(totalRev - totalTax).toFixed(2)}</span>
                                                </div>
                                                <div className="profit-row cost">
                                                    <span>Period Purchases</span>
                                                    <span>- ₹{purchaseCost.toFixed(2)}</span>
                                                </div>
                                                <div className="dashed-line"></div>
                                                <div className={`profit-row final ${((totalRev - totalTax) - purchaseCost) >= 0 ? 'plus' : 'minus'}`}>
                                                    <span>Net Cash Balance</span>
                                                    <strong>₹{((totalRev - totalTax) - purchaseCost).toFixed(2)}</strong>
                                                </div>
                                                <p className="hint-text">* Rough estimate based on transactions in selected period.</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </section>
                )}

                {/* Menu Table */}
                {adminView === 'menu' && (
                    <section className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Actions</th></tr></thead>
                            <tbody>
                                {menuItems.map((item, idx) => (
                                    <tr key={`${item.id || 'menu'}-${idx}`}>
                                        <td><div className="tbl-img"><img src={item.imageUrl || item.image} alt={item.name} /></div></td>
                                        <td className="td-name">{item.name}</td>
                                        <td><span className="cat-tag">{item.type}</span></td>
                                        <td className="td-price">₹{item.price}</td>
                                        <td>
                                            <button className="tbl-btn edit" onClick={() => handleEditFood(item)}>Edit</button>
                                            <button className="tbl-btn delete" onClick={() => deleteMenuItem(item.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                {/* Add/Edit Form */}
                {adminView === 'add' && (
                    <section className="form-wrap">
                        <form className="admin-form" onSubmit={handleAddFood}>
                            <div className="form-row">
                                <div className="input-group"><label>Food Name</label><input type="text" placeholder="e.g. Chicken Biryani" value={newFood.name} onChange={e => setNewFood({ ...newFood, name: e.target.value })} required /></div>
                                <div className="input-group"><label>Price (₹)</label><input type="number" step="1" placeholder="e.g. 280" value={newFood.price} onChange={e => setNewFood({ ...newFood, price: e.target.value })} required /></div>
                            </div>
                            <div className="form-row">
                                <div className="input-group"><label>Category</label>
                                    <select value={newFood.type} onChange={e => setNewFood({ ...newFood, type: e.target.value })}>
                                        <option value="STARTERS">Starters</option>
                                        <option value="MAIN_COURSE">Main Course</option>
                                        <option value="DESSERTS">Desserts</option>
                                        <option value="BEVERAGES">Beverages</option>
                                        <option value="SIDE_DISH">Side Dish</option>
                                    </select>
                                </div>
                                <div className="input-group"><label>Image URL (or upload)</label><input type="text" placeholder="https://..." value={newFood.imageUrl} onChange={e => setNewFood({ ...newFood, imageUrl: e.target.value })} /></div>
                            </div>
                            <div className="form-row">
                                <div className="input-group"><label>Or Upload Image</label><input type="file" accept="image/*" onChange={handleImageUpload} className="file-input" /></div>
                                {(newFood.imageUrl || newFood.image) && <div className="img-preview"><img src={newFood.imageUrl || newFood.image} alt="Preview" /></div>}
                            </div>
                            <button type="submit" className="primary-btn">{editId ? 'Update Item' : 'Add to Menu'}</button>
                        </form>
                    </section>
                )}

                {/* All Orders */}
                {adminView === 'orders' && (
                    <>
                        <div className="status-tabs-container" style={{ margin: '0 24px 10px', padding: '16px 0' }}>
                            {['All', 'PLACED', 'PREPARING', 'READY', 'DELIVERED', 'BILLED'].map(status => (
                                <button
                                    key={status}
                                    className={`status-tab pill-${status.toLowerCase() || 'all'} ${statusTab === status ? 'active' : ''}`}
                                    onClick={() => setStatusTab(status)}
                                >
                                    {status === 'PLACED' ? 'New' : status}
                                    <span className="count">
                                        {status === 'All' ? orders.filter(o => !o.isParcel && o.createdAt?.startsWith(ordersDate)).length : orders.filter(o => o.status === status && !o.isParcel && o.createdAt?.startsWith(ordersDate)).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <section className="token-grid">
                            {orders.filter(o => (statusTab === 'All' || o.status === statusTab) && !o.isParcel && o.createdAt?.startsWith(ordersDate)).length === 0 ? (
                                <div className="empty-full"><p>No {statusTab !== 'All' ? statusTab.toLowerCase() : ''} dining orders found for {ordersDate}.</p></div>
                            ) : (
                                orders.filter(o => (statusTab === 'All' || o.status === statusTab) && !o.isParcel && o.createdAt?.startsWith(ordersDate)).map((order, idx) => (
                                    <div className={`token-card status-${(order.status || 'PLACED').toLowerCase()}`} key={order.tokenNumber || idx}>
                                        <div className="token-header">
                                            <div><span className="token-id">Token #{order.tokenNumber}</span><span className="table-badge">Table {order.tableNumber}</span></div>
                                            <span className={`status-pill ${(order.status || 'PLACED').toLowerCase()}`}>{order.status}</span>
                                        </div>
                                        <div className="token-items">{order.items.map((item, iidx) => (
                                            <div key={item.id || iidx} className="token-item-row"><span>{item.itemName}</span><span>× {item.quantity}</span></div>
                                        ))}</div>
                                        <div className="token-footer">
                                            <span className="token-time">Waiter: {order.waiterName || 'N/A'} • {new Date(order.createdAt).toLocaleTimeString()}</span>
                                            <span className="token-total">₹{toNum(order.total).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </section>
                    </>
                )}

                {/* Parcel Orders History */}
                {adminView === 'parcel_orders' && (
                    <section className="token-grid" style={{ padding: '24px' }}>
                        {orders.filter(o => o.isParcel && o.createdAt?.startsWith(ordersDate)).length === 0 ? (
                            <div className="empty-full"><p>No parcel orders found for {ordersDate}.</p></div>
                        ) : (
                            orders.filter(o => o.isParcel && o.createdAt?.startsWith(ordersDate)).map((order, idx) => (
                                <div className="token-card status-delivered" key={order.tokenNumber || idx}>
                                    <div className="token-header">
                                        <div>
                                            <span className="token-id">Parcel Token #{order.tokenNumber}</span>
                                            <span className="table-badge">Parcel</span>
                                        </div>
                                        <span className="status-pill delivered">BILLED</span>
                                    </div>
                                    <div className="token-items">
                                        {order.items.map((item, iidx) => (
                                            <div key={iidx} className="token-item-row">
                                                <span>{item.itemName}</span>
                                                <span>× {item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="token-footer">
                                        <span className="token-time">Time: {new Date(order.createdAt).toLocaleTimeString()}</span>
                                        <span className="token-total">₹{toNum(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                )}

                {/* Purchase Module */}
                {adminView === 'purchases' && (
                    <>
                        <section className="form-wrap">
                            <form className="admin-form" onSubmit={handleAddPurchase}>
                                <h3 className="form-title">📦 New Purchase Entry</h3>
                                <div className="form-row">
                                    <div className="input-group"><label>Supplier Name</label><input type="text" placeholder="e.g. Sri Balaji Traders" value={newPurchase.supplier} onChange={e => setNewPurchase({ ...newPurchase, supplier: e.target.value })} required /></div>
                                    <div className="input-group">
                                        <label>Select Inventory Item</label>
                                        <select value={newPurchase.item} onChange={e => setNewPurchase({ ...newPurchase, item: e.target.value })} required >
                                            <option value="">Select Item...</option>
                                            {inventoryItems?.map((inv, i) => <option key={inv.id || i} value={inv.name}>{inv.name} ({inv.unit})</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="input-group"><label>Quantity</label><input type="number" step="0.01" placeholder="e.g. 10" value={newPurchase.quantity} onChange={e => setNewPurchase({ ...newPurchase, quantity: e.target.value })} required /></div>
                                    <div className="input-group"><label>Unit Price (₹)</label><input type="number" step="0.01" placeholder="e.g. 1200" value={newPurchase.unitPrice} onChange={e => setNewPurchase({ ...newPurchase, unitPrice: e.target.value })} required /></div>
                                    <div className="input-group"><label>Date</label><input type="date" value={newPurchase.purchaseDate} onChange={e => setNewPurchase({ ...newPurchase, purchaseDate: e.target.value })} required /></div>
                                </div>
                                <div className="form-row">
                                    <div className="input-group"><label>Notes (optional)</label><input type="text" placeholder="e.g. Invoice #456" value={newPurchase.notes} onChange={e => setNewPurchase({ ...newPurchase, notes: e.target.value })} /></div>
                                </div>
                                {newPurchase.quantity && newPurchase.unitPrice && (
                                    <div className="purchase-preview">Total: <strong>₹{(parseFloat(newPurchase.quantity || 0) * parseFloat(newPurchase.unitPrice || 0)).toFixed(2)}</strong></div>
                                )}
                                <button type="submit" className="primary-btn">Add Purchase Entry</button>
                            </form>
                        </section>

                        {purchases.length > 0 && (
                            <section className="admin-table-wrap">
                                <div className="purchase-bar">
                                    <h3>Today's Purchase History</h3>
                                    <span className="grand-total-tag">Today's Total Cost: ₹{todayPurchases.reduce((a, p) => a + toNum(p.total), 0).toFixed(2)}</span>
                                </div>
                                <table className="admin-table">
                                    <thead><tr><th>Time</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th><th></th></tr></thead>
                                    <tbody>
                                        {todayPurchases.map((p, idx) => (
                                            <tr key={p.id || idx}>
                                                <td>{new Date(`1970-01-01T${p.time || '12:00:00'}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td>{p.supplier}</td><td><strong>{p.item}</strong></td>
                                                <td>{p.quantity}</td><td>₹{toNum(p.unitPrice).toFixed(0)}</td><td className="td-price">₹{toNum(p.total).toFixed(0)}</td>
                                                <td><button className="tbl-btn delete" onClick={() => deletePurchase(p.id)}>×</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        )}
                    </>
                )}

                {/* Inventory Master Module */}
                {adminView === 'inventory' && (
                    <>
                        <section className="form-wrap">
                            <form className="admin-form" onSubmit={handleAddOrEditInventory}>
                                <h3 className="form-title">{editInventoryId ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h3>
                                <div className="form-row">
                                    <div className="input-group">
                                        <label>Item Name</label>
                                        <input type="text" placeholder="e.g. Basmati Rice" value={newInventory.name} onChange={e => setNewInventory({ ...newInventory, name: e.target.value })} required />
                                    </div>
                                    <div className="input-group">
                                        <label>Unit of Measurement</label>
                                        <select value={newInventory.unit} onChange={e => setNewInventory({ ...newInventory, unit: e.target.value })} required>
                                            <option value="kg">Kilograms (kg)</option>
                                            <option value="g">Grams (g)</option>
                                            <option value="L">Liters (L)</option>
                                            <option value="ml">Milliliters (ml)</option>
                                            <option value="pcs">Pieces (pcs)</option>
                                            <option value="pkts">Packets (pkts)</option>
                                            <option value="boxes">Boxes</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Current Stock (Initial)</label>
                                        <input type="number" step="0.01" min="0" value={newInventory.currentStock} onChange={e => setNewInventory({ ...newInventory, currentStock: parseFloat(e.target.value) || 0 })} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <button type="submit" className="primary-btn" style={{ marginRight: '10px' }}>{editInventoryId ? 'Update Item' : 'Add Item'}</button>
                                    {editInventoryId && <button type="button" className="secondary-btn" onClick={() => { setEditInventoryId(null); setNewInventory({ name: '', unit: 'kg', currentStock: 0 }); }}>Cancel</button>}
                                </div>
                            </form>
                        </section>

                        <section className="admin-table-wrap" style={{ marginTop: '20px' }}>
                            <table className="admin-table">
                                <thead><tr><th>Item Name</th><th>Unit</th><th>Current Stock</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {inventoryItems?.map((inv, idx) => (
                                        <tr key={inv.id || idx}>
                                            <td><strong>{inv.name}</strong></td>
                                            <td>{inv.unit}</td>
                                            <td><span className={`status-pill ${toNum(inv.currentStock) <= 5 ? 'red' : 'green'}`}>{toNum(inv.currentStock).toFixed(2)}</span></td>
                                            <td>
                                                <button className="tbl-btn edit" onClick={() => handleEditInventoryClick(inv)}>Edit</button>
                                                <button className="tbl-btn delete" onClick={() => { if (window.confirm('Delete this inventory item?')) deleteInventoryItem(inv.id); }}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!inventoryItems || inventoryItems.length === 0) && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No inventory items found. Please define items first.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </section>
                    </>
                )}

                {/* User Management Module */}
                {adminView === 'users' && (
                    <>
                        <section className="form-wrap">
                            <form className="admin-form" onSubmit={handleAddOrEditUser}>
                                <h3 className="form-title">{editUserId ? 'Edit User' : 'Add New User'}</h3>
                                <div className="form-row">
                                    <div className="input-group">
                                        <label>Full Name</label>
                                        <input type="text" placeholder="e.g. John Waiter" value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} required />
                                    </div>
                                    <div className="input-group">
                                        <label>Role</label>
                                        <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} required>
                                            <option value="ADMIN">Admin</option>
                                            <option value="BILLING">Billing Cashier</option>
                                            <option value="CHEF">Chef</option>
                                            <option value="WAITER">Waiter</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="input-group">
                                        <label>Username</label>
                                        <input type="text" placeholder="e.g. john123" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required disabled={!!editUserId} />
                                    </div>
                                    <div className="input-group">
                                        <label>{editUserId ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                                        <input type="text" placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required={!editUserId} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <button type="submit" className="primary-btn" style={{ marginRight: '10px' }}>{editUserId ? 'Update User' : 'Create User'}</button>
                                    {editUserId && <button type="button" className="secondary-btn" onClick={() => { setEditUserId(null); setNewUser({ username: '', password: '', role: 'WAITER', displayName: '' }); }}>Cancel</button>}
                                </div>
                            </form>
                        </section>

                        <section className="admin-table-wrap" style={{ marginTop: '20px' }}>
                            <table className="admin-table">
                                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {users.map((u, idx) => (
                                        <tr key={u.id || idx}>
                                            <td><strong>{u.displayName || u.username}</strong></td>
                                            <td>{u.username}</td>
                                            <td><span className={`status-pill ${u.role === 'ADMIN' ? 'red' : u.role === 'CHEF' ? 'orange' : 'blue'}`}>{u.role}</span></td>
                                            <td>
                                                <button className="tbl-btn edit" onClick={() => handleEditUserClick(u)}>Edit</button>
                                                {u.role !== 'ADMIN' && <button className="tbl-btn delete" onClick={() => { if (window.confirm('Delete this user?')) removeUser(u.id); }}>Delete</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
