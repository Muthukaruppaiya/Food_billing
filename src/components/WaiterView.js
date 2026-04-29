import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';
import './WaiterView.css';

export default function WaiterView() {
    const { menuItems, todayOrders, notifications, markNotifRead, placeOrder, updateOrderStatus, username, getNextToken, handleLogout } = useApp();
    const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

    const [waiterView, setWaiterView] = useState('take');
    const [tableNumber, setTableNumber] = useState('');
    const [cart, setCart] = useState([]);
    const [activeTab, setActiveTab] = useState('All');
    const [statusTab, setStatusTab] = useState('All');
    const [showNotifPanel, setShowNotifPanel] = useState(false);

    const allTabs = [
        { label: 'All', value: 'All' },
        { label: 'Starters', value: 'STARTERS' },
        { label: 'Main Course', value: 'MAIN_COURSE' },
        { label: 'Desserts', value: 'DESSERTS' },
        { label: 'Beverages', value: 'BEVERAGES' },
        { label: 'Side Dish', value: 'SIDE_DISH' }
    ];
    const filteredItems = activeTab === 'All' ? menuItems : menuItems.filter(r => r.type === activeTab);
    const openTokens = todayOrders.filter(o => o.status !== 'BILLED');
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { ...item, qty: 1 }];
        });
    };
    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
    const updateQty = (id, delta) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
    const cartSubtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);

    const handlePlaceOrder = async () => {
        const token = await placeOrder(cart, tableNumber, username);
        if (token) {
            setCart([]);
            setTableNumber('');
            setWaiterView('tokens');
        } else {
            alert('Failed to place order. Please check your connection or input.');
        }
    };

    return (
        <div className="app-layout waiter-layout">
            <Sidebar>
                <button className={`nav-btn ${waiterView === 'take' ? 'active' : ''}`} onClick={() => setWaiterView('take')}>
                    Take New Order
                </button>
                <button className={`nav-btn ${waiterView === 'tokens' ? 'active' : ''}`} onClick={() => setWaiterView('tokens')}>
                    Active Tokens {openTokens.length > 0 && <span className="nav-count">{openTokens.length}</span>}
                </button>
            </Sidebar>

            <main className={`main-content ${waiterView === 'take' ? 'waiter-main-has-cart' : ''}`}>
                <header className="top-bar">
                    <h2>{waiterView === 'take' ? 'Take Order' : 'Active Tokens'}</h2>
                    <div className="top-bar-right waiter-top-actions">
                        <button type="button" className="waiter-mobile-logout" onClick={handleLogout}>
                            Log out
                        </button>
                        <button type="button" className="notif-bell" onClick={() => setShowNotifPanel(!showNotifPanel)} aria-label="Notifications">
                            🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                        </button>
                    </div>
                </header>

                {showNotifPanel && (
                    <div className="notif-panel">
                        <h3>Notifications</h3>
                        {notifications.length === 0 ? <p className="empty-hint">No notifications yet</p> : (
                            notifications.map(n => (
                                <div key={n.id} className={`notif-item ${n.isRead ? 'read' : 'unread'}`} onClick={() => markNotifRead(n.id)}>
                                    <p>{n.message}</p><span className="notif-time">{n.time}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Chef module bypassed — no READY alert needed */}

                {waiterView === 'take' && (
                    <>
                        <div className="table-bar">
                            <label>Table No:</label>
                            <input type="text" placeholder="e.g. 5" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="table-input" />
                            <span className="token-tag">New Token: #{getNextToken()}</span>
                        </div>
                        <div className="cat-tabs">
                            {allTabs.map(tab => (
                                <button key={tab.value} className={`cat-tab ${activeTab === tab.value ? 'active' : ''}`} onClick={() => setActiveTab(tab.value)}>{tab.label}</button>
                            ))}
                        </div>
                        <section className="menu-grid">
                            {filteredItems.map(item => (
                                <div className="food-card" key={item.id} onClick={() => addToCart(item)}>
                                    <div className="food-img"><img src={item.imageUrl || item.image} alt={item.name} /><span className="food-badge">{item.type}</span></div>
                                    <div className="food-info"><h3>{item.name}</h3><p className="food-price">₹{item.price}</p></div>
                                    <button className="add-btn" onClick={e => { e.stopPropagation(); addToCart(item); }}>+</button>
                                </div>
                            ))}
                        </section>
                    </>
                )}

                {waiterView === 'tokens' && (
                    <>
                        <div className="status-tabs-container">
                            {['All', 'PLACED', 'DELIVERED'].map(status => (
                                <button
                                    key={status}
                                    className={`status-tab pill-${status.toLowerCase() || 'all'} ${statusTab === status ? 'active' : ''}`}
                                    onClick={() => setStatusTab(status)}
                                >
                                    {status === 'PLACED' ? 'Active Orders' : status === 'DELIVERED' ? 'Sent to Billing' : status}
                                    <span className="count">
                                        {status === 'All' ? todayOrders.filter(o => o.status !== 'BILLED').length : todayOrders.filter(o => o.status === status).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <section className="token-grid">
                            {(() => {
                                const tokensToShow = todayOrders.filter(o => statusTab === 'All' ? o.status !== 'BILLED' : o.status === statusTab);
                                if (tokensToShow.length === 0) {
                                    return <div className="empty-full"><p>No {statusTab !== 'All' ? statusTab.toLowerCase() : ''} orders found today.</p></div>;
                                }
                                return tokensToShow.map((order, idx) => (
                                    <div className={`token-card status-${String(order.status || 'PLACED').toLowerCase()}`} key={order.tokenNumber || idx}>
                                        <div className="token-header">
                                            <div><span className="token-id">Token #{order.tokenNumber}</span><span className="table-badge">{(order.tableNumber === '0' || !order.tableNumber) ? 'Parcel' : `Table ${order.tableNumber}`}</span></div>
                                            <span className={`status-pill ${String(order.status || 'PLACED').toLowerCase()}`}>{order.status}</span>
                                        </div>
                                        <div className="token-items">{order.items.map(item => (
                                            <div key={item.id} className="token-item-row"><span>{item.itemName}</span><span>× {item.quantity}</span></div>
                                        ))}</div>
                                        <div className="token-footer">
                                            <span className="token-time">{new Date(order.createdAt).toLocaleTimeString()}</span>
                                            <span className="token-total">₹{toNum(order.total).toFixed(2)}</span>
                                        </div>
                                        {(order.status === 'PLACED' || order.status === 'PREPARING' || order.status === 'READY') && (
                                            <button
                                                className="act-btn deliver"
                                                onClick={() => {
                                                    if (window.confirm(`Close Token #${order.tokenNumber} and send to Cashier?`)) {
                                                        updateOrderStatus(order.tokenNumber, 'DELIVERED');
                                                    }
                                                }}
                                            >
                                                ✓ Close Order → Send to Cashier
                                            </button>
                                        )}
                                        {order.status === 'DELIVERED' && <span className="done-tag">✓ Sent to Cashier — Awaiting Bill</span>}
                                    </div>
                                ));
                            })()}
                        </section>
                    </>
                )}
            </main>

            {waiterView === 'take' && (
                <aside className={`cart-panel${cart.length === 0 ? ' cart-panel-empty' : ''}`}>
                    <div className="cart-header"><h2>Order Cart</h2><span className="cart-table">Table: {tableNumber || '—'}</span></div>
                    <div className="cart-list">
                        {cart.length === 0 ? <div className="empty-hint">Add items from the menu</div> : (
                            cart.map(item => (
                                <div className="cart-row" key={item.id}>
                                    <div className="cart-info"><h4>{item.name}</h4><p>₹{item.price}</p></div>
                                    <div className="qty-ctrl">
                                        <button onClick={() => updateQty(item.id, -1)}>−</button>
                                        <span>{item.qty}</span>
                                        <button onClick={() => updateQty(item.id, 1)}>+</button>
                                    </div>
                                    <div className="cart-total">₹{(toNum(item.price) * toNum(item.qty)).toFixed(0)}</div>
                                    <button className="remove-btn" onClick={() => removeFromCart(item.id)}>×</button>
                                </div>
                            ))
                        )}
                    </div>
                    {cart.length > 0 && (
                        <div className="cart-summary">
                            <div className="sum-row"><span>Subtotal</span><span>₹{toNum(cartSubtotal).toFixed(2)}</span></div>
                            <button className="primary-btn" onClick={handlePlaceOrder} disabled={!tableNumber.trim()}>
                                Place Order (#{getNextToken()})
                            </button>
                        </div>
                    )}
                </aside>
            )}
        </div>
    );
}
